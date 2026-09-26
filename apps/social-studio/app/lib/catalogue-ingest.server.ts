import { prisma, recordAudit } from '@spirithaus/db';
import type { Principal } from '@spirithaus/domain';
import { childLogger } from '@spirithaus/observability';
import {
  cropForReading,
  cutout,
  decode,
  trimToSubject,
  toPng,
  detectLabelRegion,
  subjectProfile,
  compareLabelText,
  normaliseLabelText,
  type CutoutResult,
  type Region,
  type SubjectProfile,
} from '@spirithaus/protected-assets';
import { requiredMasterHeightPx } from '@spirithaus/media-geometry';
import {
  parseAbv,
  parseVolumeMl,
  pickPrimaryImage,
  type CatalogueProduct,
  type CatalogueSource,
} from '@spirithaus/shopify';
import { ingestProtectedAsset } from './media.server.js';

/**
 * Ingesting real product artwork from the Shopify catalogue (section 15).
 *
 * The pipeline this feeds was proved on a synthetic bottle. Real packshots break several
 * assumptions that bottle never tested, and this module's job is to find that out per product and
 * write it down, rather than to push everything through and hope:
 *
 * - **Not every image is big enough.** 74 of this store's 238 products have a primary image under
 *   600px on an edge. The ingest gate refuses them; upscaling a master is not a thing this
 *   pipeline does.
 * - **Not every image has alpha.** Roughly a third are opaque JPEGs on white and need a cutout.
 * - **Not every image is one product.** Some are a bottle beside its gift box.
 * - **Not every label can be read.** Reversed-out type on clear glass gives OCR nothing, so no
 *   label region can be derived and a person has to draw one.
 *
 * Each of those is a recorded outcome on the asset, not an exception that stops the run.
 */

/**
 * The most generous the ingest gate can ever be: the height a square-ish subject needs. Used only
 * to skip an obviously-too-small image before downloading it. The real gate is aspect-aware and
 * runs on the trimmed master.
 */
const SMALLEST_USEFUL_EDGE_PX = Math.min(requiredMasterHeightPx(1), requiredMasterHeightPx(0.3));

export interface CatalogueIngestInput {
  shopId: string;
  actor: Principal;
  source: CatalogueSource;
  /**
   * The rights basis under which these images may be staged. Required, with no default: a
   * supplier's packshot is not automatically licensed for marketing use, and section 16 wants the
   * basis recorded rather than assumed. Whoever runs the sync asserts it.
   */
  licence: {
    kind: 'OWNED' | 'COMMISSIONED' | 'LICENSED';
    holder: string;
    terms: string;
    permittedUses: string[];
    evidenceUrl?: string | null;
  };
  limit?: number;
  /**
   * Restrict to these product types, case-insensitively. A liquor retailer ingesting artwork for
   * a spirits campaign has no use for 83 wine packshots, and reading fewer images is kinder to
   * the CDN than reading all of them and discarding most.
   */
  productTypes?: string[];
  /** Injected so the ingestion is testable without a network. */
  fetchImage?: (url: string) => Promise<Uint8Array>;
}

export type IngestOutcome =
  | { status: 'ingested'; assetId: string; needsReview: boolean; reviewReasons: string[] }
  | { status: 'already_present'; assetId: string }
  | { status: 'skipped'; reason: string };

export interface CatalogueIngestResult {
  source: string;
  considered: number;
  ingested: number;
  alreadyPresent: number;
  skipped: number;
  needingReview: number;
  products: { handle: string; title: string; outcome: IngestOutcome }[];
}

