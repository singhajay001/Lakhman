import { prisma, recordAudit } from '@spirithaus/db';
import {
  PLATFORMS,
  requiredKeysFor,
  canHoldKey,
  type Platform,
  type Principal,
  type RoleKey,
} from '@spirithaus/domain';
import { approvalContextHash, variantHash } from '@spirithaus/domain/server';
import { isHighRisk, runCompliance, RULESET_VERSION, type Report } from '@spirithaus/compliance';
import { assessQuality, buildStrategy, generateVariant, simhash } from '@spirithaus/content';
import { resolveAdapter, type TextGenerationProvider } from '@spirithaus/providers';
import { brandRulesFrom, ensureBrandKit, readinessFor } from './brand-kit.server.js';
import { buildFactSheetFor } from './research.server.js';

function textProvider(): TextGenerationProvider {
  const adapter = resolveAdapter('TextGenerationProvider', process.env.PROVIDER_TEXT ?? 'mock');
  return adapter as TextGenerationProvider;
}

export interface CreateCampaignInput {
  shopId: string;
  actor: Principal;
  name: string;
  objective: string;
  productIds: string[];
  platforms: Platform[];
  occasion?: string | null;
  offerTerms?: string | null;
}

export type CreateCampaignResult =
  | {
      ok: true;
      campaignId: string;
      generated: Platform[];
      failed: { platform: Platform; reason: string }[];
    }
  | { ok: false; error: string };

/**
 * Creates a campaign and generates one variant per platform.
 *
 * The order matters and is the substance of section 12: the fact sheet is frozen first,
 * one strategy is built from it, and every platform variant is derived from that strategy
 * independently. Nothing copies a caption from one platform to another.
 */
export async function createCampaign(input: CreateCampaignInput): Promise<CreateCampaignResult> {
  const brandKit = await ensureBrandKit(input.shopId, input.actor);
  if ('error' in brandKit) return { ok: false, error: brandKit.error };

  const readiness = readinessFor(brandKit.version);
  const brand = brandRulesFrom(brandKit.version);

  const products = await prisma.shopifyProduct.findMany({
    where: { shopId: input.shopId, id: { in: input.productIds } },
    include: { variants: true },
  });
  if (products.length === 0)
    return { ok: false, error: 'Select at least one product that exists in the mirror.' };

  const factSheet = await buildFactSheetFor(input.shopId, input.productIds);
  const first = products[0];
  const landingUrl =
    first?.onlineStoreUrl ??
    `https://${(await prisma.shop.findUniqueOrThrow({ where: { id: input.shopId } })).domain}/products/${first?.handle ?? ''}`;

  const strategy = buildStrategy({
    campaignName: input.name,
    objective: input.objective,
    landingUrl,
    platforms: input.platforms,
    factSheet,
    occasion: input.occasion ?? null,
  });

  const campaign = await prisma.campaign.create({
    data: {
      shopId: input.shopId,
      name: input.name,
      objective: input.objective as never,
      brandKitVersionId: brandKit.version.id,
      landingUrl,
      offerTerms: input.offerTerms ?? null,
      createdByUserId: input.actor.userId,
      products: {
        create: products.map((product) => ({
          shopId: input.shopId,
          productId: product.id,
          snapshot: {
            title: product.title,
            status: product.status,
            handle: product.handle,
            onlineStoreUrl: product.onlineStoreUrl,
            prices: product.variants.map((variant) => variant.price.toString()),
            compareAtPrices: product.variants
              .map((variant) => variant.compareAtPrice?.toString() ?? null)
              .filter(Boolean),
            availableForSale: product.variants.some((variant) => variant.availableForSale),
            inventory: product.variants.reduce(
              (total, variant) => total + variant.inventoryQuantity,
              0,
            ),
            snapshotAt: new Date().toISOString(),
          },
        })),
      },
      brief: {
        create: {
          shopId: input.shopId,
          strategy: strategy as unknown as object,
          factSheet: factSheet as unknown as object,
        },
      },
    },
  });

  await recordAudit(prisma, {
    shopId: input.shopId,
    action: 'campaign.created',
    targetType: 'Campaign',
    targetId: campaign.id,
    actorUserId: input.actor.userId,
    after: {
      name: input.name,
      objective: input.objective,
      platforms: input.platforms,
      products: input.productIds,
      brandKitVersion: brandKit.version.version,
      brandKitUsable: readiness.usable,
      approvedFacts: factSheet.facts.length,
      excludedClaims: factSheet.excluded.length,
    },
  });

  const provider = textProvider();
  const generated: Platform[] = [];
  const failed: { platform: Platform; reason: string }[] = [];

  for (const platform of input.platforms) {
    const draft = await generateVariant({
      platform,
      strategy,
      factSheet,
      brand,
      campaignId: campaign.id,
      provider,
    });

    if (!draft.ok) {
      failed.push({ platform, reason: draft.error.reason });
      continue;
    }

    const value = draft.value;
    const hash = variantHash({
      platform,
      content: value.content,
      primaryCopy: value.primaryCopy,
      callToAction: value.callToAction,
      hashtags: value.hashtags,
      altText: value.altText,
      destinationUrl: value.destinationUrl,
    });

    const variant = await prisma.contentVariant.create({
      data: {
        shopId: input.shopId,
        campaignId: campaign.id,
        platform,
        content: value.content as unknown as object,
        primaryCopy: value.primaryCopy,
        callToAction: value.callToAction,
        hashtags: value.hashtags,
        altText: value.altText,
        destinationUrl: value.destinationUrl,
        contentHash: hash,
        generation: value.generation as unknown as object,
      },
    });

    const fingerprint = simhash(value.primaryCopy);
    await prisma.contentSimilarityRecord.create({
      data: {
        shopId: input.shopId,
        variantId: variant.id,
        kind: 'copy',
        // Prisma's Bytes wants a plain Uint8Array; a Buffer's backing store is wider.
        hash: new Uint8Array(fingerprint.hash),
        bucket0: fingerprint.buckets[0],
        bucket1: fingerprint.buckets[1],
        bucket2: fingerprint.buckets[2],
        bucket3: fingerprint.buckets[3],
      },
    });

    await runComplianceFor(input.shopId, variant.id);
    generated.push(platform);
  }

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { state: failed.length === input.platforms.length ? 'DRAFT' : 'COMPLIANCE_REVIEW' },
  });

  await recordAudit(prisma, {
    shopId: input.shopId,
    action: 'campaign.variants_generated',
    targetType: 'Campaign',
    targetId: campaign.id,
    actorUserId: input.actor.userId,
    after: { generated, failed },
  });

  return { ok: true, campaignId: campaign.id, generated, failed };
}

