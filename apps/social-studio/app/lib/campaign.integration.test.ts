import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@spirithaus/db';
import { PLATFORMS, type Principal } from '@spirithaus/domain';
import { variantHash } from '@spirithaus/domain/server';
import {
  createCampaign,
  runComplianceFor,
  signApprovalKey,
  submitForApproval,
} from './campaign.server.js';
import { addClaim, decideClaim } from './research.server.js';

/**
 * Phase 2's exit gate, end to end against a real Postgres.
 *
 * Six genuinely different variants from one strategy; an unapproved fact cannot reach
 * copy; a caption edit invalidates its approval; a non-compliant draft is blocked with a
 * rule, a severity and evidence; dual control refuses a single user.
 */
const DOMAIN = 'phase2.myshopify.com';
let shopId: string;
let productId: string;
let creator: Principal;
let manager: Principal;
let reviewer: Principal;

const TRUNCATE =
  'TRUNCATE approval_key, approval, compliance_check, content_similarity_record, content_variant, campaign_brief, campaign_product, campaign, brand_kit_version, brand_kit, research_claim, research_source, product_research, shopify_variant, shopify_product, audit_event, "user", shop CASCADE';

beforeEach(async () => {
  await prisma.$executeRawUnsafe(TRUNCATE);
  const shop = await prisma.shop.create({ data: { domain: DOMAIN } });
  shopId = shop.id;

  const [c, m, r] = await Promise.all([
    prisma.user.create({ data: { shopId, email: 'creator@example.invalid' } }),
    prisma.user.create({ data: { shopId, email: 'manager@example.invalid' } }),
    prisma.user.create({ data: { shopId, email: 'reviewer@example.invalid' } }),
  ]);
  creator = { userId: c.id, shopId, roles: ['creator'] };
  manager = { userId: m.id, shopId, roles: ['campaign_manager'] };
  reviewer = { userId: r.id, shopId, roles: ['compliance_reviewer'] };

  const product = await prisma.shopifyProduct.create({
    data: {
      shopId,
      gid: 'gid://shopify/Product/1',
      handle: 'applewood-gin',
      title: 'Applewood Gin',
      productType: 'Gin',
      vendor: 'Applewood Distillery',
      status: 'ACTIVE',
      onlineStoreUrl: 'https://spirithaus.com.au/products/applewood-gin',
      variants: {
        create: {
          shopId,
          gid: 'gid://shopify/Variant/1',
          title: '700ml',
          price: '89.99',
          unitCost: '48.50',
          availableForSale: true,
          inventoryQuantity: 12,
        },
      },
    },
  });
  productId = product.id;
});

afterAll(async () => {
  await prisma.$executeRawUnsafe(TRUNCATE);
  await prisma.$disconnect();
});

const build = () =>
  createCampaign({
    shopId,
    actor: manager,
    name: 'Applewood Gin — spring serve',
    objective: 'PRODUCT_AWARENESS',
    productIds: [productId],
    platforms: [...PLATFORMS],
  });