async function defaultFetchImage(url: string): Promise<Uint8Array> {
  const response = await fetch(url, { headers: { accept: 'image/*' } });
  if (!response.ok) throw new Error(`image request returned ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

/**
 * What OCR read off the master, and whether it agrees with what the catalogue says the product is.
 *
 * A disagreement is not treated as proof of anything. OCR drops glyphs — the Phase 3 tests pin a
 * case where it reads "700ML" as "700M" — so a mismatch marks the asset for review and says what
 * differed. Ground truth is stored either way, because later reads are compared against this one.
 */
export interface GroundTruth {
  labelText: string;
  meanConfidence: number;
  words: { text: string; confidence: number }[];
  catalogue: { abv: number | null; volumeMl: number | null };
  readFromLabel: { abv: number | null; volumeMl: number | null };
  agreement: {
    abv: 'match' | 'mismatch' | 'not_stated';
    volume: 'match' | 'mismatch' | 'not_stated';
  };
}

function agree(expected: number | null, read: number | null): 'match' | 'mismatch' | 'not_stated' {
  if (expected === null || read === null) return 'not_stated';
  return expected === read ? 'match' : 'mismatch';
}

export async function ingestCatalogueImages(
  input: CatalogueIngestInput,
): Promise<CatalogueIngestResult> {
  const log = childLogger({ job: 'shopify-asset-sync' });
  const fetchImage = input.fetchImage ?? defaultFetchImage;
  const limit = input.limit ?? 25;

  const wanted = input.productTypes?.map((type) => type.toLowerCase());
  // Over-read when filtering, because the source pages in catalogue order and the types are
  // interleaved; then cut to the limit that was asked for.
  const fetched = await input.source.products(wanted ? Math.max(limit * 10, 250) : limit);
  const products = (
    wanted
      ? fetched.filter((product) => wanted.includes((product.productType ?? '').toLowerCase()))
      : fetched
  ).slice(0, limit);

  const result: CatalogueIngestResult = {
    source: input.source.describe,
    considered: products.length,
    ingested: 0,
    alreadyPresent: 0,
    skipped: 0,
    needingReview: 0,
    products: [],
  };

  for (const product of products) {
    const outcome = await ingestOne(product, input, fetchImage, log);
    result.products.push({ handle: product.handle, title: product.title, outcome });
    if (outcome.status === 'ingested') {
      result.ingested += 1;
      if (outcome.needsReview) result.needingReview += 1;
    } else if (outcome.status === 'already_present') {
      result.alreadyPresent += 1;
    } else {
      result.skipped += 1;
    }
  }

  await recordAudit(prisma, {
    shopId: input.shopId,
    action: 'media.catalogue_synced',
    targetType: 'Shop',
    targetId: input.shopId,
    actorUserId: input.actor.userId,
    after: {
      source: result.source,
      considered: result.considered,
      ingested: result.ingested,
      alreadyPresent: result.alreadyPresent,
      skipped: result.skipped,
      needingReview: result.needingReview,
    },
  });

  return result;
}

async function ingestOne(
  product: CatalogueProduct,
  input: CatalogueIngestInput,
  fetchImage: (url: string) => Promise<Uint8Array>,
  log: ReturnType<typeof childLogger>,
): Promise<IngestOutcome> {
  const image = pickPrimaryImage(product);
  if (!image) return { status: 'skipped', reason: 'This product has no images.' };

  // The catalogue's own dimensions are a cheap way to avoid downloading something the gate will
  // refuse. They are not trusted: the bytes are measured again below.
  if (
    image.width !== null &&
    image.height !== null &&
    Math.max(image.width, image.height) < SMALLEST_USEFUL_EDGE_PX
  ) {
    return {
      status: 'skipped',
      reason: `The primary image is ${image.width}x${image.height}. Nothing that small can be staged at any format's size without upscaling.`,
    };
  }

  let downloaded: Uint8Array;
  try {
    downloaded = await fetchImage(image.url);
  } catch (error) {
    return {
      status: 'skipped',
      reason: `Could not download the primary image: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  // Normalise the container to PNG. The CDN serves whatever was uploaded, and a JPEG has no alpha
  // to composite with. This re-encode happens *before* the digest, so the digest identifies the
  // bytes this pipeline actually holds and can re-verify.
  let masterPng: Uint8Array;
  try {
    masterPng = await toPng(downloaded);
  } catch (error) {
    return {
      status: 'skipped',
      reason: `The downloaded file could not be decoded as an image: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const reviewReasons: string[] = [];

  let cutoutResult: CutoutResult;
  try {
    cutoutResult = await cutout(masterPng);
  } catch (error) {
    return {
      status: 'skipped',
      reason: `The cutout step failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (cutoutResult.applied) masterPng = cutoutResult.png;

  // The master is the product, not the product inside whatever canvas it was exported on. Done
  // before the digest, so the digest identifies the bytes the pipeline holds.
  const trim = await trimToSubject(masterPng);
  masterPng = trim.png;

  const raster = await decode(masterPng);

  const profile: SubjectProfile | null = subjectProfile(raster);
  if (!profile) {
    return {
      status: 'skipped',
      reason:
        'This image has no transparent background and none could be cut out, so there is no product silhouette to protect. It is probably a lifestyle photograph rather than a packshot.',
    };
  }
  if (!profile.singleSubject) reviewReasons.push(profile.reason);
  if (!cutoutResult.applied && cutoutResult.background !== null) {
    // The cutout declined for a stated reason on an image with no alpha of its own.
    reviewReasons.push(cutoutResult.reason);
  }

  // Read the label where it is, rather than where a label usually is.
  const crop = await cropForReading(masterPng, profile.bounds);

  const detection = await detectLabelRegion(masterPng, crop);

  // A master whose label OCR cannot read is still worth holding: it is stored, digested and
  // masked to its silhouette, and it waits in the queue for a person to draw the region. The
  // alternative — inventing a rectangle where a label usually sits — would give the colour guard
  // the wrong pixels to measure while looking like it had worked.
  let labelRegion: Region | null = null;
  let groundTruth: GroundTruth | null = null;

  if (!detection.ok) {
    reviewReasons.push(`No label region could be derived automatically. ${detection.error}`);
  } else {
    labelRegion = detection.value.region;
    const readAbv = parseAbv(detection.value.text);
    const readVolume = parseVolumeMl(detection.value.text);
    groundTruth = {
      labelText: detection.value.text,
      meanConfidence: detection.value.meanConfidence,
      words: detection.value.words,
      catalogue: product.metadata,
      readFromLabel: { abv: readAbv, volumeMl: readVolume },
      agreement: {
        abv: agree(product.metadata.abv, readAbv),
        volume: agree(product.metadata.volumeMl, readVolume),
      },
    };
  }

  if (groundTruth?.agreement.abv === 'mismatch') {
    reviewReasons.push(
      `The catalogue states ${product.metadata.abv}% ABV; the label reads ${groundTruth.readFromLabel.abv}%. One of them is wrong, or OCR misread a digit. A person should look before this artwork carries a strength claim.`,
    );
  }
  if (groundTruth?.agreement.volume === 'mismatch') {
    reviewReasons.push(
      `The catalogue states ${product.metadata.volumeMl}ml; the label reads ${groundTruth.readFromLabel.volumeMl}ml.`,
    );
  }

  // Link to the mirrored product where the catalogue is also synced, so the Media Studio can show
  // artwork beside the product it belongs to. Absence is normal and not an error.
  const mirrored = await prisma.shopifyProduct.findFirst({
    where: { shopId: input.shopId, handle: product.handle },
    select: { id: true },
  });

  const ingested = await ingestProtectedAsset({
    shopId: input.shopId,
    actor: input.actor,
    productId: mirrored?.id ?? null,
    masterPng,
    labelRegion,
    licence: {
      ...input.licence,
      terms: `${input.licence.terms} (Ingested from ${input.source.describe} for "${product.title}".)`,
    },
    provenance: { sourceUrl: image.url, sourceKind: input.source.describe },
    observations: {
      subjectProfile: profile,
      cutout: { ...summariseCutout(cutoutResult), trim },
      groundTruth,
    },
    reviewReasons,
  });

  if (!ingested.ok) return { status: 'skipped', reason: ingested.error };
  if (ingested.alreadyPresent) return { status: 'already_present', assetId: ingested.assetId };

  log.info(
    { handle: product.handle, needsReview: reviewReasons.length > 0 },
    'ingested a protected master from the catalogue',
  );

  return {
    status: 'ingested',
    assetId: ingested.assetId,
    needsReview: reviewReasons.length > 0,
    reviewReasons,
  };
}

/** The cutout's decision, without the pixels. */
function summariseCutout(result: CutoutResult): Record<string, unknown> {
  return {
    applied: result.applied,
    reason: result.reason,
    background: result.background,
    ...result.measurements,
  };
}

/**
 * Re-reads a stored master's label and compares it with the ground truth recorded at ingestion.
 *
 * This is the same comparison the composite verification makes, run against the master itself, so
 * a change in the stored artwork is visible even when nothing has been composited from it.
 */
export function compareWithGroundTruth(
  groundTruth: GroundTruth,
  currentText: string,
): ReturnType<typeof compareLabelText> {
  return compareLabelText(groundTruth.labelText, normaliseLabelText(currentText));
}
