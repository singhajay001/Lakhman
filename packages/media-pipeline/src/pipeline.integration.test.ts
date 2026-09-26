import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@spirithaus/db';
import type { Principal } from '@spirithaus/domain';
import { bottlePng, environmentPng, labelRegion } from '@spirithaus/testing';
import { shutdownOcr } from '@spirithaus/protected-assets';
import {
  compositeForPlatform,
  ingestProtectedAsset,
  queueRender,
  cancelRender,
} from './pipeline.js';

/**
 * The Phase 3 pipeline as the app drives it, against a real Postgres.
 */
const DOMAIN = 'phase3.myshopify.com';
const TRUNCATE =
  'TRUNCATE render_job, media_asset, asset_mask, protected_product_asset, asset_licence, audio_asset, voice_consent, voice_profile, audit_event, "user", shop CASCADE';

let shopId: string;
let creator: Principal;

beforeEach(async () => {
  await prisma.$executeRawUnsafe(TRUNCATE);
  const shop = await prisma.shop.create({ data: { domain: DOMAIN } });
  shopId = shop.id;
  const user = await prisma.user.create({ data: { shopId, email: 'creator@example.invalid' } });
  creator = { userId: user.id, shopId, roles: ['creator'] };
});

afterAll(async () => {
  await prisma.$executeRawUnsafe(TRUNCATE);
  await shutdownOcr();
  await prisma.$disconnect();
});

const licence = {
  kind: 'COMMISSIONED' as const,
  holder: 'Studio example',
  terms: 'Unlimited use in SPIRITHAUS marketing, no resale.',
  permittedUses: ['social', 'storefront'],
};

async function ingest() {
  return ingestProtectedAsset({
    shopId,
    actor: creator,
    masterPng: await bottlePng(),
    labelRegion: labelRegion(),
    licence,
  });
}

