import type { AdminClient, AdminResult } from './admin-client.js';
import {
  PRODUCT_MEDIA_PAGE_QUERY,
  mapMediaProduct,
  originalImageUrl,
  parseAbv,
  parseVolumeMl,
  type CatalogueProduct,
  type CatalogueSource,
  type MediaProductNode,
} from './product-images.js';
import type { Page } from './queries.js';

/** The production source: the Admin GraphQL API, through the same client as the product sync. */
export class AdminCatalogueSource implements CatalogueSource {
  readonly describe: string;

  constructor(
    private readonly client: AdminClient,
    shopDomain: string,
  ) {
    this.describe = `Shopify Admin GraphQL (${shopDomain})`;
  }

  async products(limit: number): Promise<CatalogueProduct[]> {
    const collected: CatalogueProduct[] = [];
    let cursor: string | null = null;

    while (collected.length < limit) {
      const pageSize = Math.min(50, limit - collected.length);
      const response: AdminResult<{ products: Page<MediaProductNode> }> = await this.client.query(
        PRODUCT_MEDIA_PAGE_QUERY,
        { cursor, pageSize },
      );
      if (!response.ok) {
        throw new Error(`${response.error.class}: ${response.error.message}`);
      }

      const page: Page<MediaProductNode> = response.value.data.products;
      for (const node of page.nodes) collected.push(mapMediaProduct(node));

      if (!page.pageInfo.hasNextPage) break;
      if (page.pageInfo.endCursor === cursor) break;
      cursor = page.pageInfo.endCursor;
    }

    return collected.slice(0, limit);
  }
}

interface StorefrontImage {
  src: string;
  width?: number | null;
  height?: number | null;
  position?: number | null;
  alt?: string | null;
}

interface StorefrontProduct {
  id: number;
  handle: string;
  title: string;
  vendor?: string | null;
  product_type?: string | null;
  body_html?: string | null;
  images?: StorefrontImage[];
  variants?: { title?: string | null }[];
}

/**
 * The public storefront catalogue (`/products.json`).
 *
 * This reads only what any visitor can see: published products and their image URLs. It carries
 * no token, reaches no Admin endpoint and touches no customer data. It exists because a network
 * policy can permit `cdn.shopify.com` while refusing `*.myshopify.com`, and because ingesting
 * real artwork is worth more than ingesting a synthetic bottle.
 *
 * It is not a substitute for the Admin source: it cannot see draft or archived products, reports
 * no product status, and has no metafields. Those limits are stated rather than papered over, and
 * `describe` says which source an asset came from so the audit record never implies Admin.
 */
export class StorefrontCatalogueSource implements CatalogueSource {
  readonly describe: string;

  constructor(
    private readonly origin: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.describe = `Shopify public storefront catalogue (${origin})`;
  }

  async products(limit: number): Promise<CatalogueProduct[]> {
    const collected: CatalogueProduct[] = [];

    for (let page = 1; collected.length < limit && page <= 20; page += 1) {
      const url = new URL('/products.json', this.origin);
      url.searchParams.set('limit', '250');
      url.searchParams.set('page', String(page));

      const response = await this.fetchImpl(url.toString(), {
        headers: { accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`storefront catalogue returned ${response.status} for ${url.pathname}`);
      }

      const body = (await response.json()) as { products?: StorefrontProduct[] };
      const products = body.products ?? [];
      if (products.length === 0) break;

      for (const product of products) {
        collected.push(this.map(product));
        if (collected.length >= limit) break;
      }
    }

    return collected;
  }

  private map(product: StorefrontProduct): CatalogueProduct {
    const images = (product.images ?? []).map((image, index) => ({
      url: originalImageUrl(image.src),
      width: image.width ?? null,
      height: image.height ?? null,
      altText: image.alt ?? null,
      position: image.position ?? index + 1,
    }));

    const variantTitles = (product.variants ?? []).map((variant) => variant.title ?? '').join(' ');

    return {
      // Not an Admin gid. Shaped like one so downstream keys are uniform, and tagged so nobody
      // mistakes a storefront id for something the Admin API issued.
      gid: `storefront://product/${product.id}`,
      handle: product.handle,
      title: product.title,
      vendor: product.vendor ?? null,
      productType: product.product_type ?? null,
      // The storefront only lists published products; it never reports a status field.
      status: 'PUBLISHED',
      images,
      metadata: {
        abv: parseAbv(product.title, variantTitles, product.body_html),
        volumeMl: parseVolumeMl(product.title, variantTitles, product.body_html),
      },
    };
  }
}