describe('building a campaign', () => {
  it('generates one variant per platform, six of them genuinely different', async () => {
    const result = await build();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.failed).toEqual([]);
    expect(result.generated.sort()).toEqual([...PLATFORMS].sort());

    const variants = await prisma.contentVariant.findMany({ where: { shopId } });
    expect(variants).toHaveLength(6);
    expect(new Set(variants.map((variant) => variant.primaryCopy)).size).toBe(6);
    expect(new Set(variants.map((variant) => variant.contentHash)).size).toBe(6);
  });

  it('freezes the fact sheet and the strategy onto the brief', async () => {
    const result = await build();
    if (!result.ok) return;
    const brief = await prisma.campaignBrief.findUniqueOrThrow({
      where: { campaignId: result.campaignId },
    });
    const strategy = brief.strategy as Record<string, unknown>;
    expect(strategy.keyMessage).toContain('Applewood Gin');
    // Section 11 requires the exclusions on every campaign.
    expect(strategy.exclusions).toEqual(
      expect.arrayContaining([
        'anyone under 18',
        'audiences defined by consumption volume or frequency',
      ]),
    );
    expect((strategy.metrics as string[])[0]).toBe('contribution margin');
  });

  it('seeds the Brand Kit from the theme profile and records the version used', async () => {
    const result = await build();
    if (!result.ok) return;
    const campaign = await prisma.campaign.findUniqueOrThrow({
      where: { id: result.campaignId },
      include: { brandKitVersion: true },
    });
    expect(campaign.brandKitVersionId).not.toBeNull();
    const content = campaign.brandKitVersion?.content as Record<string, unknown>;
    expect((content.colours as { hex: string }[]).map((colour) => colour.hex)).toContain('#cf1c29');
    // The responsible-consumption line is a placeholder until an administrator confirms it.
    expect(campaign.brandKitVersion?.placeholders).toContain('responsibleConsumptionLine');
  });

  it('records every rule that ran, passing ones included', async () => {
    const result = await build();
    if (!result.ok) return;
    const checks = await prisma.complianceCheck.findMany({ where: { shopId } });
    expect(checks.length).toBeGreaterThan(6 * 15);
    expect(new Set(checks.map((check) => check.outcome))).toContain('PASS');
    expect(checks.every((check) => check.explanation.length > 50)).toBe(true);
  });

  it('scores every variant with reasons, and no blocking finding', async () => {
    const result = await build();
    if (!result.ok) return;
    const variants = await prisma.contentVariant.findMany({
      where: { shopId },
      include: { checks: true },
    });
    for (const variant of variants) {
      const quality = variant.qualityScores as {
        dimensions: { reason: string }[];
        caveat: string;
      } | null;
      expect(quality?.dimensions.length, variant.platform).toBe(10);
      expect(quality?.caveat).toContain('not a prediction');

      const blocking = variant.checks.filter(
        (check) => check.outcome === 'FAIL' && check.severity === 'BLOCKING',
      );
      expect(
        blocking.map((check) => check.ruleId),
        variant.platform,
      ).toEqual([]);
    }
  });

  it('fingerprints the copy for near-duplicate detection', async () => {
    await build();
    const records = await prisma.contentSimilarityRecord.findMany({ where: { shopId } });
    expect(records).toHaveLength(6);
    expect(records[0]?.hash.length).toBe(8);
  });
});

describe('an unapproved fact cannot reach copy', () => {
  it('blocks an ABV that no approved claim carries, with the evidence', async () => {
    const result = await build();
    if (!result.ok) return;
    const variant = await prisma.contentVariant.findFirstOrThrow({
      where: { shopId, platform: 'FACEBOOK' },
    });

    await editCopy(variant.id, 'Applewood Gin, bottled at 45% ABV. Order at spirithaus.com.au.');
    const report = await runComplianceFor(shopId, variant.id);

    const blocking = report?.blocking.map((finding) => finding.code) ?? [];
    expect(blocking).toContain('FACT-ABV');

    const stored = await prisma.complianceCheck.findFirstOrThrow({
      where: { shopId, variantId: variant.id, ruleId: 'facts.abv', outcome: 'FAIL' },
    });
    expect(stored.severity).toBe('BLOCKING');
    expect(JSON.stringify(stored.evidence)).toContain('45');
    expect(stored.suggestion).toContain('Research Library');
  });

  it('refuses to submit a variant with a blocking finding', async () => {
    const result = await build();
    if (!result.ok) return;
    const variant = await prisma.contentVariant.findFirstOrThrow({
      where: { shopId, platform: 'FACEBOOK' },
    });
    await editCopy(variant.id, 'Applewood Gin, 45% ABV, and frankly good for you.');
    await runComplianceFor(shopId, variant.id);

    const submitted = await submitForApproval({ shopId, actor: manager, variantId: variant.id });
    expect(submitted.ok).toBe(false);
    if (submitted.ok) return;
    expect(submitted.error).toContain('blocking compliance finding');
    expect(submitted.error).toContain('facts.abv');
  });

  it('accepts the same figure once the claim is approved', async () => {
    const added = await addClaim({
      shopId,
      productId,
      actor: creator,
      field: 'abv',
      value: '45',
      kind: 'VERIFIED',
      confidence: 0.95,
      sourceUrl: 'https://applewooddistillery.com.au/gin',
      publisher: 'Applewood Distillery',
    });
    expect(added.ok).toBe(true);
    if (!added.ok) return;

    // Pending is not enough — the sheet is built from approved claims only.
    let result = await build();
    if (!result.ok) return;
    let variant = await prisma.contentVariant.findFirstOrThrow({
      where: { shopId, platform: 'X' },
    });
    await editCopy(variant.id, 'Applewood Gin, 45% ABV.');
    expect((await runComplianceFor(shopId, variant.id))?.blocking.map((f) => f.code)).toContain(
      'FACT-ABV',
    );

    await decideClaim({ shopId, claimId: added.claimId, decision: 'APPROVED', actor: reviewer });

    // A new campaign picks up the approved claim; the earlier one keeps its frozen sheet.
    await prisma.$executeRawUnsafe(
      'TRUNCATE campaign_brief, campaign_product, content_variant, campaign CASCADE',
    );
    result = await build();
    if (!result.ok) return;
    variant = await prisma.contentVariant.findFirstOrThrow({ where: { shopId, platform: 'X' } });
    await editCopy(variant.id, 'Applewood Gin, 45% ABV.');
    expect((await runComplianceFor(shopId, variant.id))?.blocking.map((f) => f.code)).not.toContain(
      'FACT-ABV',
    );
  });

  it('does not let a pending claim into the fact sheet', async () => {
    await addClaim({
      shopId,
      productId,
      actor: creator,
      field: 'award',
      value: 'Gold, Melbourne 2025',
      kind: 'VERIFIED',
      confidence: 0.9,
      sourceUrl: 'https://applewooddistillery.com.au/awards',
    });

    const result = await build();
    if (!result.ok) return;
    const brief = await prisma.campaignBrief.findUniqueOrThrow({
      where: { campaignId: result.campaignId },
    });
    const sheet = brief.factSheet as { facts: unknown[]; excluded: { because: string }[] };
    expect(sheet.facts).toEqual([]);
    expect(sheet.excluded[0]?.because).toBe('pending');
  });
});

