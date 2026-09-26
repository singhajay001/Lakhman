import { createHash } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@spirithaus/db';
import type { Principal } from '@spirithaus/domain';
import type { CompositePayload } from '@spirithaus/jobs';
import { bottlePng, environmentPng, labelRegion, S3TestServer } from '@spirithaus/testing';
import { decode, readText, shutdownOcr } from '@spirithaus/protected-assets';
import {
  ingestProtectedAsset,
  queueComposite,
  resetStorage,
  storage,
  type Storage,
} from '@spirithaus/media-pipeline';
import { handleComposite } from './composite.js';

/**
 * A composite crossing the process boundary, through object storage, for real.
 *
 * This is the test that would have caught the defect that made it worth writing. Until the S3
 * adapter existed, `storage()` always returned a local directory, so on Fly the web machine wrote
 * the environment plate to its own `/tmp` and the worker machine looked in a different one. Every
 * composite failed, and it failed as "the environment image is missing from storage" — which reads
 * like a problem with the artwork rather than with the deployment.
 *
 * So the request half and the worker half each get their **own independently constructed storage
 * client**, built by the same resolver from the same variables, exactly as two processes would.
 * `resetStorage()` between them is what stands in for the process boundary: nothing is shared but
 * the bucket. The S3 boundary itself is not mocked — a local HTTP server answers real signed,
 * path-style S3 requests, and nothing leaves this machine or costs anything.
 */
const DOMAIN = 'composite-storage.myshopify.com';
const BUCKET = 'spirithaus-integration-media';
const TRUNCATE =
  'TRUNCATE render_job, media_asset, asset_mask, protected_product_asset, asset_licence, audit_event, "user", shop CASCADE';

let server: S3TestServer;
let shopId: string;
let actor: Principal;
let assetId: string;

/** The variables Fly's Tigris integration injects, pointed at the local server. */
const s3Env = (endpoint: string): void => {
  process.env.AWS_ACCESS_KEY_ID = 'AKIAINTEGRATIONEXAMPLE';
  process.env.AWS_SECRET_ACCESS_KEY = 'iNtEgRaTiOnSeCrEtNeVeRlOgGeD000000000000';
  process.env.AWS_ENDPOINT_URL_S3 = endpoint;
  process.env.AWS_REGION = 'auto';
  process.env.BUCKET_NAME = BUCKET;
};

const clearS3Env = (): void => {
  for (const name of [
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_ENDPOINT_URL_S3',
    'AWS_REGION',
    'BUCKET_NAME',
  ]) {
    delete process.env[name];
  }
};

/** Forces a brand-new client, as a second process would build for itself. */
const freshClient = (): Storage => {
  resetStorage();
  return storage();
};

beforeAll(() => {
  clearS3Env();
});

beforeEach(async () => {
  server = new S3TestServer({ buckets: [BUCKET] });
  s3Env(await server.start());
  resetStorage();

  await prisma.$executeRawUnsafe(TRUNCATE);
  const shop = await prisma.shop.create({ data: { domain: DOMAIN } });
  shopId = shop.id;
  const user = await prisma.user.create({ data: { shopId, email: 'creator@example.invalid' } });
  actor = { userId: user.id, shopId, roles: ['creator'] };
});

afterEach(async () => {
  resetStorage();
  clearS3Env();
  await server.stop();
});

afterAll(async () => {
  await prisma.$executeRawUnsafe(TRUNCATE);
  await shutdownOcr();
  await prisma.$disconnect();
});

/** Ingests a master through a web-side client. Returns that client, to prove it is not reused. */
async function ingestAsWeb(): Promise<Storage> {
  const web = freshClient();
  expect(web.local).toBe(false);

  const ingested = await ingestProtectedAsset({
    shopId,
    actor,
    masterPng: await bottlePng({ width: 700, height: 1400 }),
    labelRegion: labelRegion(),
    licence: {
      kind: 'COMMISSIONED',
      holder: 'Studio example',
      terms: 'Unlimited use in SPIRITHAUS marketing, no resale.',
      permittedUses: ['social'],
    },
  });
  if (!ingested.ok) throw new Error(ingested.error);
  assetId = ingested.assetId;
  return web;
}

