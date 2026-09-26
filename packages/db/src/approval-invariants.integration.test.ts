import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from './client.js';

/**
 * Section 20's invariants, tested against the real triggers in
 * migration 20260926040300_approval_invariants.
 *
 * These are the rules a service could be talked out of. Each test here is a thing the
 * next feature cannot do by accident.
 */
const DOMAIN = 'approvals.myshopify.com';
let shopId: string;
let campaignId: string;
let variantId: string;
let manager: string;
let reviewer: string;

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

async function makeVariant(hash = HASH_A): Promise<string> {
  const variant = await prisma.contentVariant.create({
    data: {
      shopId,
      campaignId,
      platform: 'INSTAGRAM',
      content: { firstLine: 'Applewood Gin.' },
      primaryCopy: 'Applewood Gin. From the Adelaide Hills.',
      callToAction: 'Link in bio',
      hashtags: ['#spirithaus'],
      altText: 'A gin bottle on dark timber.',
      destinationUrl: 'https://spirithaus.com.au/products/applewood-gin',
      contentHash: hash,
    },
  });
  return variant.id;
}

async function makeApproval(over: { requiredKeys?: number; hash?: string; variant?: string } = {}) {
  return prisma.approval.create({
    data: {
      shopId,
      campaignId,
      variantId: over.variant ?? variantId,
      kind: 'ORGANIC_PUBLICATION',
      requiredKeys: over.requiredKeys ?? 1,
      contentHash: over.hash ?? HASH_A,
      context: {},
    },
  });
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE approval_key, approval, compliance_check, content_similarity_record, content_variant, campaign_brief, campaign_product, campaign, brand_kit_version, brand_kit, research_claim, research_source, product_research, shopify_variant, shopify_product, audit_event, "user", shop CASCADE',
  );
  const shop = await prisma.shop.create({ data: { domain: DOMAIN } });
  shopId = shop.id;

  const [m, r] = await Promise.all([
    prisma.user.create({ data: { shopId, email: 'manager@example.invalid' } }),
    prisma.user.create({ data: { shopId, email: 'reviewer@example.invalid' } }),
  ]);
  manager = m.id;
  reviewer = r.id;

  const campaign = await prisma.campaign.create({
    data: { shopId, name: 'Test campaign', objective: 'PRODUCT_AWARENESS' },
  });
  campaignId = campaign.id;
  variantId = await makeVariant();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('a material edit invalidates approval', () => {
  it('withdraws a granted approval when the caption changes', async () => {
    const approval = await makeApproval();
    await prisma.approvalKey.create({
      data: {
        shopId,
        approvalId: approval.id,
        userId: manager,
        keyIndex: 1,
        role: 'campaign_manager',
        signedHash: HASH_A,
      },
    });

    expect((await prisma.approval.findUniqueOrThrow({ where: { id: approval.id } })).outcome).toBe(
      'GRANTED',
    );
    expect(
      (await prisma.contentVariant.findUniqueOrThrow({ where: { id: variantId } })).approvalState,
    ).toBe('APPROVED');

    await prisma.contentVariant.update({
      where: { id: variantId },
      data: { primaryCopy: 'Applewood Gin. From the Adelaide Hills. Order today.' },
    });

    const after = await prisma.contentVariant.findUniqueOrThrow({ where: { id: variantId } });
    expect(after.approvalState).toBe('INVALIDATED');
    expect(after.revision).toBe(2);
    // The stale hash is cleared, so it cannot match anything.
    expect(after.contentHash).toBeNull();

    // And it cascades: the approval row itself is withdrawn.
    expect((await prisma.approval.findUniqueOrThrow({ where: { id: approval.id } })).outcome).toBe(
      'INVALIDATED',
    );
  });

  it.each([
    ['callToAction', { callToAction: 'Shop now' }],
    ['hashtags', { hashtags: ['#gin'] }],
    ['altText', { altText: 'Something else entirely.' }],
    ['destinationUrl', { destinationUrl: 'https://spirithaus.com.au/' }],
    ['content', { content: { firstLine: 'Different.' } }],
  ])('withdraws it when %s changes', async (_field, data) => {
    const approval = await makeApproval();
    await prisma.approvalKey.create({
      data: {
        shopId,
        approvalId: approval.id,
        userId: manager,
        keyIndex: 1,
        role: 'campaign_manager',
        signedHash: HASH_A,
      },
    });

    await prisma.contentVariant.update({ where: { id: variantId }, data });

    expect(
      (await prisma.contentVariant.findUniqueOrThrow({ where: { id: variantId } })).approvalState,
    ).toBe('INVALIDATED');
  });

  it('leaves approval alone when only an immaterial field changes', async () => {
    const approval = await makeApproval();
    await prisma.approvalKey.create({
      data: {
        shopId,
        approvalId: approval.id,
        userId: manager,
        keyIndex: 1,
        role: 'campaign_manager',
        signedHash: HASH_A,
      },
    });

    // Re-scoring a variant must not withdraw an approval a human already gave.
    await prisma.contentVariant.update({
      where: { id: variantId },
      data: { qualityScores: { overall: 82 }, generation: { model: 'mock-1' } },
    });

    const after = await prisma.contentVariant.findUniqueOrThrow({ where: { id: variantId } });
    expect(after.approvalState).toBe('APPROVED');
    expect(after.revision).toBe(1);
    expect(after.contentHash).toBe(HASH_A);
    expect((await prisma.approval.findUniqueOrThrow({ where: { id: approval.id } })).outcome).toBe(
      'GRANTED',
    );
  });

  it('keeps a supplied hash when the caller refreshed it in the same write', async () => {
    await prisma.contentVariant.update({
      where: { id: variantId },
      data: { primaryCopy: 'Edited copy.', contentHash: HASH_B },
    });
    const after = await prisma.contentVariant.findUniqueOrThrow({ where: { id: variantId } });
    expect(after.contentHash).toBe(HASH_B);
    expect(after.revision).toBe(2);
  });

  it('invalidates a pending approval too, not only a granted one', async () => {
    await makeApproval();
    await prisma.contentVariant.update({
      where: { id: variantId },
      data: { approvalState: 'PENDING' },
    });
    await prisma.contentVariant.update({
      where: { id: variantId },
      data: { primaryCopy: 'Edited again.' },
    });
    expect(
      (await prisma.contentVariant.findUniqueOrThrow({ where: { id: variantId } })).approvalState,
    ).toBe('INVALIDATED');
  });
});

