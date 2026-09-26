import { createHash } from 'node:crypto';

/**
 * The content hash an approval binds to (section 20).
 *
 * Canonicalisation is the whole thing. A hash that changes when someone reorders an
 * object literal invalidates approvals for no reason; a hash that ignores a field
 * lets an edit through an approval that was never given for it. Both are tested.
 */

/** Sorted keys, arrays in order, undefined dropped. Deterministic for any input. */
export function canonicalise(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  const kind = typeof value;
  if (kind === 'number' || kind === 'boolean') return JSON.stringify(value);
  if (kind === 'bigint') return `${value.toString()}n`;
  if (kind === 'string') return JSON.stringify(value);
  if (value instanceof Date) return JSON.stringify(value.toISOString());

  if (Array.isArray(value)) {
    // Order is preserved: hashtag order and scene order are material.
    return `[${value.map((item) => canonicalise(item)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalise(item)}`).join(',')}}`;
}

const sha256 = (input: string): string => createHash('sha256').update(input, 'utf8').digest('hex');

/**
 * The material fields of a content variant — the ones an edit to which invalidates
 * approval. The list is a tested constant rather than a judgement made at runtime, and
 * it matches the columns the database trigger watches
 * (migration 20260926040300_approval_invariants).
 */
export const MATERIAL_VARIANT_FIELDS = [
  'platform',
  'content',
  'primaryCopy',
  'callToAction',
  'hashtags',
  'altText',
  'destinationUrl',
] as const;

/** Fields that are about the variant but do not change what a reader sees. */
export const IMMATERIAL_VARIANT_FIELDS = [
  'qualityScores',
  'generation',
  'revision',
  'createdAt',
  'updatedAt',
  'approvalState',
  'contentHash',
  'internalNotes',
] as const;

export interface VariantForHashing {
  platform: string;
  content: unknown;
  primaryCopy: string;
  callToAction?: string | null;
  hashtags?: readonly string[];
  altText?: string | null;
  destinationUrl?: string | null;
  [key: string]: unknown;
}

export function variantHash(variant: VariantForHashing): string {
  const material: Record<string, unknown> = {};
  for (const field of MATERIAL_VARIANT_FIELDS) material[field] = variant[field] ?? null;
  return sha256(`variant:v1:${canonicalise(material)}`);
}

/**
 * Everything else section 20 requires an approval to be bound to. Held separately from
 * the variant hash because it describes the *request* rather than the content: a
 * different schedule window or budget is a different approval, not an edited variant.
 */
export interface ApprovalContextForHashing {
  destinations: readonly string[];
  audienceSegmentId?: string | null;
  audienceSegmentVersion?: string | null;
  scheduledFrom?: Date | string | null;
  scheduledTo?: Date | string | null;
  budgetAud?: string | number | null;
  brandKitVersionId?: string | null;
  productSnapshots: readonly unknown[];
  complianceResultId?: string | null;
  promptVersionIds?: readonly string[];
  modelIds?: readonly string[];
  [key: string]: unknown;
}

export function approvalContextHash(context: ApprovalContextForHashing): string {
  return sha256(
    `approval-context:v1:${canonicalise({
      destinations: [...context.destinations].sort(),
      audienceSegmentId: context.audienceSegmentId ?? null,
      audienceSegmentVersion: context.audienceSegmentVersion ?? null,
      scheduledFrom: asIso(context.scheduledFrom),
      scheduledTo: asIso(context.scheduledTo),
      budgetAud:
        context.budgetAud === null || context.budgetAud === undefined
          ? null
          : String(context.budgetAud),
      brandKitVersionId: context.brandKitVersionId ?? null,
      productSnapshots: context.productSnapshots,
      complianceResultId: context.complianceResultId ?? null,
      promptVersionIds: [...(context.promptVersionIds ?? [])].sort(),
      modelIds: [...(context.modelIds ?? [])].sort(),
    })}`,
  );
}

function asIso(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/** True when the variant is still exactly what the approval was given for. */
export function matchesApprovedHash(variant: VariantForHashing, approvedHash: string): boolean {
  return variantHash(variant) === approvedHash;
}