/**
 * Runs the ruleset over a variant and records every result — passing ones included, so
 * the report shows what was checked rather than only what failed.
 */
export async function runComplianceFor(shopId: string, variantId: string): Promise<Report | null> {
  const variant = await prisma.contentVariant.findFirst({
    where: { id: variantId, shopId },
    include: {
      campaign: { include: { brief: true, brandKitVersion: true, approvals: true } },
    },
  });
  if (!variant?.campaign.brief) return null;

  const brandKitVersion = variant.campaign.brandKitVersion;
  const brand = brandKitVersion
    ? brandRulesFrom(brandKitVersion)
    : { prohibitedPhrases: [], approvedBrandVariations: [], responsibleConsumptionLine: null };

  const content = variant.content as Record<string, unknown>;
  const report = runCompliance({
    platform: variant.platform as Platform,
    fields: textFieldsOf(variant.primaryCopy, variant.altText, content),
    hashtags: variant.hashtags,
    factSheet: variant.campaign.brief.factSheet as never,
    components: componentsOf(content),
    paid: false,
    offerTerms: variant.campaign.offerTerms,
    competitionApproved: variant.campaign.approvals.some(
      (approval) => approval.kind === 'COMPETITION' && approval.outcome === 'GRANTED',
    ),
    brand,
  });

  await prisma.complianceCheck.deleteMany({ where: { shopId, variantId } });
  await prisma.complianceCheck.createMany({
    data: report.findings.map((finding) => ({
      shopId,
      campaignId: variant.campaignId,
      variantId: variant.id,
      ruleId: finding.ruleId,
      ruleVersion: RULESET_VERSION,
      category: finding.category,
      severity: finding.severity,
      outcome: finding.outcome,
      explanation: finding.explanation,
      evidence: finding.evidence as unknown as object,
      suggestion: finding.suggestion,
    })),
  });

  const assessment = assessQuality({
    platform: variant.platform as Platform,
    primaryCopy: variant.primaryCopy,
    hashtags: variant.hashtags,
    altText: variant.altText,
    destinationUrl: variant.destinationUrl,
    components: componentsOf(content),
    keywordCluster:
      ((variant.campaign.brief.strategy as Record<string, unknown>).keywordCluster as string[]) ??
      [],
    factSheet: variant.campaign.brief.factSheet as never,
    compliance: report,
    nearestDuplicateBits: null,
  });

  await prisma.contentVariant.update({
    where: { id: variant.id },
    // qualityScores is immaterial, so this write does not invalidate an approval — the
    // trigger only watches the fields a reader sees.
    data: { qualityScores: assessment as unknown as object },
  });

  return report;
}

