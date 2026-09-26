import { err, ok, type Result } from '@spirithaus/domain';
import { childLogger } from '@spirithaus/observability';
import type { AdminClient, AdminError, AdminResult } from './admin-client.js';
import { mapCollection, mapProduct, type MappedCollection, type MappedProduct } from './mapping.js';
import {
  COLLECTIONS_PAGE_QUERY,
  PRODUCTS_PAGE_QUERY,
  type CollectionNode,
  type Page,
  type ProductNode,
} from './queries.js';

export interface SyncCounts {
  /** Index signature so a counts object is directly storable as JSON. */
  [key: string]: number;
  productsSeen: number;
  productsUpserted: number;
  variantsUpserted: number;
  collectionsSeen: number;
  collectionsUpserted: number;
  pages: number;
}

/**
 * What the sync needs from the database, expressed as a port. The sync is then
 * testable against an in-memory store, and the Prisma implementation lives with the
 * app rather than inside this package.
 */
export interface ProductStore {
  upsertProduct(product: MappedProduct): Promise<void>;
  upsertCollection(collection: MappedCollection): Promise<void>;
  /** Every product gid currently in the mirror, for reconciliation. */
  knownProductGids(): Promise<string[]>;
  /** Marks products Shopify no longer returns. Never deletes — section 31. */
  markMissing(gids: string[]): Promise<void>;
}

export interface SyncDeps {
  client: AdminClient;
  store: ProductStore;
  pageSize?: number;
  /** Guards against an unbounded loop if a cursor ever stops advancing. */
  maxPages?: number;
  onProgress?: (counts: SyncCounts) => void;
}

const emptyCounts = (): SyncCounts => ({
  productsSeen: 0,
  productsUpserted: 0,
  variantsUpserted: 0,
  collectionsSeen: 0,
  collectionsUpserted: 0,
  pages: 0,
});

export async function syncProducts(deps: SyncDeps): Promise<Result<SyncCounts, AdminError>> {
  const log = childLogger({ job: 'shopify-sync', part: 'products' });
  const pageSize = deps.pageSize ?? 50;
  const maxPages = deps.maxPages ?? 1000;
  const counts = emptyCounts();
  const seen = new Set<string>();

  let cursor: string | null = null;
  for (let page = 0; page < maxPages; page += 1) {
    const response: AdminResult<{ products: Page<ProductNode> }> = await deps.client.query(
      PRODUCTS_PAGE_QUERY,
      { cursor, pageSize },
    );
    if (!response.ok) return err(response.error);

    const productsPage: Page<ProductNode> = response.value.data.products;
    const { nodes, pageInfo } = productsPage;
    counts.pages += 1;

    for (const node of nodes) {
      const mapped = mapProduct(node);
      seen.add(mapped.gid);
      counts.productsSeen += 1;
      await deps.store.upsertProduct(mapped);
      counts.productsUpserted += 1;
      counts.variantsUpserted += mapped.variants.length;
    }

    deps.onProgress?.({ ...counts });

    if (!pageInfo.hasNextPage) {
      // Reconciliation is part of the sync, not a separate hope: a product that
      // stopped being returned is marked, and marking is not deleting.
      const known = await deps.store.knownProductGids();
      const missing = known.filter((gid) => !seen.has(gid));
      if (missing.length > 0) {
        log.info(
          { missing: missing.length },
          'products in the mirror are no longer returned by Shopify',
        );
        await deps.store.markMissing(missing);
      }
      return ok(counts);
    }

    if (pageInfo.endCursor === cursor) {
      return err({
        class: 'unavailable',
        message: 'Shopify returned the same cursor twice; stopping rather than looping.',
        retryable: false,
      });
    }
    cursor = pageInfo.endCursor;
  }

  return err({
    class: 'unavailable',
    message: `Product sync exceeded ${maxPages} pages and stopped.`,
    retryable: false,
  });
}

export async function syncCollections(deps: SyncDeps): Promise<Result<SyncCounts, AdminError>> {
  const pageSize = deps.pageSize ?? 50;
  const maxPages = deps.maxPages ?? 200;
  const counts = emptyCounts();

  let cursor: string | null = null;
  for (let page = 0; page < maxPages; page += 1) {
    const response: AdminResult<{ collections: Page<CollectionNode> }> = await deps.client.query(
      COLLECTIONS_PAGE_QUERY,
      { cursor, pageSize },
    );
    if (!response.ok) return err(response.error);

    const collectionsPage: Page<CollectionNode> = response.value.data.collections;
    const { nodes, pageInfo } = collectionsPage;
    counts.pages += 1;

    for (const node of nodes) {
      counts.collectionsSeen += 1;
      await deps.store.upsertCollection(mapCollection(node));
      counts.collectionsUpserted += 1;
    }

    deps.onProgress?.({ ...counts });

    if (!pageInfo.hasNextPage) return ok(counts);
    if (pageInfo.endCursor === cursor) {
      return err({
        class: 'unavailable',
        message: 'Shopify returned the same cursor twice; stopping rather than looping.',
        retryable: false,
      });
    }
    cursor = pageInfo.endCursor;
  }

  return err({
    class: 'unavailable',
    message: `Collection sync exceeded ${maxPages} pages and stopped.`,
    retryable: false,
  });
}
