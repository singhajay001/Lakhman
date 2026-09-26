import type { CollectionNode, ProductNode, VariantNode } from './queries.js';

export type MappedProductStatus = 'ACTIVE' | 'ARCHIVED' | 'DRAFT';

export interface MappedVariant {
  gid: string;
  sku: string | null;
  title: string;
  position: number;
  price: string;
  compareAtPrice: string | null;
  currency: string;
  unitCost: string | null;
  inventoryQuantity: number;
  inventoryPolicy: string | null;
  availableForSale: boolean;
}

export interface MappedProduct {
  gid: string;
  handle: string;
  title: string;
  descriptionHtml: string | null;
  productType: string | null;
  vendor: string | null;
  tags: string[];
  status: MappedProductStatus;
  featuredImageUrl: string | null;
  onlineStoreUrl: string | null;
  publishedAt: Date | null;
  shopifyUpdatedAt: Date | null;
  variants: MappedVariant[];
}

/**
 * Pure mapping, so it can be tested without a network or a database. Money stays a
 * decimal string all the way to Postgres: parsing "19.99" into a float and back is
 * how a price becomes 19.989999999999998 in a published post.
 */
export function mapProduct(node: ProductNode, defaultCurrency = 'AUD'): MappedProduct {
  return {
    gid: node.id,
    handle: node.handle,
    title: node.title,
    descriptionHtml: node.descriptionHtml ?? null,
    productType: emptyToNull(node.productType),
    vendor: emptyToNull(node.vendor),
    tags: node.tags ?? [],
    status: mapStatus(node.status),
    featuredImageUrl: node.featuredMedia?.preview?.image?.url ?? null,
    onlineStoreUrl: node.onlineStoreUrl ?? null,
    publishedAt: parseDate(node.publishedAt),
    shopifyUpdatedAt: parseDate(node.updatedAt),
    variants: node.variants.nodes.map((variant, index) =>
      mapVariant(variant, index + 1, defaultCurrency),
    ),
  };
}

export function mapVariant(
  node: VariantNode,
  fallbackPosition: number,
  defaultCurrency = 'AUD',
): MappedVariant {
  const unitCost = node.inventoryItem?.unitCost ?? null;
  return {
    gid: node.id,
    sku: emptyToNull(node.sku),
    title: node.title,
    position: node.position ?? fallbackPosition,
    price: normaliseMoney(node.price),
    compareAtPrice: node.compareAtPrice ? normaliseMoney(node.compareAtPrice) : null,
    currency: unitCost?.currencyCode ?? defaultCurrency,
    unitCost: unitCost ? normaliseMoney(unitCost.amount) : null,
    inventoryQuantity: node.inventoryQuantity ?? 0,
    inventoryPolicy: emptyToNull(node.inventoryPolicy),
    availableForSale: node.availableForSale,
  };
}

export interface MappedCollection {
  gid: string;
  handle: string;
  title: string;
  descriptionHtml: string | null;
  sortOrder: string | null;
  productCount: number;
  productGids: string[];
}

export function mapCollection(node: CollectionNode): MappedCollection {
  return {
    gid: node.id,
    handle: node.handle,
    title: node.title,
    descriptionHtml: node.descriptionHtml ?? null,
    sortOrder: emptyToNull(node.sortOrder),
    productCount: node.productsCount?.count ?? node.products?.nodes.length ?? 0,
    productGids: node.products?.nodes.map((product) => product.id) ?? [],
  };
}

function mapStatus(status: string): MappedProductStatus {
  switch (status.toUpperCase()) {
    case 'ACTIVE':
      return 'ACTIVE';
    case 'ARCHIVED':
      return 'ARCHIVED';
    case 'DRAFT':
      return 'DRAFT';
    default:
      // An unknown status is treated as DRAFT: the conservative reading, because a
      // draft is never promoted.
      return 'DRAFT';
  }
}

/** Keeps money as a string, and rejects a value that is not one. */
export function normaliseMoney(amount: string): string {
  const trimmed = amount.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(
      `Shopify returned a money value this app cannot read: ${JSON.stringify(amount)}`,
    );
  }
  return trimmed;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Whether a product is safe to promote right now (sections 7 and 31). Deliberately
 * strict: a manager may authorise a back-order or awareness campaign, and that
 * authorisation is recorded rather than inferred from a loose check here.
 */
export interface PromotabilityInput {
  status: MappedProductStatus;
  onlineStoreUrl: string | null;
  variants: { availableForSale: boolean; inventoryQuantity: number }[];
}

export type Promotability = { promotable: true } | { promotable: false; reasons: string[] };

export function assessPromotability(product: PromotabilityInput): Promotability {
  const reasons: string[] = [];
  if (product.status !== 'ACTIVE') reasons.push(`product status is ${product.status}`);
  if (!product.onlineStoreUrl) reasons.push('product is not published to the online store');
  if (product.variants.length === 0) reasons.push('product has no variants');
  else if (!product.variants.some((v) => v.availableForSale && v.inventoryQuantity > 0)) {
    reasons.push('no variant is available for sale with stock on hand');
  }
  return reasons.length === 0 ? { promotable: true } : { promotable: false, reasons };
}
