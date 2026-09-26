import { createHash } from 'node:crypto';
import { prisma, recordAudit } from '@spirithaus/db';
import { canonicalise } from '@spirithaus/domain/server';
import type { Principal } from '@spirithaus/domain';
import {
  colourReferenceFor,
  composite,
  createRendition,
  decode,
  encodeMask,
  inpaintMask,
  maskFromAlpha,
  maskFromRect,
  bounds as maskBounds,
  verifyComposite,
  deltaE2000,
  type Lab,
  type Region,
} from '@spirithaus/protected-assets';
import {
  formatFor,
  placeInSafeZone,
  measure,
  requiredMasterHeightPx,
  type FormatKey,
} from '@spirithaus/media-geometry';
import {
  QUEUES,
  compositeIdempotencyKey,
  renderIdempotencyKey,
  type CompositePayload,
  type RenderPayload,
} from '@spirithaus/jobs';
import type { Platform } from '@spirithaus/domain';
import { resolveAdapter } from '@spirithaus/providers';
import { queue } from './queue.js';
import { storage } from './storage.js';

/**
 * The protected-product pipeline, as the app drives it (section 15).
 *
 * The ordering is the substance: licence, then master, then masks, then an environment
 * generated *around* a dilated mask, then a deterministic composite, then four checks, and only
 * then a human. Every step writes what it did, so a composite can be rebuilt and re-verified
 * from its recorded tuple.
 */
/**
 * How far a rendition's label colour may sit from the approved master's. Measured, not guessed:
 * lanczos3 resampling of the test master moves it by 0.03–0.06, so this leaves ample headroom
 * for honest resampling while staying far below the 8.6 a visible tint produces.
 */
const RENDITION_MAX_DELTA_E = 1;

export interface IngestInput {
  shopId: string;
  actor: Principal;
  productId?: string | null;
  masterPng: Uint8Array;
  /**
   * Where the label sits on the master, normalised. Drawn by a person, or derived from OCR word
   * boxes when a catalogue is ingested in bulk (see `detectLabelRegion`).
   *
   * Null when neither has happened yet. The master is still stored, digested and masked to its
   * silhouette — it simply cannot be composited until somebody draws the region, which
   * `compositeForPlatform` already refuses to do without. Storing the artwork and admitting the
   * region is missing beats either skipping the product or inventing a rectangle.
   */
  labelRegion: Region | null;
  licence: {
    kind: 'OWNED' | 'COMMISSIONED' | 'LICENSED';
    holder: string;
    terms: string;
    permittedUses: string[];
    expiresAt?: Date | null;
    evidenceUrl?: string | null;
  };
  /** Where the bytes came from, when they were not uploaded by hand. */
  provenance?: { sourceUrl: string | null; sourceKind: string } | null;
  /** What was measured about the subject and the cutout, recorded for the reviewer. */
  observations?: {
    subjectProfile?: unknown;
    cutout?: unknown;
    groundTruth?: unknown;
  } | null;
  /** Reasons a person must look at this asset before it is staged. */
  reviewReasons?: string[];
}

