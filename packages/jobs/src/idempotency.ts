import { createHash } from 'node:crypto';

/**
 * Idempotency keys (sections 22 and 36). The key is a pure function of the
 * identifiers that make an action unique, so two workers racing on the same event
 * compute the same key and the database's unique index settles it.
 */
export function idempotencyKey(parts: Record<string, string | number | null | undefined>): string {
  // Sorted, so the caller's object literal order cannot change the key. A key that
  // depends on property order is a key that stops working after a refactor.
  const canonical = Object.entries(parts)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${key}=${String(value)}`)
    .sort()
    .join('\u001f');

  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * One publication job per destination per approved version. A retry recomputes the
 * same key, so it cannot create a second job for a destination that already has one.
 */
export const publicationIdempotencyKey = (input: {
  campaignId: string;
  contentVariantId: string;
  destinationId: string;
  approvalVersionId: string;
}): string => idempotencyKey({ kind: 'publication', ...input });

/** Shopify redelivers webhooks; the topic plus its event id is the identity. */
export const webhookIdempotencyKey = (input: {
  shopDomain: string;
  topic: string;
  shopifyEventId: string;
}): string => idempotencyKey({ kind: 'webhook', ...input });

/** One sync of a kind per shop per trigger instant. */
export const syncIdempotencyKey = (input: {
  shopId: string;
  kind: string;
  windowStart: string;
}): string =>
  // `syncKind` rather than `kind`, because `kind` is the namespace and spreading the
  // input over it would have silently replaced it.
  idempotencyKey({
    kind: 'sync',
    shopId: input.shopId,
    syncKind: input.kind,
    windowStart: input.windowStart,
  });

/**
 * One render per composition, props and asset. A retry recomputes the same key, so a queue
 * that redelivers cannot render the same thing twice and pay for it twice.
 */
export const compositeIdempotencyKey = (input: {
  shopId: string;
  assetId: string;
  platform: string;
  format: string;
  /** Digest of the environment bytes, so a different backdrop is different work. */
  environmentDigest: string;
}): string => idempotencyKey({ kind: 'composite', ...input });

export const renderIdempotencyKey = (input: {
  shopId: string;
  compositionId: string;
  /** Stable digest of the props; the caller canonicalises before hashing. */
  propsDigest: string;
}): string => idempotencyKey({ kind: 'render', ...input });
