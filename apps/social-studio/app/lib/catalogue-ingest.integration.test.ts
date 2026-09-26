import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@spirithaus/db';
import type { Principal } from '@spirithaus/domain';
import {
  bottlePng,
  packshotOnBackdropPng,
  paddedPackshotPng,
  bottleAndBoxPng,
} from '@spirithaus/testing';
import { shutdownOcr } from '@spirithaus/protected-assets';
import type { CatalogueProduct, CatalogueSource } from '@spirithaus/shopify';
import { ingestCatalogueImages } from './catalogue-ingest.server.js';
import { compositeForPlatform } from './media.server.js';

/**
 * The catalogue ingestion against a real Postgres, with the network replaced by a function.
 *
 * Supplier packshots are not committed to this repository, so the fixtures reproduce the
 * conditions measured on the real catalogue rather than being copies of it.
 */
const DOMAIN = 'catalogue.myshopify.com';
const TRUNCATE =
  'TRUNCATE render_job, media_asset, asset_mask, protected_product_asset, asset_licence, audit_event, "user", shopify_product, shop CASCADE';

let shopId: string;
let actor: Principal;

beforeEach(async () => {
  await prisma.$executeRawUnsafe(TRUNCATE);
  const shop = await prisma.shop.create({ data: { domain: DOMAIN } });
  shopId = shop.id;
  const user = await prisma.user.create({ data: { shopId, email: 'ops@example.invalid' } });
  actor = { userId: user.id, shopId, roles: ['administrator'] };
});

afterAll(async () => {
  await prisma.$executeRawUnsafe(TRUNCATE);
  await shutdownOcr();
  await prisma.$disconnect();
});

const licence = {
  kind: 'LICENSED' as const,
  holder: 'Supplier',
  terms: 'Rights basis to be confirmed with the supplier before publication.',
  permittedUses: ['social'],
};

function product(overrides: Partial<CatalogueProduct> = {}): CatalogueProduct {
  return {
    gid: 'storefront://product/1',
    handle: 'applewood-gin',
    title: 'Applewood Gin 700ml',
    vendor: 'Applewood',
    productType: 'Gin',
    status: 'PUBLISHED',
    images: [
      {
        url: 'https://cdn.shopify.com/s/files/1/0/files/applewood.png',
        width: 1200,
        height: 2400,
        altText: null,
        position: 1,
      },
    ],
    metadata: { abv: 43, volumeMl: 700 },
    ...overrides,
  };
}

const sourceOf = (products: CatalogueProduct[]): CatalogueSource => ({
  describe: 'test catalogue',
  products: async () => products,
});

