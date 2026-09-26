/**
 * The fact sheet: everything a campaign is allowed to say (sections 3 and 9).
 *
 * Built only from approved research claims and verified Shopify data, and frozen onto
 * the campaign brief at generation time. Copy is checked against this frozen sheet
 * rather than against live research, so approving a claim later cannot retroactively
 * legitimise copy that was written before.
 */
export interface Fact {
  field: string;
  value: string;
  /** Where it came from: a research source URL, or 'shopify' for product truth. */
  origin: string;
  /** Verified facts and inferences are kept apart, per section 9. */
  kind: 'VERIFIED' | 'INFERRED';
  confidence: number;
}

export interface ProductTruth {
  productId: string;
  title: string;
  vendor: string | null;
  productType: string | null;
  handle: string;
  onlineStoreUrl: string | null;
  /** Decimal strings, never floats. */
  prices: string[];
  compareAtPrices: string[];
  availableForSale: boolean;
  inventoryQuantity: number;
}

export interface FactSheet {
  /** Frozen at generation time; the campaign records which sheet it used. */
  builtAt: string;
  products: ProductTruth[];
  facts: Fact[];
  /** Claims that were rejected or still pending, recorded so the sheet is auditable. */
  excluded: { field: string; value: string; because: 'pending' | 'rejected' | 'conflicted' }[];
}

export interface ClaimInput {
  field: string;
  value: string;
  kind: 'VERIFIED' | 'INFERRED';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CONFLICTED';
  confidence: number;
  sourceUrl?: string | null;
}

/**
 * Only APPROVED claims enter the sheet. A pending claim is not a weaker fact, it is not
 * a fact — section 9 is explicit that only approved facts may enter promotional content.
 */
export function buildFactSheet(input: {
  products: ProductTruth[];
  claims: readonly ClaimInput[];
  now?: Date;
}): FactSheet {
  const facts: Fact[] = [];
  const excluded: FactSheet['excluded'] = [];

  for (const claim of input.claims) {
    if (claim.status === 'APPROVED') {
      facts.push({
        field: claim.field,
        value: claim.value,
        origin: claim.sourceUrl ?? 'unrecorded source',
        kind: claim.kind,
        confidence: claim.confidence,
      });
      continue;
    }
    excluded.push({
      field: claim.field,
      value: claim.value,
      because:
        claim.status === 'REJECTED'
          ? 'rejected'
          : claim.status === 'CONFLICTED'
            ? 'conflicted'
            : 'pending',
    });
  }

  return {
    builtAt: (input.now ?? new Date()).toISOString(),
    products: input.products,
    facts,
    excluded,
  };
}

/** Every approved value for a field, lower-cased for comparison. */
export function approvedValues(sheet: FactSheet, field: string): string[] {
  return sheet.facts
    .filter((fact) => fact.field === field)
    .map((fact) => fact.value.trim().toLowerCase());
}

export function hasApprovedField(sheet: FactSheet, field: string): boolean {
  return sheet.facts.some((fact) => fact.field === field);
}

/** All prices the products actually carry, as they came from Shopify. */
export function approvedPrices(sheet: FactSheet): string[] {
  return sheet.products.flatMap((product) => [...product.prices, ...product.compareAtPrices]);
}

/**
 * What the generator is given. Inferences are labelled in the prompt so the model is
 * not invited to present one as established, and nothing outside this ever reaches it.
 */
export function promptFacts(sheet: FactSheet): string {
  const lines: string[] = [];
  for (const product of sheet.products) {
    lines.push(
      `PRODUCT ${product.title}${product.vendor ? ` by ${product.vendor}` : ''} — ${
        product.productType ?? 'uncategorised'
      }, ${product.availableForSale ? 'available' : 'not available'}, prices ${
        product.prices.join(', ') || 'unknown'
      } AUD`,
    );
  }
  for (const fact of sheet.facts) {
    lines.push(`${fact.kind === 'INFERRED' ? 'INFERENCE' : 'FACT'} ${fact.field}: ${fact.value}`);
  }
  if (sheet.facts.length === 0) {
    lines.push('No research claim has been approved. Do not state any attribute beyond the above.');
  }
  return lines.join('\n');
}

/**
 * Conflict detection. Two approved claims for a single-valued field disagreeing is a
 * state the reviewer has to resolve; section 9 forbids resolving it automatically.
 */
export const SINGLE_VALUED_FIELDS = [
  'abv',
  'age_statement',
  'vintage',
  'region',
  'country',
  'bottle_size',
  'producer',
] as const;

export function conflicts(sheet: FactSheet): { field: string; values: string[] }[] {
  const found: { field: string; values: string[] }[] = [];
  for (const field of SINGLE_VALUED_FIELDS) {
    const values = [...new Set(approvedValues(sheet, field))];
    if (values.length > 1) found.push({ field, values });
  }
  return found;
}