export interface SubmitInput {
  shopId: string;
  actor: Principal;
  variantId: string;
}

export type SubmitResult =
  { ok: true; approvalId: string; requiredKeys: 1 | 2 } | { ok: false; error: string };

/** Creates the approval, with the key requirement computed from the compliance result. */
export async function submitForApproval(input: SubmitInput): Promise<SubmitResult> {
  const variant = await prisma.contentVariant.findFirst({
    where: { id: input.variantId, shopId: input.shopId },
    include: {
      campaign: { include: { products: true, brandKitVersion: true } },
      checks: true,
    },
  });
  if (!variant) return { ok: false, error: 'That variant does not exist in this shop.' };
  if (!variant.contentHash) {
    return {
      ok: false,
      error: 'This variant has been edited since it was last hashed. Re-run its checks first.',
    };
  }

  const blocking = variant.checks.filter(
    (check) => check.outcome === 'FAIL' && check.severity === 'BLOCKING',
  );
  if (blocking.length > 0) {
    return {
      ok: false,
      error: `${blocking.length} blocking compliance finding(s) must be resolved, or accepted as a recorded exception, before this can be submitted: ${blocking
        .map((check) => check.ruleId)
        .join(', ')}.`,
    };
  }

  const highRisk = variant.checks.some(
    (check) =>
      check.outcome === 'FAIL' &&
      ['minors', 'health', 'consumption', 'safety', 'social_success'].includes(check.category),
  );

  const requirement = requiredKeysFor({ kind: 'ORGANIC_PUBLICATION', isHighRisk: highRisk });
  if (!requirement.ok) return { ok: false, error: requirement.reason };

  const contextHash = approvalContextHash({
    destinations: [`${variant.platform.toLowerCase()}:pending-connection`],
    brandKitVersionId: variant.campaign.brandKitVersionId,
    productSnapshots: variant.campaign.products.map((product) => product.snapshot),
  });

  const approval = await prisma.approval.create({
    data: {
      shopId: input.shopId,
      campaignId: variant.campaignId,
      variantId: variant.id,
      kind: 'ORGANIC_PUBLICATION',
      requiredKeys: requirement.keys,
      contentHash: variant.contentHash,
      context: {
        contextHash,
        destinations: [`${variant.platform.toLowerCase()}:pending-connection`],
        note: 'No social connection exists yet, so the destination is recorded as pending. Publication is Phase 4.',
        brandKitVersionId: variant.campaign.brandKitVersionId,
        productSnapshots: variant.campaign.products.map((product) => product.snapshot),
        complianceRuleset: RULESET_VERSION,
        highRisk,
        promptVersions: [
          (variant.generation as Record<string, unknown> | null)?.promptVersion ?? null,
        ],
      } as unknown as object,
      requestedByUserId: input.actor.userId,
    },
  });

  await prisma.contentVariant.update({
    where: { id: variant.id },
    data: { approvalState: 'PENDING' },
  });

  await recordAudit(prisma, {
    shopId: input.shopId,
    action: 'campaign.submitted_for_approval',
    targetType: 'Approval',
    targetId: approval.id,
    actorUserId: input.actor.userId,
    after: {
      variantId: variant.id,
      requiredKeys: requirement.keys,
      highRisk,
      why: requirement.requirement.why,
    },
  });

  return { ok: true, approvalId: approval.id, requiredKeys: requirement.keys };
}

export type SignResult = { ok: true; granted: boolean } | { ok: false; error: string };

/**
 * Signs one key. The eligibility check here explains the refusal; the database refuses it
 * too, which is what makes one person signing twice impossible rather than discouraged.
 */