describe('non-compliant copy', () => {
  it('is blocked with a rule, a severity and evidence pointing at the words', async () => {
    const result = await build();
    if (!result.ok) return;
    const variant = await prisma.contentVariant.findFirstOrThrow({
      where: { shopId, platform: 'INSTAGRAM' },
    });

    await editCopy(
      variant.id,
      'Get hammered on Applewood Gin — liquid courage for the big night, and grab one for the road trip.',
    );
    const report = await runComplianceFor(shopId, variant.id);

    const codes = report?.blocking.map((finding) => finding.code) ?? [];
    expect(codes).toContain('ABAC-CONSUME-2');
    expect(codes).toContain('ABAC-SOCIAL-1');
    expect(codes).toContain('ABAC-SAFETY-1');
    expect(report?.publishable).toBe(false);

    const stored = await prisma.complianceCheck.findFirstOrThrow({
      where: {
        shopId,
        variantId: variant.id,
        ruleId: 'abac.consumption.intoxication',
        outcome: 'FAIL',
      },
    });
    const evidence = stored.evidence as { field: string; match: string; excerpt: string }[];
    expect(evidence[0]?.match.toLowerCase()).toBe('hammered');
    expect(evidence[0]?.field).toBe('primaryCopy');
    expect(evidence[0]?.excerpt).toContain('hammered');
  });
});