export async function ingestProtectedAsset(
  input: IngestInput,
): Promise<{ ok: true; assetId: string; alreadyPresent: boolean } | { ok: false; error: string }> {
  const raster = await decode(input.masterPng);
  // Aspect-aware, and derived from this repository's own safe zones rather than picked: a bottle
  // is tall and narrow, and a flat "600px on either edge" rule failed real packshots that had
  // plenty of resolution while passing squares that did not.
  const required = requiredMasterHeightPx(raster.width / raster.height);
  if (raster.height < required) {
    return {
      ok: false,
      error: `This master is ${raster.width}×${raster.height}. A product of this shape is placed at up to ${required}px tall by the largest format, so using it would mean upscaling, which is not a thing this pipeline will do.`,
    };
  }

  // The same artwork ingests once. Checked before a licence row is written, so re-running a
  // catalogue sync does not litter the database with licences for masters that already exist.
  const digest = createHash('sha256').update(Buffer.from(input.masterPng)).digest('hex');
  const existing = await prisma.protectedProductAsset.findUnique({
    where: { shopId_masterDigest: { shopId: input.shopId, masterDigest: digest } },
  });
  if (existing) return { ok: true, assetId: existing.id, alreadyPresent: true };

  const licence = await prisma.assetLicence.create({
    data: {
      shopId: input.shopId,
      kind: input.licence.kind,
      holder: input.licence.holder,
      terms: input.licence.terms,
      permittedUses: input.licence.permittedUses,
      expiresAt: input.licence.expiresAt ?? null,
      evidenceUrl: input.licence.evidenceUrl ?? null,
    },
  });

  const masterDigest = digest;
  const masterKey = `protected/${masterDigest.slice(0, 16)}.png`;
  await storage().put(masterKey, input.masterPng, 'image/png');

  const asset = await prisma.protectedProductAsset.create({
    data: {
      shopId: input.shopId,
      productId: input.productId ?? null,
      licenceId: licence.id,
      masterKey,
      masterDigest,
      widthPx: raster.width,
      heightPx: raster.height,
      // The smallest this master could have been and still have cleared the ingest gate. It
      // records why the asset is usable; it is not a floor on placement. Placement only ever
      // scales down — `placeInSafeZone` clamps at 1 — and downscaling invents no detail. The
      // earlier rule, half the master's native width, was contradicted by every correct
      // placement: real bottles land between 0.30 and 0.56 of native across the four formats.
      minUsableWidthPx: Math.round(required * (raster.width / raster.height)),
      // No region, no reference. A colour baseline read off a guessed rectangle would make the
      // ΔE guard measure the wrong pixels while looking like it worked.
      colourReference: input.labelRegion
        ? ((await colourReferenceFor(input.masterPng, input.labelRegion)) as never)
        : undefined,
      sourceUrl: input.provenance?.sourceUrl ?? null,
      sourceKind: input.provenance?.sourceKind ?? null,
      subjectProfile: (input.observations?.subjectProfile ?? null) as never,
      cutout: (input.observations?.cutout ?? null) as never,
      groundTruth: (input.observations?.groundTruth ?? null) as never,
      needsReview: (input.reviewReasons?.length ?? 0) > 0,
      reviewReasons: input.reviewReasons ?? [],
    },
  });

  // Two masks: the whole product from its alpha, and the label drawn tighter.
  const product = maskFromAlpha(raster);
  const productKey = `protected/${asset.id}/product-mask.png`;
  const productPng = await encodeMask(product);
  await storage().put(productKey, productPng, 'image/png');

  const { dilatePx } = await inpaintMask(input.masterPng);

  const maskRows = [
    {
      shopId: input.shopId,
      assetId: asset.id,
      kind: 'PRODUCT' as const,
      maskKey: productKey,
      regionDigest: createHash('sha256').update(productPng).digest('hex'),
      bounds: (maskBounds(product) ?? {}) as never,
      dilatePx,
    },
  ];

  if (input.labelRegion) {
    const labelPx = {
      x: Math.round(input.labelRegion.x * raster.width),
      y: Math.round(input.labelRegion.y * raster.height),
      w: Math.round(input.labelRegion.w * raster.width),
      h: Math.round(input.labelRegion.h * raster.height),
    };
    const label = maskFromRect(raster.width, raster.height, labelPx);
    const labelKey = `protected/${asset.id}/label-mask.png`;
    const labelPng = await encodeMask(label);
    await storage().put(labelKey, labelPng, 'image/png');
    maskRows.push({
      shopId: input.shopId,
      assetId: asset.id,
      kind: 'LABEL' as never,
      maskKey: labelKey,
      regionDigest: createHash('sha256').update(labelPng).digest('hex'),
      bounds: input.labelRegion as never,
      dilatePx,
    });
  }

  await prisma.assetMask.createMany({ data: maskRows });

  // MASKED means ready to stage. Without a label region the master is only INGESTED: it is held,
  // digested and masked to its silhouette, but `compositeForPlatform` already refuses to stage an
  // asset with no label region, so it waits for somebody to draw one.
  if (input.labelRegion) {
    await prisma.protectedProductAsset.update({
      where: { id: asset.id },
      data: { status: 'MASKED' },
    });
  }

  await recordAudit(prisma, {
    shopId: input.shopId,
    action: 'media.ingested',
    targetType: 'ProtectedProductAsset',
    targetId: asset.id,
    actorUserId: input.actor.userId,
    after: {
      masterDigest: masterDigest.slice(0, 12),
      dimensions: `${raster.width}x${raster.height}`,
      licence: input.licence.kind,
      dilatePx,
      source: input.provenance?.sourceKind ?? 'uploaded',
      needsReview: (input.reviewReasons?.length ?? 0) > 0,
      reviewReasons: input.reviewReasons ?? [],
    },
  });

  return { ok: true, assetId: asset.id, alreadyPresent: false };
}

