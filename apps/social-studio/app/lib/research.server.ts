import { prisma, recordAudit } from '@spirithaus/db';
import {
  buildFactSheet,
  conflicts,
  type ClaimInput,
  type FactSheet,
  type Principal,
  type ProductTruth,
} from '@spirithaus/domain';

/**
 * The fact sheet a campaign is built against (sections 3 and 9).
 *
 * Product truth comes from the Shopify mirror; everything else comes only from APPROVED
 * research claims. The sheet is frozen onto the campaign brief at generation time, so
 * approving a claim afterwards cannot retroactively legitimise copy already written.
 */
export async function buildFactSheetFor(shopId: string, productIds: string[]): Promise<FactSheet> {
  const products = await prisma.shopifyProduct.findMany({
    where: { shopId, id: { in: productIds } },
    include: {
      variants: { orderBy: { position: 'asc' } },
      research: { include: { claims: { include: { source: true } } } },
    },
  });

  const truths: ProductTruth[] = products.map((product) => ({
    productId: product.id,
    title: product.title,
    vendor: product.vendor,
    productType: product.productType,
    handle: product.handle,
    onlineStoreUrl: product.onlineStoreUrl,
    prices: product.variants.map((variant) => variant.price.toString()),
    compareAtPrices: product.variants
      .map((variant) => variant.compareAtPrice?.toString())
      .filter((price): price is string => Boolean(price)),
    availableForSale: product.variants.some((variant) => variant.availableForSale),
    inventoryQuantity: product.variants.reduce(
      (total, variant) => total + variant.inventoryQuantity,
      0,
    ),
  }));

  const claims: ClaimInput[] = products.flatMap((product) =>
    (product.research?.claims ?? []).map((claim) => ({
      field: claim.field,
      value: claim.value,
      kind: claim.kind,
      status: claim.status,
      confidence: Number(claim.confidence),
      sourceUrl: claim.source?.url ?? null,
    })),
  );

  return buildFactSheet({ products: truths, claims });
}

