import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@spirithaus/db';
import type { Principal } from '@spirithaus/domain';
import { bottlePng, environmentPng, labelRegion } from '@spirithaus/testing';
import { shutdownOcr } from '@spirithaus/protected-assets';
import { ingestProtectedAsset, queueComposite } from './pipeline.js';
import { storage } from './storage.js';

/**
 * Compositing as queued work rather than as part of a request (ADR 0012).
 *
 * The worker handler lives in apps/worker and cannot be imported here, so this exercises the two
 * halves that matter: what the request path does (writes a job, stores the environment, enqueues,
 * returns), and that the recorded payload is enough to do the work from — which is the property
 * that makes moving it off the request path safe.
 */
const DOMAIN = 'composite-queue.myshopify.com';
const TRUNCATE =
  'TRUNCATE render_job, media_asset, asset_mask, protected_product_asset, asset_licence, audit_event, "user", shop CASCADE';

let shopId: string;
let actor: Principal;
let assetId: string;

beforeEach(async () => {
  await prisma.$executeRawUnsafe(TRUNCATE);
  const shop = await prisma.shop.create({ data: { domain: DOMAIN } });
  shopId = shop.id;
  const user = await prisma.user.create({ data: { shopId, email: 'creator@example.invalid' } });
  actor = { userId: user.id, shopId, roles: ['creator'] };

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
});

afterAll(async () => {
  await prisma.$executeRawUnsafe(TRUNCATE);
  await shutdownOcr();
  await prisma.$disconnect();
});

const request = async (environment?: Uint8Array) =>
  queueComposite({
    shopId,
    actor,
    assetId,
    platform: 'INSTAGRAM',
    format: 'reel',
    ...(environment ? { environmentPng: environment } : {}),
  });

describe('requesting a composite', () => {
  it('returns a job without doing the work', async () => {
    const started = Date.now();
    const result = await request(await environmentPng(1080, 1920));
    const elapsed = Date.now() - started;

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.queued).toBe(true);

    const job = await prisma.renderJob.findUniqueOrThrow({ where: { id: result.jobId } });
    expect(job.kind).toBe('COMPOSITE');
    expect(job.state).toBe('QUEUED');

    // Nothing was composited: that is the whole point of the change.
    expect(await prisma.mediaAsset.count({ where: { shopId } })).toBe(0);
    // And the request did not sit through OCR. Generous, because CI machines are slow; the
    // inline version took seconds on a packshot this size.
    expect(elapsed).toBeLessThan(3_000);
  }, 60_000);

  it('stores the environment rather than putting it in the payload', async () => {
    // A megabyte of PNG does not belong in a Redis job payload.
    const result = await request(await environmentPng(1080, 1920));
    if (!result.ok) return;

    const job = await prisma.renderJob.findUniqueOrThrow({ where: { id: result.jobId } });
    const props = job.props as { environmentKey: string | null; assetId: string };
    expect(props.environmentKey).toMatch(/^environments\/[0-9a-f]{16}\.png$/);
    expect(props.assetId).toBe(assetId);

    // The worker rebuilds from the key, so the bytes have to actually be there.
    const stored = await storage().get(props.environmentKey as string);
    expect(stored).not.toBeNull();
  }, 60_000);

  it('is idempotent for the same asset, format and environment', async () => {
    const environment = await environmentPng(1080, 1920);
    const first = await request(environment);
    const second = await request(environment);

    expect(first.ok && first.queued).toBe(true);
    expect(second.ok && second.queued).toBe(false);
    expect(first.ok && second.ok && first.jobId).toBe(second.ok ? second.jobId : '');
    expect(await prisma.renderJob.count({ where: { shopId } })).toBe(1);
  }, 60_000);

  it('treats a different environment as different work', async () => {
    await request(await environmentPng(1080, 1920, 1));
    await request(await environmentPng(1080, 1920, 2));
    expect(await prisma.renderJob.count({ where: { shopId } })).toBe(2);
  }, 60_000);

  it('refuses an asset from another shop before queueing anything', async () => {
    const other = await prisma.shop.create({ data: { domain: 'other.myshopify.com' } });
    const result = await queueComposite({
      shopId: other.id,
      actor: { ...actor, shopId: other.id },
      assetId,
      platform: 'INSTAGRAM',
      format: 'reel',
    });
    expect(result.ok).toBe(false);
    expect(await prisma.renderJob.count({ where: { shopId: other.id } })).toBe(0);
  });
});