export interface CompositeInputForApp {
  shopId: string;
  actor: Principal;
  assetId: string;
  platform: Platform;
  format: FormatKey;
  /** An environment image. Generated by a provider when one is configured. */
  environmentPng?: Uint8Array;
}

export type CompositeResult =
  | { ok: true; mediaAssetId: string; verification: string; geometryVerdict: string }
  | { ok: false; error: string };

/**
 * Composites a verified product over an environment, measures it, and records both.
 *
 * The environment comes from an ImageEditingProvider given the *inverse of a dilated* product
 * mask, so the model may not paint within the buffer of the silhouette. With no provider
 * configured, the caller supplies one — and if neither, this refuses rather than inventing a
 * background.
 */
export async function compositeForPlatform(input: CompositeInputForApp): Promise<CompositeResult> {
  const asset = await prisma.protectedProductAsset.findFirst({
    where: { id: input.assetId, shopId: input.shopId },
    include: { masks: true },
  });
  if (!asset) return { ok: false, error: 'That protected asset does not exist in this shop.' };

  const labelMask = asset.masks.find((mask) => mask.kind === 'LABEL');
  if (!labelMask) return { ok: false, error: 'This asset has no label region drawn yet.' };

  const masterPng = await storage().get(asset.masterKey);
  if (!masterPng) return { ok: false, error: 'The master file is missing from storage.' };

  // The approved artwork is the bytes that were hashed at ingestion, not whatever now sits at
  // that key. Storage is outside the database's immutability trigger, so the digest is
  // recomputed here and a mismatch stops the composite: an altered product layer must never
  // reach a reviewer, not even carrying a FAIL.
  const storedDigest = createHash('sha256').update(Buffer.from(masterPng)).digest('hex');
  if (storedDigest !== asset.masterDigest) {
    await recordAudit(prisma, {
      shopId: input.shopId,
      action: 'media.verification_failed',
      targetType: 'ProtectedProductAsset',
      targetId: asset.id,
      actorUserId: input.actor.userId,
      after: {
        check: 'master_integrity',
        recordedDigest: asset.masterDigest.slice(0, 12),
        storedDigest: storedDigest.slice(0, 12),
      },
    });
    return {
      ok: false,
      error: `The master in storage does not match the artwork approved at ingestion (recorded ${asset.masterDigest.slice(0, 12)}, found ${storedDigest.slice(0, 12)}). Nothing was composited. Re-ingest the artwork you intend to use.`,
    };
  }

  const environment = input.environmentPng;
  if (!environment) {
    const adapter = resolveAdapter(
      'ImageEditingProvider',
      process.env.PROVIDER_IMAGE_EDIT ?? 'mock',
    );
    const capabilities = await adapter.capabilities();
    return {
      ok: false,
      error: `No environment was supplied and no image provider can generate one: ${capabilities[0]?.reason ?? 'unavailable'}`,
    };
  }

  const platformFormat = formatFor(input.platform, input.format);
  const output = { width: platformFormat.render.w, height: platformFormat.render.h };
  const placement = placeInSafeZone({
    format: platformFormat,
    output,
    product: { width: asset.widthPx, height: asset.heightPx },
  });

  // A composite never resamples the protected layer. Where the product has to be smaller, a
  // rendition is made once, recorded, and composited at scale 1 — because at a downscale
  // pixel identity cannot run, OCR reads identical content two different ways, and the
  // structural check does not separate a changed digit from an honest resample.
  const source =
    placement.scale === 1
      ? { png: masterPng, asset }
      : await renditionFor({
          shopId: input.shopId,
          asset,
          masterPng,
          width: Math.round(asset.widthPx * placement.scale),
          height: Math.round(asset.heightPx * placement.scale),
          labelRegion: labelMask.bounds as unknown as Region,
          approvedColour: asset.colourReference as never,
        });
  if (!source) {
    return {
      ok: false,
      error: `A rendition of this master at ${Math.round(asset.widthPx * placement.scale)}px wide did not hold the approved label colour, so it was not used. Supply a master closer to the delivered size.`,
    };
  }

  const built = await composite({
    masterPng: source.png,
    environmentPng: environment,
    spec: {
      output,
      transform: { x: placement.x, y: placement.y, scale: 1 },
      kernel: 'lanczos3',
    },
  });

  const report = await verifyComposite({
    masterPng: source.png,
    composite: built,
    labelRegion: labelMask.bounds as unknown as Region,
    approvedColour: source.asset.colourReference as never,
  });

  const reading = measure({
    format: platformFormat,
    masterAspect: output.width / output.height,
    focal: { x: placement.focal.x, y: placement.focal.y, r: 0.08 },
  });

  const objectKey = `composites/${asset.id}/${input.platform}-${input.format}.png`;
  await storage().put(objectKey, built.png, 'image/png');

  const media = await prisma.mediaAsset.create({
    data: {
      shopId: input.shopId,
      sourceAssetId: asset.id,
      kind: 'COMPOSITE_STILL',
      objectKey,
      contentType: 'image/png',
      widthPx: output.width,
      heightPx: output.height,
      compositeSpec: {
        masterDigest: source.asset.masterDigest,
        renditionOf: source.asset.renditionOfId,
        maskDigest: labelMask.regionDigest,
        transform: built.spec.transform,
        kernel: built.spec.kernel,
        output,
      } as never,
      verification:
        report.outcome === 'PASS' ? 'PASSED' : report.outcome === 'FAIL' ? 'FAILED' : 'INCOMPLETE',
      verificationReport: report as never,
      geometry: reading as never,
    },
  });

  if (report.diffPng) {
    const diffKey = `composites/${asset.id}/${input.platform}-${input.format}-diff.png`;
    await storage().put(diffKey, report.diffPng, 'image/png');
    await prisma.mediaAsset.create({
      data: {
        shopId: input.shopId,
        sourceAssetId: asset.id,
        kind: 'DIFF_OVERLAY',
        objectKey: diffKey,
        contentType: 'image/png',
        verification: 'NOT_APPLICABLE',
      },
    });
  }

  await recordAudit(prisma, {
    shopId: input.shopId,
    action: report.outcome === 'PASS' ? 'media.verified' : 'media.verification_failed',
    targetType: 'MediaAsset',
    targetId: media.id,
    actorUserId: input.actor.userId,
    after: {
      platform: input.platform,
      format: input.format,
      verification: report.outcome,
      failedChecks: report.checks
        .filter((check) => check.outcome === 'FAIL')
        .map((check) => check.check),
      geometry: reading.verdict,
      worstViewport: reading.worstViewport,
    },
  });

  return {
    ok: true,
    mediaAssetId: media.id,
    verification: report.outcome,
    geometryVerdict: reading.verdict,
  };
}

