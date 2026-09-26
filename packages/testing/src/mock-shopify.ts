import { CATALOGUE, COLLECTIONS } from './fixtures.js';
import type { CollectionNode, ProductNode } from '@spirithaus/shopify';

export interface MockShopifyOptions {
  products?: ProductNode[];
  collections?: CollectionNode[];
  /** Answer the first N calls with a throttle, to exercise retry paths. */
  throttleFirst?: number;
  /** Answer the first N calls with a 500. */
  failFirst?: number;
  /** Return a token rejection on every call. */
  unauthorised?: boolean;
  /** Return the same cursor forever, to exercise the loop guard. */
  stuckCursor?: boolean;
}

/**
 * A mock Shopify Admin GraphQL endpoint as a `fetch` implementation, so the sync is
 * exercised through the real client — headers, throttle handling, error
 * classification and all — rather than against a stubbed client that cannot fail the
 * way Shopify does.
 */
export class MockShopify {
  calls: { query: string; variables: Record<string, unknown> }[] = [];
  private callCount = 0;

  constructor(private readonly options: MockShopifyOptions = {}) {}

  private get products(): ProductNode[] {
    return this.options.products ?? CATALOGUE;
  }

  private get collections(): CollectionNode[] {
    return this.options.collections ?? COLLECTIONS;
  }

  readonly fetch: typeof fetch = async (_input, init) => {
    this.callCount += 1;
    const body = JSON.parse(String(init?.body ?? '{}')) as {
      query: string;
      variables: Record<string, unknown>;
    };
    this.calls.push({ query: body.query, variables: body.variables });

    if (this.options.unauthorised)
      return this.response(401, { errors: [{ message: 'Unauthorized' }] });
    if (this.options.failFirst && this.callCount <= this.options.failFirst) {
      return this.response(500, { errors: [{ message: 'Internal' }] });
    }
    if (this.options.throttleFirst && this.callCount <= this.options.throttleFirst) {
      return this.response(200, {
        errors: [{ message: 'Throttled', extensions: { code: 'THROTTLED' } }],
      });
    }

    const pageSize = Number(body.variables.pageSize ?? 50);
    const cursor = (body.variables.cursor as string | null) ?? null;

    // Routed on the operation name, not on a substring of the body: the collections
    // query itself contains `products(first: 250)`, so substring routing sends it to
    // the wrong branch.
    if (body.query.includes('query ProductsPage')) {
      return this.response(200, {
        data: { products: this.page(this.products, cursor, pageSize) },
        extensions: this.cost(),
      });
    }
    if (body.query.includes('query CollectionsPage')) {
      return this.response(200, {
        data: { collections: this.page(this.collections, cursor, pageSize) },
        extensions: this.cost(),
      });
    }
    if (body.query.includes('query ShopContext')) {
      return this.response(200, {
        data: {
          shop: {
            name: 'SPIRITHAUS',
            ianaTimezone: 'Australia/Sydney',
            currencyCode: 'AUD',
            myshopifyDomain: 'spirithaus-dev.myshopify.com',
          },
        },
      });
    }

    return this.response(200, { errors: [{ message: 'unrecognised query' }] });
  };

  private page<T extends { id: string }>(items: T[], cursor: string | null, pageSize: number) {
    const start = cursor ? items.findIndex((item) => item.id === cursor) + 1 : 0;
    const slice = items.slice(start, start + pageSize);
    const last = slice.at(-1);
    const hasNextPage = start + pageSize < items.length;
    return {
      pageInfo: {
        hasNextPage,
        endCursor: this.options.stuckCursor ? (cursor ?? last?.id ?? null) : (last?.id ?? null),
      },
      nodes: slice,
    };
  }

  private cost() {
    return {
      cost: {
        requestedQueryCost: 52,
        actualQueryCost: 48,
        throttleStatus: { currentlyAvailable: 1952, restoreRate: 100 },
      },
    };
  }

  private response(status: number, payload: unknown): Response {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json', 'x-request-id': `mock-${this.callCount}` },
    });
  }
}
