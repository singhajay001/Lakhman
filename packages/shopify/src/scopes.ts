/**
 * Section 7 requires the requested scopes split into mandatory and optional, with a
 * reason per scope. The reasons are here rather than in a document so that adding a
 * scope means writing down why, in the same diff.
 *
 * write_products, write_inventory, write_orders, write_customers and write_themes are
 * deliberately absent: this app has no business editing the catalogue, and section
 * 15's product-truth principle is stronger if it cannot.
 */
export interface ScopeRequirement {
  scope: string;
  reason: string;
  /** The feature that stops working without it. */
  feature: string;
  /** Some scopes need Shopify's approval, not only the merchant's. */
  needsShopifyApproval?: boolean;
}

export const MANDATORY_SCOPES: readonly ScopeRequirement[] = [
  {
    scope: 'read_products',
    feature: 'Product truth',
    reason:
      'Products, variants, collections, price, availability, imagery and metafields. Without it there is no verified product data and every campaign would rest on invention.',
  },
  {
    scope: 'read_inventory',
    feature: 'Stock safety and contribution margin',
    reason:
      'Availability for the pre-publication revalidation and the stock-unsafe pause, and inventoryItem.unitCost, which is the COGS term in contribution margin.',
  },
  {
    scope: 'read_orders',
    feature: 'Revenue-first attribution',
    reason:
      'Confirmed orders, refunds and cancellations — the numerator of every metric ranked above engagement. Limited to 60 days without read_all_orders.',
  },
  {
    scope: 'write_pixels',
    feature: 'First-party attribution',
    reason:
      'Installs the Web Pixel extension that captures the landing UTMs and the funnel events.',
  },
  {
    scope: 'read_customer_events',
    feature: 'First-party attribution',
    reason:
      'Reads the customer events the pixel emits. Without it the identity chain cannot be built.',
  },
  {
    scope: 'read_marketing_events',
    feature: 'Shopify Marketing Activities',
    reason: 'Reads existing marketing activities so campaigns are not duplicated.',
  },
  {
    scope: 'write_marketing_events',
    feature: 'Shopify Marketing Activities',
    reason:
      'Registers each campaign in Shopify so spend and results appear in the merchant’s own reporting, not only in this app.',
  },
];

export const OPTIONAL_SCOPES: readonly ScopeRequirement[] = [
  {
    scope: 'read_customers',
    feature: 'Audience segments',
    reason:
      'Reads Shopify customer segment definitions and sizes. Operated on in aggregate; individual membership is never copied out of Shopify.',
  },
  {
    scope: 'read_all_orders',
    feature: 'Attribution and forecasting beyond 60 days',
    reason: 'Comparable history for forecasting. Without it, analysis is limited to 60 days.',
    needsShopifyApproval: true,
  },
  {
    scope: 'write_discounts',
    feature: 'Offer-code attribution',
    reason: 'Creates the campaign offer code that gives a second, independent attribution signal.',
  },
  {
    scope: 'read_files',
    feature: 'Reusing Shopify-hosted media',
    reason: 'Reads files already in Shopify so an approved asset need not be uploaded twice.',
  },
  {
    scope: 'read_publications',
    feature: 'Preflight sales-channel check',
    reason:
      'Confirms a product is published to the Online Store channel before a campaign promotes a URL that would 404.',
  },
];

export const NEVER_REQUESTED: readonly { scope: string; why: string }[] = [
  {
    scope: 'write_products',
    why: 'The app never edits the catalogue. Product data is truth, not output.',
  },
  { scope: 'write_inventory', why: 'Stock is read to protect campaigns, never adjusted.' },
  { scope: 'write_orders', why: 'The app has no order-management function.' },
  {
    scope: 'write_customers',
    why: 'Customer records are never modified, and are read only in aggregate.',
  },
  {
    scope: 'write_themes',
    why: 'The storefront is not this app’s to edit; the Web Pixel installs as an extension.',
  },
];

export const mandatoryScopeList = (): string[] => MANDATORY_SCOPES.map((s) => s.scope);
export const optionalScopeList = (): string[] => OPTIONAL_SCOPES.map((s) => s.scope);

/** What the app asked for, against what Shopify actually granted. */
export function missingMandatoryScopes(granted: readonly string[]): string[] {
  const set = new Set(granted);
  return mandatoryScopeList().filter((scope) => !set.has(scope));
}