/**
 * A rendition of an approved master at a smaller size: made once, recorded with its own digest,
 * and reused.
 *
 * A rendition is never given a colour reference of its own. Re-reading the approved colour off a
 * resampled copy would make the colour check circular — a tinted master would quietly become its
 * own baseline. Measured here, lanczos3 moves the label by ΔE2000 0.03–0.06 while a visible tint
 * reads 8.6–10.9, so the rendition is held to the *master's* approved colour and carries it
 * forward. Returns null when it does not hold it, rather than lowering the bar.
 */
async function renditionFor(input: {
  shopId: string;
  asset: { id: string; masterDigest: string; licenceId: string; productId: string | null };
  masterPng: Uint8Array;
  width: number;
  height: number;
  labelRegion: Region;
  approvedColour: Lab | null;
}): Promise<{
  png: Uint8Array;
  asset: { masterDigest: string; renditionOfId: string | null; colourReference: unknown };
} | null> {
  const existing = await prisma.protectedProductAsset.findFirst({
    where: { shopId: input.shopId, renditionOfId: input.asset.id, widthPx: input.width },
  });
  if (existing) {
    const png = await storage().get(existing.masterKey);
    if (png) {
      const digest = createHash('sha256').update(Buffer.from(png)).digest('hex');
      // A cached rendition gets the same treatment as a master: it is only reusable while its
      // bytes still match what was recorded.
      if (digest === existing.masterDigest) {
        return {
          png,
          asset: {
            masterDigest: existing.masterDigest,
            renditionOfId: existing.renditionOfId,
            colourReference: existing.colourReference,
          },
        };
      }
    }
  }

  const rendition = await createRendition(
    input.masterPng,
    { width: input.width, height: input.height },
    'lanczos3',
    input.asset.masterDigest,
  );

  const rendered = await colourReferenceFor(rendition.png, input.labelRegion);
  if (input.approvedColour && rendered) {
    const drift = deltaE2000(input.approvedColour, rendered);
    if (drift > RENDITION_MAX_DELTA_E) return null;
  }

  const digest = createHash('sha256').update(rendition.png).digest('hex');
  const key = `protected/${input.asset.id}/rendition-${input.width}x${input.height}.png`;
  await storage().put(key, rendition.png, 'image/png');

  const row = await prisma.protectedProductAsset.create({
    data: {
      shopId: input.shopId,
      productId: input.asset.productId,
      licenceId: input.asset.licenceId,
      renditionOfId: input.asset.id,
      status: 'MASKED',
      masterKey: key,
      masterDigest: digest,
      widthPx: rendition.width,
      heightPx: rendition.height,
      minUsableWidthPx: rendition.width,
      // The master's approved colour, carried forward rather than re-read.
      colourReference: (input.approvedColour ?? null) as never,
    },
  });

  return {
    png: rendition.png,
    asset: {
      masterDigest: row.masterDigest,
      renditionOfId: row.renditionOfId,
      colourReference: row.colourReference,
    },
  };
}