describe('ingesting a protected master', () => {
  it('records the licence, the digest and both masks', async () => {
    const result = await ingest();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const asset = await prisma.protectedProductAsset.findUniqueOrThrow({
      where: { id: result.assetId },
      include: { masks: true, licence: true },
    });

    expect(asset.status).toBe('MASKED');
    expect(asset.masterDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(asset.licence.holder).toBe('Studio example');
    expect(asset.masks.map((mask) => mask.kind).sort()).toEqual(['LABEL', 'PRODUCT']);
    // The colour of the label on the approved master, recorded once, so a later tint has
    // something to be measured against.
    expect(asset.colourReference).not.toBeNull();
  });

  it('records the dilation buffer the inpainting mask was built with', async () => {
    const result = await ingest();
    if (!result.ok) return;
    const masks = await prisma.assetMask.findMany({ where: { assetId: result.assetId } });
    for (const mask of masks) {
      expect(mask.dilatePx).toBeGreaterThanOrEqual(2);
      expect(mask.dilatePx).toBeLessThanOrEqual(4);
    }
  });

  it('refuses a master too small to place without upscaling', async () => {
    const result = await ingestProtectedAsset({
      shopId,
      actor: creator,
      masterPng: await bottlePng({ width: 200, height: 400 }),
      labelRegion: labelRegion(),
      licence,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // The gate is aspect-aware and derived from this repository's own safe zones, not a flat
    // minimum edge: a tall narrow bottle has plenty of resolution at 528px wide, and a square
    // has too little at 600.
    expect(result.error).toContain('961px tall');
    expect(result.error).toContain('upscaling');
  });
});

describe('compositing for a platform', () => {
  it('verifies, measures per viewport, and stores the spec it can be rebuilt from', async () => {
    const ingested = await ingest();
    if (!ingested.ok) return;

    const result = await compositeForPlatform({
      shopId,
      actor: creator,
      assetId: ingested.assetId,
      platform: 'INSTAGRAM',
      format: 'reel',
      environmentPng: await environmentPng(1080, 1920),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.verification).toBe('PASS');
    expect(result.geometryVerdict).toBe('pass');

    const media = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: result.mediaAssetId } });
    const spec = media.compositeSpec as { masterDigest: string; transform: { scale: number } };
    expect(spec.masterDigest).toHaveLength(64);
    expect(spec.transform.scale).toBeGreaterThan(0);

    const geometry = media.geometry as { viewports: { viewport: string }[] };
    // Three surfaces for a Reel: the player, the feed crop, and the grid thumbnail.
    expect(geometry.viewports).toHaveLength(3);
  }, 60_000);

  it('refuses when no environment is supplied and no provider can make one', async () => {
    const ingested = await ingest();
    if (!ingested.ok) return;

    const result = await compositeForPlatform({
      shopId,
      actor: creator,
      assetId: ingested.assetId,
      platform: 'INSTAGRAM',
      format: 'reel',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // Not a blank background invented on the spot.
    expect(result.error).toContain('No environment was supplied');
  });

  it('refuses to composite when the master in storage no longer matches its digest', async () => {
    const ingested = await ingest();
    if (!ingested.ok) return;

    // Swap the stored master for a falsified one, the way a compromised storage layer would.
    // The database row is immutable by trigger; the object store is not, so the digest recorded
    // at ingestion is the thing that catches this.
    const asset = await prisma.protectedProductAsset.findUniqueOrThrow({
      where: { id: ingested.assetId },
    });
    const { storage } = await import('./storage.js');
    await storage().put(
      asset.masterKey,
      await bottlePng({ statement: '45% ABV 700ml' }),
      'image/png',
    );

    const result = await compositeForPlatform({
      shopId,
      actor: creator,
      assetId: ingested.assetId,
      platform: 'INSTAGRAM',
      format: 'reel',
      environmentPng: await environmentPng(1080, 1920),
    });

    // Not a composite carrying a FAIL: an altered product layer must not reach a reviewer at all.
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('approved at ingestion');
    expect(await prisma.mediaAsset.count({ where: { shopId } })).toBe(0);

    const audit = await prisma.auditEvent.findFirst({
      where: { shopId, action: 'media.verification_failed' },
    });
    expect(audit).not.toBeNull();
    expect((audit?.after as { check?: string } | null)?.check).toBe('master_integrity');
  }, 60_000);

  it('composites a recorded rendition at scale 1 rather than resampling the protected layer', async () => {
    const ingested = await ingest();
    if (!ingested.ok) return;

    const result = await compositeForPlatform({
      shopId,
      actor: creator,
      assetId: ingested.assetId,
      platform: 'INSTAGRAM',
      format: 'reel',
      environmentPng: await environmentPng(1080, 1920),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const media = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: result.mediaAssetId } });
    const spec = media.compositeSpec as {
      transform: { scale: number };
      renditionOf: string | null;
    };
    // The protected layer is placed, never resampled — so every check stays decisive.
    expect(spec.transform.scale).toBe(1);
    expect(spec.renditionOf).toBe(ingested.assetId);

    const rendition = await prisma.protectedProductAsset.findFirstOrThrow({
      where: { renditionOfId: ingested.assetId },
    });
    expect(rendition.masterDigest).not.toBe(
      (await prisma.protectedProductAsset.findUniqueOrThrow({ where: { id: ingested.assetId } }))
        .masterDigest,
    );
    // The approved colour is carried forward, not re-read off the resampled copy: re-reading it
    // would make the colour check circular.
    expect(rendition.colourReference).toEqual(
      (await prisma.protectedProductAsset.findUniqueOrThrow({ where: { id: ingested.assetId } }))
        .colourReference,
    );
  }, 60_000);

  it('reuses a rendition instead of making a second one', async () => {
    const ingested = await ingest();
    if (!ingested.ok) return;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = await compositeForPlatform({
        shopId,
        actor: creator,
        assetId: ingested.assetId,
        platform: 'INSTAGRAM',
        format: 'reel',
        environmentPng: await environmentPng(1080, 1920),
      });
      expect(result.ok).toBe(true);
    }

    expect(
      await prisma.protectedProductAsset.count({ where: { renditionOfId: ingested.assetId } }),
    ).toBe(1);
  }, 90_000);
});

describe('the render queue', () => {
  it('is idempotent for the same composition and props', async () => {
    const props = { aspect: '9:16', headline: 'Applewood Gin', responsibleLine: null };
    const first = await queueRender({
      shopId,
      actor: creator,
      compositionId: 'ProductHero-9x16',
      props,
    });
    const second = await queueRender({
      shopId,
      actor: creator,
      compositionId: 'ProductHero-9x16',
      props,
    });

    expect(first.ok && first.queued).toBe(true);
    expect(second.ok && second.queued).toBe(false);
    expect(first.ok && second.ok && first.renderJobId).toBe(second.ok ? second.renderJobId : '');
    expect(await prisma.renderJob.count({ where: { shopId } })).toBe(1);
  });

  it('treats different props as different work', async () => {
    await queueRender({
      shopId,
      actor: creator,
      compositionId: 'ProductHero-9x16',
      props: { headline: 'One' },
    });
    await queueRender({
      shopId,
      actor: creator,
      compositionId: 'ProductHero-9x16',
      props: { headline: 'Two' },
    });
    expect(await prisma.renderJob.count({ where: { shopId } })).toBe(2);
  });

  it('does not depend on property order in the props', async () => {
    await queueRender({
      shopId,
      actor: creator,
      compositionId: 'ProductHero-9x16',
      props: { a: 1, b: 2 },
    });
    const again = await queueRender({
      shopId,
      actor: creator,
      compositionId: 'ProductHero-9x16',
      props: { b: 2, a: 1 },
    });
    expect(again.ok && again.queued).toBe(false);
  });

  it('cancels a queued render, and refuses to cancel a finished one', async () => {
    const queued = await queueRender({
      shopId,
      actor: creator,
      compositionId: 'ProductHero-1x1',
      props: {},
    });
    if (!queued.ok) return;

    expect(await cancelRender(shopId, queued.renderJobId)).toBe(true);
    expect(
      (await prisma.renderJob.findUniqueOrThrow({ where: { id: queued.renderJobId } })).state,
    ).toBe('CANCELLED');

    await prisma.renderJob.update({
      where: { id: queued.renderJobId },
      data: { state: 'SUCCEEDED' },
    });
    expect(await cancelRender(shopId, queued.renderJobId)).toBe(false);
  });
});

describe('protected assets are write-once once approved', () => {
  it('refuses to change the master of an approved asset', async () => {
    const ingested = await ingest();
    if (!ingested.ok) return;
    await prisma.protectedProductAsset.update({
      where: { id: ingested.assetId },
      data: { status: 'APPROVED', approvedAt: new Date() },
    });

    await expect(
      prisma.protectedProductAsset.update({
        where: { id: ingested.assetId },
        data: { masterKey: 'protected/somewhere-else.png' },
      }),
    ).rejects.toThrow(/write-once/i);
  });

  it('refuses to redraw a mask on an approved asset', async () => {
    const ingested = await ingest();
    if (!ingested.ok) return;
    await prisma.protectedProductAsset.update({
      where: { id: ingested.assetId },
      data: { status: 'APPROVED' },
    });

    const mask = await prisma.assetMask.findFirstOrThrow({ where: { assetId: ingested.assetId } });
    await expect(
      prisma.assetMask.update({
        where: { id: mask.id },
        data: { maskKey: 'protected/other-mask.png' },
      }),
    ).rejects.toThrow(/new version/i);
  });

  it('still allows the status to move, so an asset can be retired', async () => {
    const ingested = await ingest();
    if (!ingested.ok) return;
    await prisma.protectedProductAsset.update({
      where: { id: ingested.assetId },
      data: { status: 'APPROVED' },
    });
    await expect(
      prisma.protectedProductAsset.update({
        where: { id: ingested.assetId },
        data: { status: 'RETIRED' },
      }),
    ).resolves.toBeTruthy();
  });

  it('refuses a dilation buffer outside two to four pixels', async () => {
    const ingested = await ingest();
    if (!ingested.ok) return;
    const mask = await prisma.assetMask.findFirstOrThrow({ where: { assetId: ingested.assetId } });
    await expect(
      prisma.assetMask.update({ where: { id: mask.id }, data: { dilatePx: 1 } }),
    ).rejects.toThrow();
  });
});
