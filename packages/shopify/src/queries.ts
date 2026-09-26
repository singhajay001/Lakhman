/** Pinned API version. Recorded per sync run so a behaviour change is traceable. */
export const ADMIN_API_VERSION = process.env.SHOPIFY_API_VERSION ?? '2025-07';

export const PRODUCTS_PAGE_QUERY = `
query ProductsPage($cursor: String, $pageSize: Int!) {
  products(first: $pageSize, after: $cursor, sortKey: UPDATED_AT) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id
      handle
      title
      descriptionHtml
      productType
      vendor
      tags
      status
      publishedAt
      updatedAt
      onlineStoreUrl
      featuredMedia { preview { image { url } } }
      variants(first: 100) {
        nodes {
          id
          sku
          title
          position
          price
          compareAtPrice
          availableForSale
          inventoryQuantity
          inventoryPolicy
          inventoryItem { unitCost { amount currencyCode } }
        }
      }
    }
  }
}`;

export const COLLECTIONS_PAGE_QUERY = `
query CollectionsPage($cursor: String, $pageSize: Int!) {
  collections(first: $pageSize, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id
      handle
      title
      descriptionHtml
      sortOrder
      productsCount { count }
      products(first: 250) { nodes { id } }
    }
  }
}`;

export const SHOP_QUERY = `
query ShopContext {
  shop {
    name
    ianaTimezone
    currencyCode
    myshopifyDomain
  }
}`;

export interface ProductNode {
  id: string;
  handle: string;
  title: string;
  descriptionHtml?: string | null;
  productType?: string | null;
  vendor?: string | null;
  tags?: string[] | null;
  status: string;
  publishedAt?: string | null;
  updatedAt?: string | null;
  onlineStoreUrl?: string | null;
  featuredMedia?: { preview?: { image?: { url?: string | null } | null } | null } | null;
  variants: { nodes: VariantNode[] };
}

export interface VariantNode {
  id: string;
  sku?: string | null;
  title: string;
  position?: number | null;
  price: string;
  compareAtPrice?: string | null;
  availableForSale: boolean;
  inventoryQuantity?: number | null;
  inventoryPolicy?: string | null;
  inventoryItem?: { unitCost?: { amount: string; currencyCode: string } | null } | null;
}

export interface CollectionNode {
  id: string;
  handle: string;
  title: string;
  descriptionHtml?: string | null;
  sortOrder?: string | null;
  productsCount?: { count: number } | null;
  products?: { nodes: { id: string }[] } | null;
}

export interface Page<T> {
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  nodes: T[];
}
