/**
 * Fills the Media Studio with a protected asset and its composites, without a provider.
 *
 * A development script, not a runtime path: it refuses to run in production, and the synthetic
 * bottle comes from @spirithaus/testing rather than from anything reachable at runtime. It exists
 * because this environment has no image-generation provider and no real packshots, and a screen
 * with nothing on it cannot be judged.
 *
 * The bottle is obviously synthetic on purpose. Nothing here is a product claim, and the label it
 * carries is not a real label.
 *
 *   pnpm --filter @spirithaus/social-studio demo:media
 */
import { prisma } from '@spirithaus/db';
import type { Principal } from '@spirithaus/domain';
import { bottlePng, environmentPng, labelRegion } from '@spirithaus/testing';
import { shutdownOcr } from '@spirithaus/protected-assets';
import { formatFor, type FormatKey } from '@spirithaus/media-geometry';
import type { Platform } from '@spirithaus/domain';
import { compositeForPlatform, ingestProtectedAsset } from '../app/lib/media.server.js';

const TARGETS: { platform: Platform; format: FormatKey }[] = [
  { platform: 'INSTAGRAM', format: 'reel' },
  { platform: 'INSTAGRAM', format: 'feed' },
  { platform: 'FACEBOOK', format: 'square' },
  { platform: 'PINTEREST', format: 'pin' },
];

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
  console.log('ingested protected master', ingested.assetId);

  for (const target of TARGETS) {
    // The environment is made at the format's own delivered size, so nothing is stretched.
    const { render } = formatFor(target.platform, target.format);
    const result = await compositeForPlatform({
      shopId: shop.id,
      actor,
      assetId: ingested.assetId,
      platform: target.platform,
      format: target.format,
      environmentPng: await environmentPng(render.w, render.h),
    });
    if (!result.ok) {
      console.error(`${target.platform} ${target.format}: ${result.error}`);
      continue;
    }
    console.log(
      `${target.platform} ${target.format}: verification ${result.verification}, geometry ${result.geometryVerdict}`,
    );
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
