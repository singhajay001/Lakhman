import type { CollectionNode, ProductNode } from '@spirithaus/shopify';

/**
 * Fixture catalogue. Australian spirits, priced in AUD, with the awkward cases a
 * real catalogue has: an empty unit cost, a draft, an archived product, a product
 * with no online store URL, and one variant out of stock.
 */
export function product(
  overrides: Partial<ProductNode> & { id: string; handle: string },
): ProductNode {
  return {
    title: 'Fixture Product',
    descriptionHtml: '<p>Fixture</p>',
    productType: 'Gin',
    vendor: 'Fixture Distillery',
    tags: ['fixture'],
    status: 'ACTIVE',
    publishedAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
    onlineStoreUrl: `https://spirithaus.com.au/products/${overrides.handle}`,
    featuredMedia: { preview: { image: { url: 'https://cdn.example.invalid/a.jpg' } } },
    variants: {
      nodes: [
        {
          id: `${overrides.id}/variant/1`,
          sku: 'SKU-1',
          title: '700ml',
          position: 1,
          price: '89.99',
          compareAtPrice: null,
          availableForSale: true,
          inventoryQuantity: 12,
          inventoryPolicy: 'DENY',
          inventoryItem: { unitCost: { amount: '48.5000', currencyCode: 'AUD' } },
        },
      ],
    },
    ...overrides,
  };
}

export const CATALOGUE: ProductNode[] = [
  product({ id: 'gid://shopify/Product/1', handle: 'applewood-gin', title: 'Applewood Gin' }),
  product({
    id: 'gid://shopify/Product/2',
    handle: 'starward-nova',
    title: 'Starward Nova Single Malt',
    productType: 'Whisky',
    variants: {
      nodes: [
        {
          id: 'gid://shopify/Product/2/variant/1',
          sku: 'STAR-NOVA-700',
          title: '700ml',
          position: 1,
          price: '94.00',
          compareAtPrice: '110.00',
          availableForSale: true,
          inventoryQuantity: 4,
          inventoryPolicy: 'DENY',
          // No unit cost: contribution margin must fall back and say so.
          inventoryItem: { unitCost: null },
        },
      ],
    },
  }),
  product({
    id: 'gid://shopify/Product/3',
    handle: 'four-pillars-rare-dry',
    title: 'Four Pillars Rare Dry Gin',
    variants: {
      nodes: [
        {
          id: 'gid://shopify/Product/3/variant/1',
          sku: 'FP-RARE-700',
          title: '700ml',
          position: 1,
          price: '79.00',
          compareAtPrice: null,
          availableForSale: false,
          inventoryQuantity: 0,
          inventoryPolicy: 'DENY',
          inventoryItem: { unitCost: { amount: '41.0000', currencyCode: 'AUD' } },
        },
      ],
    },
  }),
  product({
    id: 'gid://shopify/Product/4',
    handle: 'unreleased-cask',
    title: 'Unreleased Cask',
    status: 'DRAFT',
    publishedAt: null,
    onlineStoreUrl: null,
  }),
  product({
    id: 'gid://shopify/Product/5',
    handle: 'discontinued-liqueur',
    title: 'Discontinued Liqueur',
    status: 'ARCHIVED',
  }),
];

export const COLLECTIONS: CollectionNode[] = [
  {
    id: 'gid://shopify/Collection/1',
    handle: 'whisky',
    title: 'Whisky',
    descriptionHtml: '<p>Whisky</p>',
    sortOrder: 'BEST_SELLING',
    productsCount: { count: 1 },
    products: { nodes: [{ id: 'gid://shopify/Product/2' }] },
  },
  {
    id: 'gid://shopify/Collection/2',
    handle: 'gin',
    title: 'Gin',
    descriptionHtml: null,
    sortOrder: 'MANUAL',
    productsCount: { count: 2 },
    products: { nodes: [{ id: 'gid://shopify/Product/1' }, { id: 'gid://shopify/Product/3' }] },
  },
];