describe('approval and dual control', () => {
  it('grants on one Campaign Manager key and marks the variant approved', async () => {
    const result = await build();
    if (!result.ok) return;
    const variant = await prisma.contentVariant.findFirstOrThrow({
      where: { shopId, platform: 'PINTEREST' },
    });

    const submitted = await submitForApproval({ shopId, actor: manager, variantId: variant.id });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    expect(submitted.requiredKeys).toBe(1);

    const signed = await signApprovalKey({
      shopId,
      actor: manager,
      approvalId: submitted.approvalId,
    });
    expect(signed).toEqual({ ok: true, granted: true });

    const after = await prisma.contentVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(after.approvalState).toBe('APPROVED');
    expect(
      (await prisma.campaign.findUniqueOrThrow({ where: { id: result.campaignId } })).state,
    ).toBe('APPROVED');
  });

  it('refuses a Creator as an approval key', async () => {
    const result = await build();
    if (!result.ok) return;
    const variant = await prisma.contentVariant.findFirstOrThrow({
      where: { shopId, platform: 'PINTEREST' },
    });
    const submitted = await submitForApproval({ shopId, actor: manager, variantId: variant.id });
    if (!submitted.ok) return;

    const signed = await signApprovalKey({
      shopId,
      actor: creator,
      approvalId: submitted.approvalId,
    });
    expect(signed.ok).toBe(false);
    if (signed.ok) return;
    expect(signed.error).toContain('campaign_manager');
  });

  it('withdraws the approval the moment the caption changes', async () => {
    const result = await build();
    if (!result.ok) return;
    const variant = await prisma.contentVariant.findFirstOrThrow({
      where: { shopId, platform: 'PINTEREST' },
    });
    const submitted = await submitForApproval({ shopId, actor: manager, variantId: variant.id });
    if (!submitted.ok) return;
    await signApprovalKey({ shopId, actor: manager, approvalId: submitted.approvalId });

    await editCopy(variant.id, 'Applewood Gin. A different sentence entirely.');

    const after = await prisma.contentVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(after.approvalState).toBe('INVALIDATED');
    expect(
      (await prisma.approval.findUniqueOrThrow({ where: { id: submitted.approvalId } })).outcome,
    ).toBe('INVALIDATED');

    const again = await signApprovalKey({
      shopId,
      actor: reviewer,
      approvalId: submitted.approvalId,
    });
    expect(again.ok).toBe(false);
    if (again.ok) return;
    expect(again.error).toContain('invalidated');
  });

  it('needs two distinct people when the content is high risk, and refuses one of them twice', async () => {
    const result = await build();
    if (!result.ok) return;
    const variant = await prisma.contentVariant.findFirstOrThrow({
      where: { shopId, platform: 'YOUTUBE' },
    });

    // An advisory finding in a consumption category makes it high risk without blocking it.
    await editCopy(
      variant.id,
      'Applewood Gin from the Adelaide Hills. No hangover, just juniper. Order at spirithaus.com.au.',
    );
    await runComplianceFor(shopId, variant.id);

    const submitted = await submitForApproval({ shopId, actor: manager, variantId: variant.id });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    expect(submitted.requiredKeys).toBe(2);

    const first = await signApprovalKey({
      shopId,
      actor: manager,
      approvalId: submitted.approvalId,
    });
    expect(first).toEqual({ ok: true, granted: false });

    // The same person again — the point of dual control.
    const twice = await signApprovalKey({
      shopId,
      actor: manager,
      approvalId: submitted.approvalId,
    });
    expect(twice.ok).toBe(false);
    if (twice.ok) return;
    expect(twice.error).toContain('two distinct people');

    const second = await signApprovalKey({
      shopId,
      actor: reviewer,
      approvalId: submitted.approvalId,
    });
    expect(second).toEqual({ ok: true, granted: true });
    expect(
      (await prisma.contentVariant.findUniqueOrThrow({ where: { id: variant.id } })).approvalState,
    ).toBe('APPROVED');
  });

  it('writes an audit trail of the whole thing', async () => {
    const result = await build();
    if (!result.ok) return;
    const variant = await prisma.contentVariant.findFirstOrThrow({
      where: { shopId, platform: 'PINTEREST' },
    });
    const submitted = await submitForApproval({ shopId, actor: manager, variantId: variant.id });
    if (!submitted.ok) return;
    await signApprovalKey({ shopId, actor: manager, approvalId: submitted.approvalId });

    const actions = (await prisma.auditEvent.findMany({ where: { shopId } })).map(
      (event) => event.action,
    );
    expect(actions).toEqual(
      expect.arrayContaining([
        'brand_kit.published',
        'campaign.created',
        'campaign.variants_generated',
        'campaign.submitted_for_approval',
        'approval.granted',
      ]),
    );
  });
});

/** Edits the copy the way the screen does: new hash supplied, trigger decides the rest. */
async function editCopy(variantId: string, primaryCopy: string): Promise<void> {
  const variant = await prisma.contentVariant.findUniqueOrThrow({ where: { id: variantId } });
  await prisma.contentVariant.update({
    where: { id: variantId },
    data: {
      primaryCopy,
      contentHash: variantHash({
        platform: variant.platform,
        content: variant.content,
        primaryCopy,
        callToAction: variant.callToAction,
        hashtags: variant.hashtags,
        altText: variant.altText,
        destinationUrl: variant.destinationUrl,
      }),
    },
  });
}