/**
 * Queues a composite instead of doing one.
 *
 * Compositing decodes a master, builds masks, runs a deterministic alpha-over, reads the label
 * with OCR twice and measures colour in Lab — seconds of work, and more on a large packshot.
 * Inside a loader that is a response held open until a gateway gives up, which is why ADR 0012
 * called it an operational risk. The request now returns a job id and ends.
 *
 * The environment is written to storage first, because a job payload travels through Redis and
 * a megabyte of PNG does not belong in it.
 */
export async function queueComposite(input: {
  shopId: string;
  actor: Principal;
  assetId: string;
  platform: Platform;
  format: FormatKey;
  environmentPng?: Uint8Array;
}): Promise<{ ok: true; jobId: string; queued: boolean } | { ok: false; error: string }> {
  const asset = await prisma.protectedProductAsset.findFirst({
    where: { id: input.assetId, shopId: input.shopId },
    select: { id: true },
  });
  if (!asset) return { ok: false, error: 'That protected asset does not exist in this shop.' };

  let environmentKey: string | null = null;
  let environmentDigest = 'none';
  if (input.environmentPng) {
    environmentDigest = createHash('sha256')
      .update(Buffer.from(input.environmentPng))
      .digest('hex');
    environmentKey = `environments/${environmentDigest.slice(0, 16)}.png`;
    await storage().put(environmentKey, input.environmentPng, 'image/png');
  }

  const key = compositeIdempotencyKey({
    shopId: input.shopId,
    assetId: input.assetId,
    platform: input.platform,
    format: input.format,
    environmentDigest,
  });

  const existing = await prisma.renderJob.findUnique({
    where: { shopId_idempotencyKey: { shopId: input.shopId, idempotencyKey: key } },
  });
  if (existing) return { ok: true, jobId: existing.id, queued: false };

  const job = await prisma.renderJob.create({
    data: {
      shopId: input.shopId,
      kind: 'COMPOSITE',
      // The same three fields a render carries, so one screen can show both kinds of work.
      compositionId: `composite:${input.platform}-${input.format}`,
      props: {
        assetId: input.assetId,
        platform: input.platform,
        format: input.format,
        environmentKey,
      } as never,
      idempotencyKey: key,
      requestedByUserId: input.actor.userId,
    },
  });

  const payload: CompositePayload = {
    shopId: input.shopId,
    jobId: job.id,
    assetId: input.assetId,
    platform: input.platform,
    format: input.format,
    environmentKey,
    requestedByUserId: input.actor.userId,
  };

  await queue().enqueue(QUEUES.composite, payload, { jobId: key, maxAttempts: 2 });
  return { ok: true, jobId: job.id, queued: true };
}

