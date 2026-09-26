/**
 * Re-calibrates the platform geometry against real product packshots.
 *
 * The Phase 3 profiles were measured against a synthetic bottle whose subject is 0.64 wide for its
 * height. Real packshots in this catalogue run 0.22 to 0.45 — far narrower and taller. A shape
 * that different lands differently in every safe zone, so this re-runs the placement and the
 * per-viewport measurement against what was actually ingested and reports what it finds.
 *
 *   pnpm calibrate:packshots
 *
 * It writes nothing and changes nothing. It prints a report, because a calibration that silently
 * rewrote the thresholds it was checking would be worth nothing.
 */
import { prisma } from '@spirithaus/db';
import {
  formatFor,
  measure,
  placeInSafeZone,
  safeZone,
  PLATFORM_PROFILE_VERSION,
  PRODUCT_GEOMETRY_BASELINE,
  type FormatKey,
} from '@spirithaus/media-geometry';
import type { Platform } from '@spirithaus/domain';

const TARGETS: { platform: Platform; format: FormatKey }[] = [
  { platform: 'INSTAGRAM', format: 'reel' },
  { platform: 'INSTAGRAM', format: 'feed' },
  { platform: 'FACEBOOK', format: 'square' },
  { platform: 'PINTEREST', format: 'pin' },
];

interface Subject {
  title: string;
  width: number;
  height: number;
  aspect: number;
  minUsableWidthPx: number;
}

async function main(): Promise<void> {
  const domain = process.env.SEED_SHOP_DOMAIN ?? 'spirithaus-dev.myshopify.com';
  const shop = await prisma.shop.findUnique({ where: { domain } });
  if (!shop) throw new Error(`No shop ${domain}. Run pnpm db:seed first.`);

  const assets = await prisma.protectedProductAsset.findMany({
    where: { shopId: shop.id, renditionOfId: null, sourceUrl: { not: null } },
    include: { product: { select: { title: true } } },
    orderBy: { createdAt: 'asc' },
  });

  if (assets.length === 0) {
    throw new Error(
      'No ingested packshots to calibrate against. Run pnpm sync:shopify-assets first — calibrating against the synthetic bottle is what this script exists to replace.',
    );
  }

  const subjects: Subject[] = assets.map((asset) => {
    const profile = asset.subjectProfile as { bounds?: { w: number; h: number } } | null;
    // The subject's own bounds, not the frame's: a bottle in a square packshot is not square.
    const bounds = profile?.bounds ?? { w: asset.widthPx, h: asset.heightPx };
    return {
      title:
        asset.product?.title ??
        ((asset.groundTruth as { labelText?: string } | null)?.labelText ?? asset.id).slice(0, 34),
      width: bounds.w,
      height: bounds.h,
      aspect: bounds.w / bounds.h,
      minUsableWidthPx: asset.minUsableWidthPx,
    };
  });

  const aspects = subjects.map((s) => s.aspect).sort((a, b) => a - b);
  console.log(`\nPlatform profile version: ${PLATFORM_PROFILE_VERSION}`);
  console.log(`Subjects: ${subjects.length} real packshots ingested from the catalogue`);
  console.log(
    `Subject aspect (w/h): min ${aspects[0]?.toFixed(3)}, median ${aspects[Math.floor(aspects.length / 2)]?.toFixed(3)}, max ${aspects[aspects.length - 1]?.toFixed(3)}`,
  );
  console.log(
    `Synthetic reference bottle used in Phase 3: ${PRODUCT_GEOMETRY_BASELINE.syntheticReferenceAspect}`,
  );
  console.log(`Recorded product-geometry baseline: ${PRODUCT_GEOMETRY_BASELINE.measuredOn}\n`);

  let belowMinUsable = 0;
  let geometryFailures = 0;

  for (const target of TARGETS) {
    const format = formatFor(target.platform, target.format);
    const zone = safeZone(format);
    const output = { width: format.render.w, height: format.render.h };

    console.log(
      `${target.platform} ${target.format}  ${output.width}x${output.height}  safe zone ` +
        `x${zone.x.toFixed(3)} y${zone.y.toFixed(3)} w${zone.w.toFixed(3)} h${zone.h.toFixed(3)} ` +
        `(${(zone.w * zone.h * 100).toFixed(1)}% of frame)`,
    );

    const scales: number[] = [];
    for (const subject of subjects) {
      const placement = placeInSafeZone({
        format,
        output,
        product: { width: subject.width, height: subject.height },
      });
      const reading = measure({
        format,
        masterAspect: output.width / output.height,
        focal: { x: placement.focal.x, y: placement.focal.y, r: 0.08 },
      });

      const worst =
        reading.viewports.find((viewport) => viewport.viewport === reading.worstViewport) ??
        reading.viewports[0];
      const placedWidth = Math.round(subject.width * placement.scale);
      // An upscale is the only placement that invents detail, and `placeInSafeZone` clamps at 1,
      // so this should never fire. It is checked rather than assumed.
      const upscaled = placement.scale > 1;
      if (upscaled) belowMinUsable += 1;
      if (reading.verdict !== 'pass') geometryFailures += 1;
      scales.push(placement.scale);

      const flags = [
        reading.verdict !== 'pass' ? `GEOMETRY ${reading.verdict.toUpperCase()}` : '',
        upscaled ? `UPSCALED ${placement.scale.toFixed(2)}x` : '',
      ]
        .filter(Boolean)
        .join('  ');

      console.log(
        `   ${subject.title.padEnd(36)} aspect ${subject.aspect.toFixed(3)}` +
          `  scale ${placement.scale.toFixed(3)}  placed ${placedWidth}px` +
          `  worst-viewport visibility ${((worst?.effectiveVisibility ?? 0) * 100).toFixed(1)}%` +
          (flags ? `  ${flags}` : ''),
      );
    }

    const sorted = [...scales].sort((a, b) => a - b);
    console.log(
      `   -> scale min ${sorted[0]?.toFixed(3)}, median ${sorted[Math.floor(sorted.length / 2)]?.toFixed(3)}, max ${sorted[sorted.length - 1]?.toFixed(3)}\n`,
    );
  }

  console.log(
    `Across ${TARGETS.length} formats x ${subjects.length} subjects: ${geometryFailures} geometry failures, ${belowMinUsable} placements that would have upscaled the master.`,
  );
  console.log(
    'Every placement above is a real subject in a modelled interface. The safe zones themselves\n' +
      'remain unverified: no platform client could be loaded here to photograph its furniture, so\n' +
      "the insets are still this repository's reading of calibrate.mjs and public layout guidance.\n",
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