describe('ingesting a catalogue', () => {
  it('stores the master, its provenance, and the label text read off it', async () => {
    const master = await paddedPackshotPng({
      width: 700,
      height: 1400,
      canvas: { width: 1400, height: 2400 },
    });

    const result = await ingestCatalogueImages({
      shopId,
      actor,
      source: sourceOf([product()]),
      licence,
      fetchImage: async () => master,
    });

    expect(result.ingested).toBe(1);

    const asset = await prisma.protectedProductAsset.findFirstOrThrow({ where: { shopId } });
    expect(asset.sourceUrl).toContain('applewood.png');
    // The audit trail must never imply an Admin read that did not happen.
    expect(asset.sourceKind).toBe('test catalogue');
    expect(asset.masterDigest).toMatch(/^[0-9a-f]{64}$/);

    const truth = asset.groundTruth as { labelText: string; catalogue: { abv: number | null } };
    expect(truth.labelText).toContain('APPLEWOOD');
    expect(truth.catalogue.abv).toBe(43);

    // Trimmed before the digest, so the digest identifies what the pipeline holds.
    expect(asset.widthPx).toBeLessThan(1400);
    expect(asset.colourReference).not.toBeNull();
  }, 90_000);

  it('ingests the same artwork once', async () => {
    const master = await bottlePng({ width: 700, height: 1400 });
    const input = {
      shopId,
      actor,
      source: sourceOf([product()]),
      licence,
      fetchImage: async () => master,
    };

    const first = await ingestCatalogueImages(input);
    const second = await ingestCatalogueImages(input);

    expect(first.ingested).toBe(1);
    expect(second.ingested).toBe(0);
    expect(second.alreadyPresent).toBe(1);
    expect(await prisma.protectedProductAsset.count({ where: { shopId } })).toBe(1);
    // A second run must not leave a licence row behind for a master it did not create.
    expect(await prisma.assetLicence.count({ where: { shopId } })).toBe(1);
  }, 90_000);

  it('treats changed artwork at the same URL as a different master', async () => {
    const base = { shopId, actor, source: sourceOf([product()]), licence };
    await ingestCatalogueImages({
      ...base,
      fetchImage: async () => bottlePng({ width: 700, height: 1400 }),
    });
    // The supplier re-shot the bottle and kept the filename. Different bytes, different digest,
    // and the pipeline must not silently keep serving the old master under the new one's name.
    await ingestCatalogueImages({
      ...base,
      fetchImage: async () => bottlePng({ width: 700, height: 1400, statement: '45% ABV 700ml' }),
    });

    const assets = await prisma.protectedProductAsset.findMany({ where: { shopId } });
    expect(assets).toHaveLength(2);
    expect(new Set(assets.map((asset) => asset.masterDigest)).size).toBe(2);
  }, 90_000);

  it('cuts out an opaque packshot and records that it did', async () => {
    const result = await ingestCatalogueImages({
      shopId,
      actor,
      source: sourceOf([product()]),
      licence,
      fetchImage: async () => packshotOnBackdropPng({ width: 700, height: 1400 }),
    });

    expect(result.ingested).toBe(1);
    const asset = await prisma.protectedProductAsset.findFirstOrThrow({ where: { shopId } });
    const cutout = asset.cutout as { applied: boolean; background: { r: number } | null };
    expect(cutout.applied).toBe(true);
    expect(cutout.background?.r).toBeCloseTo(255, 0);
  }, 90_000);

  it('ingests a packshot showing two objects but marks it for review', async () => {
    const result = await ingestCatalogueImages({
      shopId,
      actor,
      source: sourceOf([product()]),
      licence,
      fetchImage: async () => bottleAndBoxPng({ width: 700, height: 1400 }),
    });

    expect(result.needingReview).toBe(1);
    const asset = await prisma.protectedProductAsset.findFirstOrThrow({ where: { shopId } });
    expect(asset.needsReview).toBe(true);
    expect(asset.reviewReasons.join(' ')).toContain('more than one object');
  }, 90_000);

  it('skips an image too small to place at any format without upscaling', async () => {
    const result = await ingestCatalogueImages({
      shopId,
      actor,
      source: sourceOf([
        product({
          images: [
            {
              url: 'https://cdn.shopify.com/s/files/1/0/files/tiny.png',
              width: 256,
              height: 256,
              altText: null,
              position: 1,
            },
          ],
        }),
      ]),
      licence,
      fetchImage: async () => {
        throw new Error('the catalogue dimensions should have stopped this download');
      },
    });

    expect(result.skipped).toBe(1);
    expect(await prisma.protectedProductAsset.count({ where: { shopId } })).toBe(0);
  });

  it('records a product with no images as skipped rather than failing the run', async () => {
    const result = await ingestCatalogueImages({
      shopId,
      actor,
      source: sourceOf([product({ images: [] }), product({ handle: 'second' })]),
      licence,
      fetchImage: async () => bottlePng({ width: 700, height: 1400 }),
    });

    expect(result.skipped).toBe(1);
    expect(result.ingested).toBe(1);
  }, 90_000);
});

describe('a catalogue-ingested master in the composite pipeline', () => {
  it('verifies against real label pixels, and refuses once the stored bytes change', async () => {
    await ingestCatalogueImages({
      shopId,
      actor,
      source: sourceOf([product()]),
      licence,
      fetchImage: async () => bottlePng({ width: 700, height: 1400 }),
    });
    const asset = await prisma.protectedProductAsset.findFirstOrThrow({ where: { shopId } });

    const { environmentPng } = await import('@spirithaus/testing');
    const composited = await compositeForPlatform({
      shopId,
      actor,
      assetId: asset.id,
      platform: 'INSTAGRAM',
      format: 'reel',
      environmentPng: await environmentPng(1080, 1920),
    });

    expect(composited.ok).toBe(true);
    if (!composited.ok) return;
    // Every check decisive: the label region came from OCR word boxes, and the colour reference
    // was baselined from those same pixels at ingestion.
    expect(composited.verification).toBe('PASS');

    // Now the supplier's file is swapped underneath us at the same storage key.
    const { storage } = await import('./storage.server.js');
    await storage().put(
      asset.masterKey,
      await bottlePng({ width: 700, height: 1400, statement: '45% ABV 700ml' }),
      'image/png',
    );

    const after = await compositeForPlatform({
      shopId,
      actor,
      assetId: asset.id,
      platform: 'INSTAGRAM',
      format: 'reel',
      environmentPng: await environmentPng(1080, 1920),
    });

    expect(after.ok).toBe(false);
    if (after.ok) return;
    expect(after.error).toContain('approved at ingestion');
  }, 120_000);
});