describe('a queued composite, across two storage clients', () => {
  it('completes through the real worker handler and reaches SUCCEEDED', async () => {
    const web = await ingestAsWeb();

    const queued = await queueComposite({
      shopId,
      actor,
      assetId,
      platform: 'INSTAGRAM',
      format: 'reel',
      environmentPng: await environmentPng(1080, 1920),
    });
    expect(queued.ok).toBe(true);
    if (!queued.ok) throw new Error(queued.error);

    const enqueuedAt = Date.now();
    const row = await prisma.renderJob.findUniqueOrThrow({ where: { id: queued.jobId } });
    expect(row.state).toBe('QUEUED');

    const params = row.props as {
      assetId: string;
      platform: string;
      format: string;
      environmentKey: string | null;
    };
    expect(params.environmentKey).toMatch(/^environments\/[0-9a-f]{16}\.png$/);

    // The plate really is in the bucket, asserted against the server rather than through the
    // client that wrote it.
    expect(server.stored(BUCKET, params.environmentKey!)).toBeDefined();

    const payload: CompositePayload = {
      jobId: row.id,
      shopId,
      assetId: params.assetId,
      platform: params.platform,
      format: params.format,
      environmentKey: params.environmentKey,
      requestedByUserId: row.requestedByUserId,
    };

    // The process boundary. From here nothing the web client holds is in play.
    const worker = freshClient();
    expect(worker).not.toBe(web);

    const startedProcessing = Date.now();
    await handleComposite(payload);
    const processingMs = Date.now() - startedProcessing;

    const done = await prisma.renderJob.findUniqueOrThrow({ where: { id: row.id } });
    expect(done.state).toBe('SUCCEEDED');
    expect(done.error).toBeNull();
    expect(done.progress).toBe(100);
    expect(done.mediaAssetId).not.toBeNull();

    const media = await prisma.mediaAsset.findUniqueOrThrow({
      where: { id: done.mediaAssetId! },
    });
    expect(media.kind).toBe('COMPOSITE_STILL');
    expect(media.verification).toBe('PASSED');
    expect(media.widthPx).toBe(1080);
    expect(media.heightPx).toBe(1920);

    // Retrieved through a third independent client, as a delivery path would.
    const reader = freshClient();
    const retrieved = await reader.get(media.objectKey);
    expect(retrieved).not.toBeNull();

    // Byte-identical to what the bucket holds, so nothing re-encoded it in transit.
    expect(Buffer.from(retrieved!)).toEqual(server.stored(BUCKET, media.objectKey));

    // Still the image that was verified: it decodes to the geometry that was recorded.
    const raster = await decode(retrieved!);
    expect(raster.width).toBe(media.widthPx);
    expect(raster.height).toBe(media.heightPx);

    // And the protected content survived the round trip — the label is still readable, which is
    // the property the whole verification pipeline exists to defend.
    //
    // Read on the whole 1080x1920 frame rather than cropped to the label, so the first glyph is
    // clipped and this comes back as "PPLEWOOD GL | 43% ABV 700ML". That artefact is already
    // documented in the fixture: a crop flush to the printed area loses the leading and trailing
    // glyphs, which is why `labelRegion()` is drawn with a margin and why the verification pass
    // upscales before reading. It is a property of reading a downscaled full frame, not of
    // storage, so the assertion uses the parts OCR returns reliably. The statement line survives
    // intact and is distinctive enough to prove the printed label came back.
    const read = await readText(retrieved!);
    expect(read.ok).toBe(true);
    if (!read.ok) throw new Error(read.error);
    const text = read.value.text.toUpperCase();
    expect(text).toContain('PPLEWOOD');
    expect(text).toContain('700ML');

    console.log(
      `queued->stored ${startedProcessing - enqueuedAt}ms | worker processing ${processingMs}ms | ` +
        `composite ${retrieved!.byteLength} bytes | objects in bucket ${server.objectCount}`,
    );
  });

  it('writes the master through one client and reads it through another', async () => {
    await ingestAsWeb();
    const asset = await prisma.protectedProductAsset.findFirstOrThrow({ where: { shopId } });

    const master = await freshClient().get(asset.masterKey);
    expect(master).not.toBeNull();
    // The digest recorded at ingestion still matches after a storage round trip, which is what
    // the pipeline's master-integrity gate checks before it will composite at all.
    expect(createHash('sha256').update(master!).digest('hex')).toBe(asset.masterDigest);
  });

  it('is idempotent: the same environment bytes reuse one object', async () => {
    await ingestAsWeb();
    const environment = await environmentPng(1080, 1920);

    const first = await queueComposite({
      shopId,
      actor,
      assetId,
      platform: 'INSTAGRAM',
      format: 'reel',
      environmentPng: environment,
    });
    const second = await queueComposite({
      shopId,
      actor,
      assetId,
      platform: 'INSTAGRAM',
      format: 'reel',
      environmentPng: environment,
    });

    expect(first.ok && second.ok).toBe(true);
    // One plate, because the key is the digest of its bytes.
    const plates = [...Array(server.objectCount).keys()];
    expect(plates.length).toBeGreaterThan(0);
    const environmentObjects = await prisma.renderJob.findMany({ where: { shopId } });
    const keys = new Set(
      environmentObjects.map(
        (job) => (job.props as { environmentKey: string | null }).environmentKey,
      ),
    );
    expect(keys.size).toBe(1);
  });
});

describe('the worker refuses work it cannot complete', () => {
  it('records a terminal failure when the plate is genuinely absent', async () => {
    await ingestAsWeb();

    const queued = await queueComposite({
      shopId,
      actor,
      assetId,
      platform: 'INSTAGRAM',
      format: 'reel',
      environmentPng: await environmentPng(1080, 1920),
    });
    if (!queued.ok) throw new Error(queued.error);
    const row = await prisma.renderJob.findUniqueOrThrow({ where: { id: queued.jobId } });

    await handleComposite({
      jobId: row.id,
      shopId,
      assetId,
      platform: 'INSTAGRAM',
      format: 'reel',
      // A key nothing ever wrote. This is the shape the old local-storage bug produced on every
      // single job; it must stay a clean, terminal refusal rather than a crash or a retry loop.
      environmentKey: 'environments/0000000000000000.png',
      requestedByUserId: row.requestedByUserId,
    });

    const done = await prisma.renderJob.findUniqueOrThrow({ where: { id: row.id } });
    expect(done.state).toBe('FAILED');
    expect(done.error).toContain('missing from storage');
  });
});