describe('the key guard', () => {
  it('refuses a key signing a hash the approval is not for', async () => {
    const approval = await makeApproval({ hash: HASH_A });
    await expect(
      prisma.approvalKey.create({
        data: {
          shopId,
          approvalId: approval.id,
          userId: manager,
          keyIndex: 1,
          role: 'campaign_manager',
          signedHash: HASH_B,
        },
      }),
    ).rejects.toThrow(/content changed after it was read/i);
  });

  it('refuses a second key once the approval is complete', async () => {
    const approval = await makeApproval({ requiredKeys: 1 });
    await prisma.approvalKey.create({
      data: {
        shopId,
        approvalId: approval.id,
        userId: manager,
        keyIndex: 1,
        role: 'campaign_manager',
        signedHash: HASH_A,
      },
    });
    await expect(
      prisma.approvalKey.create({
        data: {
          shopId,
          approvalId: approval.id,
          userId: reviewer,
          keyIndex: 2,
          role: 'compliance_reviewer',
          signedHash: HASH_A,
        },
      }),
    ).rejects.toThrow(/is granted and cannot take another key/i);
  });

  it('refuses a key index beyond what the approval requires', async () => {
    const approval = await makeApproval({ requiredKeys: 1 });
    await expect(
      prisma.approvalKey.create({
        data: {
          shopId,
          approvalId: approval.id,
          userId: manager,
          keyIndex: 2,
          role: 'campaign_manager',
          signedHash: HASH_A,
        },
      }),
    ).rejects.toThrow(/there is no key 2/i);
  });

  it('refuses a key index outside 1 and 2, by check constraint', async () => {
    const approval = await makeApproval({ requiredKeys: 2 });
    await expect(
      prisma.approvalKey.create({
        data: {
          shopId,
          approvalId: approval.id,
          userId: manager,
          keyIndex: 3,
          role: 'campaign_manager',
          signedHash: HASH_A,
        },
      }),
    ).rejects.toThrow();
  });

  it('refuses requiredKeys outside 1 and 2', async () => {
    await expect(makeApproval({ requiredKeys: 3 })).rejects.toThrow();
  });
});