export async function signApprovalKey(input: {
  shopId: string;
  actor: Principal;
  approvalId: string;
  note?: string;
}): Promise<SignResult> {
  const approval = await prisma.approval.findFirst({
    where: { id: input.approvalId, shopId: input.shopId },
    include: { keys: true, variant: true },
  });
  if (!approval) return { ok: false, error: 'That approval does not exist in this shop.' };
  if (approval.outcome !== 'PENDING') {
    return {
      ok: false,
      error: `This approval is ${approval.outcome.toLowerCase()} and cannot take another key.`,
    };
  }
  if (approval.variant && approval.variant.contentHash !== approval.contentHash) {
    return {
      ok: false,
      error:
        'The content has changed since this approval was requested, so there is nothing valid to sign. Re-run the checks and submit again.',
    };
  }

  const requirement = requiredKeysFor({
    kind: approval.kind as never,
    isHighRisk: approval.requiredKeys === 2,
  });
  if (!requirement.ok) return { ok: false, error: requirement.reason };

  const keyIndex = (approval.keys.length + 1) as 1 | 2;
  const eligibility = canHoldKey({
    requirement: requirement.requirement,
    keyIndex,
    roles: input.actor.roles as RoleKey[],
    userId: input.actor.userId,
    alreadySignedBy: approval.keys.map((key) => key.userId),
  });
  if (!eligibility.eligible) return { ok: false, error: eligibility.reason };

  await prisma.approvalKey.create({
    data: {
      shopId: input.shopId,
      approvalId: approval.id,
      userId: input.actor.userId,
      keyIndex,
      role: eligibility.role,
      signedHash: approval.contentHash,
      note: input.note ?? null,
    },
  });

  const after = await prisma.approval.findUniqueOrThrow({ where: { id: approval.id } });

  await recordAudit(prisma, {
    shopId: input.shopId,
    action: after.outcome === 'GRANTED' ? 'approval.granted' : 'approval.key_signed',
    targetType: 'Approval',
    targetId: approval.id,
    actorUserId: input.actor.userId,
    after: {
      keyIndex,
      role: eligibility.role,
      signedHash: approval.contentHash.slice(0, 12),
      outcome: after.outcome,
    },
  });

  if (after.outcome === 'GRANTED') {
    await prisma.campaign.update({
      where: { id: approval.campaignId },
      data: { state: 'APPROVED' },
    });
  }

  return { ok: true, granted: after.outcome === 'GRANTED' };
}

// --- helpers ------------------------------------------------------------------

/** Every readable string on the variant, named, so evidence can point at the right one. */
function textFieldsOf(
  primaryCopy: string,
  altText: string | null,
  content: Record<string, unknown>,
): { name: string; value: string }[] {
  const fields = [{ name: 'primaryCopy', value: primaryCopy }];
  if (altText) fields.push({ name: 'altText', value: altText });

  for (const [key, value] of Object.entries(content)) {
    if (typeof value === 'string' && value.trim().length > 0) fields.push({ name: key, value });
    else if (Array.isArray(value)) {
      const strings = value.filter((item): item is string => typeof item === 'string');
      if (strings.length > 0) fields.push({ name: key, value: strings.join(' — ') });
    }
  }
  return fields;
}

function componentsOf(content: Record<string, unknown>): string[] {
  return Object.entries(content)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key]) => key);
}

export { PLATFORMS, isHighRisk };

/**
 * Saves an edit to the copy and re-runs the checks.
 *
 * The hash is computed here rather than in the route, so the only place that decides what
 * a variant hashes to is the service layer. What the edit does to the approval is the
 * database's decision, not this function's.
 */
export async function editVariantCopy(input: {
  shopId: string;
  actor: Principal;
  variantId: string;
  primaryCopy: string;
}): Promise<{ ok: true; invalidated: boolean } | { ok: false; error: string }> {
  const variant = await prisma.contentVariant.findFirst({
    where: { id: input.variantId, shopId: input.shopId },
  });
  if (!variant) return { ok: false, error: 'That variant does not exist in this shop.' };

  const hash = variantHash({
    platform: variant.platform,
    content: variant.content,
    primaryCopy: input.primaryCopy,
    callToAction: variant.callToAction,
    hashtags: variant.hashtags,
    altText: variant.altText,
    destinationUrl: variant.destinationUrl,
  });

  const updated = await prisma.contentVariant.update({
    where: { id: variant.id },
    data: { primaryCopy: input.primaryCopy, contentHash: hash },
  });

  await recordAudit(prisma, {
    shopId: input.shopId,
    action: 'campaign.variant_edited',
    targetType: 'ContentVariant',
    targetId: variant.id,
    actorUserId: input.actor.userId,
    before: { approvalState: variant.approvalState, revision: variant.revision },
    after: { approvalState: updated.approvalState, revision: updated.revision },
  });

  await runComplianceFor(input.shopId, variant.id);
  return { ok: true, invalidated: updated.approvalState === 'INVALIDATED' };
}