/** Queues a render. Idempotent: the same composition and props cannot be rendered twice. */
export async function queueRender(input: {
  shopId: string;
  actor: Principal;
  compositionId: string;
  props: Record<string, unknown>;
  campaignId?: string | null;
  variantId?: string | null;
}): Promise<{ ok: true; renderJobId: string; queued: boolean } | { ok: false; error: string }> {
  const propsDigest = createHash('sha256').update(canonicalise(input.props)).digest('hex');
  const key = renderIdempotencyKey({
    shopId: input.shopId,
    compositionId: input.compositionId,
    propsDigest,
  });

  const existing = await prisma.renderJob.findUnique({
    where: { shopId_idempotencyKey: { shopId: input.shopId, idempotencyKey: key } },
  });
  if (existing) return { ok: true, renderJobId: existing.id, queued: false };

  const job = await prisma.renderJob.create({
    data: {
      shopId: input.shopId,
      campaignId: input.campaignId ?? null,
      variantId: input.variantId ?? null,
      compositionId: input.compositionId,
      props: input.props as never,
      idempotencyKey: key,
      requestedByUserId: input.actor.userId,
    },
  });

  const payload: RenderPayload = {
    shopId: input.shopId,
    renderJobId: job.id,
    compositionId: input.compositionId,
    props: input.props,
    outputKey: `renders/${job.id}.mp4`,
  };

  await queue().enqueue(QUEUES.render, payload, { jobId: key, maxAttempts: 2 });
  return { ok: true, renderJobId: job.id, queued: true };
}

export async function cancelRender(shopId: string, renderJobId: string): Promise<boolean> {
  const job = await prisma.renderJob.findFirst({ where: { id: renderJobId, shopId } });
  if (!job || job.state === 'SUCCEEDED' || job.state === 'FAILED') return false;
  await prisma.renderJob.update({ where: { id: job.id }, data: { state: 'CANCELLED' } });
  return true;
}