describe('dual control', () => {
  it('does not grant on the first of two keys', async () => {
    const approval = await makeApproval({ requiredKeys: 2 });
    await prisma.approvalKey.create({
      data: {
        shopId,
        approvalId: approval.id,
        userId: manager,
        keyIndex: 1,
        role: 'campaign_manager',
        signedHash: HASH_A,
      },
    });

    expect((await prisma.approval.findUniqueOrThrow({ where: { id: approval.id } })).outcome).toBe(
      'PENDING',
    );
    expect(
      (await prisma.contentVariant.findUniqueOrThrow({ where: { id: variantId } })).approvalState,
    ).toBe('UNSUBMITTED');
  });

  it('refuses the same person signing both keys', async () => {
    // The whole point of dual control. Enforced by a unique index, so no code path can
    // route around it.
    const approval = await makeApproval({ requiredKeys: 2 });
    await prisma.approvalKey.create({
      data: {
        shopId,
        approvalId: approval.id,
        userId: manager,
        keyIndex: 1,
        role: 'campaign_manager',
        signedHash: HASH_A,
      },
    });
    await expect(
      prisma.approvalKey.create({
        data: {
          shopId,
          approvalId: approval.id,
          userId: manager,
          keyIndex: 2,
          role: 'finance_approver',
          signedHash: HASH_A,
        },
      }),
    ).rejects.toThrow(/Unique constraint/i);
  });

  it('grants on the second key from a distinct person', async () => {
    const approval = await makeApproval({ requiredKeys: 2 });
    await prisma.approvalKey.create({
      data: {
        shopId,
        approvalId: approval.id,
        userId: manager,
        keyIndex: 1,
        role: 'campaign_manager',
        signedHash: HASH_A,
      },
    });
    await prisma.approvalKey.create({
      data: {
        shopId,
        approvalId: approval.id,
        userId: reviewer,
        keyIndex: 2,
        role: 'compliance_reviewer',
        signedHash: HASH_A,
      },
    });

    const after = await prisma.approval.findUniqueOrThrow({ where: { id: approval.id } });
    expect(after.outcome).toBe('GRANTED');
    expect(after.decidedAt).not.toBeNull();
    expect(
      (await prisma.contentVariant.findUniqueOrThrow({ where: { id: variantId } })).approvalState,
    ).toBe('APPROVED');
  });

  it('refuses two keys at the same index', async () => {
    const approval = await makeApproval({ requiredKeys: 2 });
    await prisma.approvalKey.create({
      data: {
        shopId,
        approvalId: approval.id,
        userId: manager,
        keyIndex: 1,
        role: 'campaign_manager',
        signedHash: HASH_A,
      },
    });
    await expect(
      prisma.approvalKey.create({
        data: {
          shopId,
          approvalId: approval.id,
          userId: reviewer,
          keyIndex: 1,
          role: 'compliance_reviewer',
          signedHash: HASH_A,
        },
      }),
    ).rejects.toThrow(/Unique constraint/i);
  });
});

describe('granting a variant whose hash has moved', () => {
  it('grants the approval but does not mark the variant approved', async () => {
    // The approval is for content that no longer exists. Recording the signature and
    // withholding the variant's approved state is the honest split.
    const approval = await makeApproval({ requiredKeys: 1, hash: HASH_A });
    await prisma.contentVariant.update({
      where: { id: variantId },
      data: { primaryCopy: 'Moved on.', contentHash: HASH_B },
    });

    await prisma.approvalKey.create({
      data: {
        shopId,
        approvalId: approval.id,
        userId: manager,
        keyIndex: 1,
        role: 'campaign_manager',
        signedHash: HASH_A,
      },
    });

    expect((await prisma.approval.findUniqueOrThrow({ where: { id: approval.id } })).outcome).toBe(
      'GRANTED',
    );
    expect(
      (await prisma.contentVariant.findUniqueOrThrow({ where: { id: variantId } })).approvalState,
    ).not.toBe('APPROVED');
  });
});
