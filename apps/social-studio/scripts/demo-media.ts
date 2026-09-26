/**
 * Fills the Media Studio with composites, without an image-generation provider.
 *
 * It composites whatever real product masters `sync:shopify-assets` has ingested — preferring
 * those that have a label region, because those are the ones every verification check can run on.
 * With none ingested it falls back to the synthetic bottle and says so, so the screen is never
 * empty and nobody mistakes a fixture for a product.
 *
 * A development script, not a runtime path: it refuses to run in production. The environment
 * plates are generated here rather than by a provider, because this container has none.
 *
 *   pnpm --filter @spirithaus/social-studio demo:media
 */
import { prisma } from '@spirithaus/db';
import type { Principal } from '@spirithaus/domain';
import { bottlePng, environmentPng, labelRegion } from '@spirithaus/testing';
import { shutdownOcr } from '@spirithaus/protected-assets';
import { formatFor, type FormatKey } from '@spirithaus/media-geometry';
import type { Platform } from '@spirithaus/domain';
import { compositeForPlatform, ingestProtectedAsset } from '@spirithaus/media-pipeline';

const TARGETS: { platform: Platform; format: FormatKey }[] = [
  { platform: 'INSTAGRAM', format: 'reel' },
  { platform: 'INSTAGRAM', format: 'feed' },
  { platform: 'FACEBOOK', format: 'square' },
  { platform: 'PINTEREST', format: 'pin' },
];

/** How many ingested masters to stage. Compositing runs four verification checks per format. */
const HOW_MANY = Number(process.env.DEMO_ASSETS ?? '3');

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('demo:media writes synthetic artwork and will not run in production.');
  }

  const domain = process.env.SEED_SHOP_DOMAIN ?? 'spirithaus-dev.myshopify.com';
  const shop = await prisma.shop.findUnique({ where: { domain } });
  if (!shop) throw new Error(`No shop ${domain}. Run pnpm db:seed first.`);

  const user = await prisma.user.findFirst({ where: { shopId: shop.id } });
  if (!user) throw new Error(`No user in ${domain}. Run pnpm db:seed first.`);
  const actor: Principal = { userId: user.id, shopId: shop.id, roles: ['administrator'] };

  // Real masters first: only those with a label region, since without one there is nothing for
  // the colour and label checks to measure and `compositeForPlatform` refuses anyway.
  const real = await prisma.protectedProductAsset.findMany({
    where: {
      shopId: shop.id,
      status: 'MASKED',
      renditionOfId: null,
      sourceUrl: { not: null },
      masks: { some: { kind: 'LABEL' } },
    },
    orderBy: [{ needsReview: 'asc' }, { createdAt: 'desc' }],
    take: HOW_MANY,
    include: { product: { select: { title: true } } },
  });

  const assets: { id: string; label: string }[] = real.map((asset) => ({
    id: asset.id,
    label:
      asset.product?.title ??
      ((asset.groundTruth as { labelText?: string } | null)?.labelText ?? 'ingested master').slice(
        0,
        42,
      ),
  }));

  if (assets.length === 0) {
    console.log(
      'No ingested product masters with a label region were found, so the synthetic fixture is being used.',
    );
    console.log(
      'Run pnpm sync:shopify-assets to stage real packshots from the Shopify catalogue instead.\n',
    );
    const ingested = await ingestProtectedAsset({
      shopId: shop.id,
      actor,
      masterPng: await bottlePng(),
      labelRegion: labelRegion(),
      licence: {
        kind: 'COMMISSIONED',
        holder: 'Synthetic fixture (demo:media)',
        terms: 'Development fixture only. Not licensed for publication.',
        permittedUses: ['development'],
      },
    });
    if (!ingested.ok) throw new Error(ingested.error);
    assets.push({ id: ingested.assetId, label: 'synthetic fixture bottle' });
  } else {
    console.log(`Staging ${assets.length} real product master(s) ingested from the catalogue.\n`);
  }

  for (const asset of assets) {
    console.log(asset.label);
    for (const target of TARGETS) {
      // The environment is made at the format's own delivered size, so nothing is stretched.
      const { render } = formatFor(target.platform, target.format);
      const result = await compositeForPlatform({
        shopId: shop.id,
        actor,
        assetId: asset.id,
        platform: target.platform,
        format: target.format,
        environmentPng: await environmentPng(render.w, render.h),
      });
      if (!result.ok) {
        console.error(`  ${target.platform} ${target.format}: ${result.error}`);
        continue;
      }
      console.log(
        `  ${(target.platform + ' ' + target.format).padEnd(20)} verification ${result.verification.padEnd(10)} geometry ${result.geometryVerdict}`,
      );
    }
    console.log('');
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await shutdownOcr();
    await prisma.$disconnect();
  });