export async function decideClaim(input: {
  shopId: string;
  claimId: string;
  decision: 'APPROVED' | 'REJECTED';
  reason?: string;
  actor: Principal;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const claim = await prisma.researchClaim.findFirst({
    where: { id: input.claimId, shopId: input.shopId },
    include: { research: true },
  });
  if (!claim) return { ok: false, error: 'That claim does not exist in this shop.' };

  // Section 9 forbids resolving a conflict automatically. A conflicted claim can be
  // rejected, but approving one requires the conflict to be dealt with first.
  if (claim.status === 'CONFLICTED' && input.decision === 'APPROVED') {
    return {
      ok: false,
      error:
        'This claim conflicts with another. Reject the one that is wrong, or record the disagreement, before approving either.',
    };
  }

  await prisma.researchClaim.update({
    where: { id: claim.id },
    data: {
      status: input.decision,
      reviewedByUserId: input.actor.userId,
      reviewedAt: new Date(),
      rejectionReason: input.decision === 'REJECTED' ? (input.reason ?? null) : null,
    },
  });

  await recordAudit(prisma, {
    shopId: input.shopId,
    action: input.decision === 'APPROVED' ? 'research.claim_approved' : 'research.claim_rejected',
    targetType: 'ResearchClaim',
    targetId: claim.id,
    actorUserId: input.actor.userId,
    before: { status: claim.status },
    after: { status: input.decision, field: claim.field, value: claim.value, reason: input.reason },
  });

  return { ok: true };
}

/** Flags claims that disagree, so the reviewer sees the conflict rather than one value. */
export async function markConflicts(shopId: string, researchId: string): Promise<number> {
  const claims = await prisma.researchClaim.findMany({ where: { shopId, researchId } });
  const byField = new Map<string, typeof claims>();
  for (const claim of claims) {
    byField.set(claim.field, [...(byField.get(claim.field) ?? []), claim]);
  }

  let marked = 0;
  for (const [field, group] of byField) {
    const values = new Set(group.map((claim) => claim.value.trim().toLowerCase()));
    const singleValued = [
      'abv',
      'age_statement',
      'vintage',
      'region',
      'country',
      'bottle_size',
      'producer',
    ];
    if (!singleValued.includes(field) || values.size < 2) continue;

    for (const claim of group) {
      if (claim.status === 'PENDING') {
        await prisma.researchClaim.update({
          where: { id: claim.id },
          data: {
            status: 'CONFLICTED',
            conflictsWithId: group.find((other) => other.id !== claim.id)?.id,
          },
        });
        marked += 1;
      }
    }
  }
  return marked;
}

export { conflicts };

export interface AddClaimInput {
  shopId: string;
  productId: string;
  actor: Principal;
  field: string;
  value: string;
  kind: 'VERIFIED' | 'INFERRED';
  confidence: number;
  sourceUrl: string;
  publisher?: string | null;
  excerpt?: string | null;
}

/**
 * Records a claim and the source it was read from.
 *
 * Manual entry, because no ResearchProvider is configured in this build: an automated
 * sourcing pass would need a search provider and a fetcher, and the app says so rather
 * than presenting an empty library as though nothing had been found. The shape is the
 * same either way — a claim always arrives with a source, a retrieval time and a
 * confidence, and always at PENDING.
 */
export async function addClaim(
  input: AddClaimInput,
): Promise<{ ok: true; claimId: string } | { ok: false; error: string }> {
  const product = await prisma.shopifyProduct.findFirst({
    where: { id: input.productId, shopId: input.shopId },
  });
  if (!product) return { ok: false, error: 'That product does not exist in this shop.' };

  let url: URL;
  try {
    url = new URL(input.sourceUrl);
  } catch {
    return { ok: false, error: 'The source must be a URL, so the claim can be checked later.' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, error: 'The source URL must be http or https.' };
  }

  const research = await prisma.productResearch.upsert({
    where: { productId: product.id },
    create: { shopId: input.shopId, productId: product.id, status: 'IN_REVIEW' },
    update: { status: 'IN_REVIEW' },
  });

  const source = await prisma.researchSource.create({
    data: {
      shopId: input.shopId,
      researchId: research.id,
      url: url.toString(),
      publisher: input.publisher ?? url.hostname,
      retrievedAt: new Date(),
      authority: authorityOf(url.hostname, product.vendor),
      excerpt: input.excerpt ?? null,
    },
  });

  const claim = await prisma.researchClaim.create({
    data: {
      shopId: input.shopId,
      researchId: research.id,
      field: input.field.trim().toLowerCase().replace(/\s+/g, '_'),
      value: input.value.trim(),
      kind: input.kind,
      // Always PENDING. Nothing enters copy without a human approving it.
      status: 'PENDING',
      confidence: Math.max(0, Math.min(1, input.confidence)).toFixed(2),
      sourceId: source.id,
    },
  });

  await markConflicts(input.shopId, research.id);

  await recordAudit(prisma, {
    shopId: input.shopId,
    action: 'research.submitted',
    targetType: 'ResearchClaim',
    targetId: claim.id,
    actorUserId: input.actor.userId,
    after: { field: claim.field, value: claim.value, source: url.hostname, kind: input.kind },
  });

  return { ok: true, claimId: claim.id };
}

/** Section 9 prefers primary sources, so where a claim came from is recorded, not scored. */
function authorityOf(hostname: string, vendor: string | null): string {
  const host = hostname.toLowerCase().replace(/^www\./, '');
  if (vendor && host.includes(vendor.toLowerCase().replace(/[^a-z0-9]/g, ''))) return 'producer';
  if (host.endsWith('.gov.au')) return 'regulator';
  if (host.endsWith('.edu.au')) return 'academic';
  return 'unknown';
}
