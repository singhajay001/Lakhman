import type { MappedCollection, MappedProduct, ProductStore } from '@spirithaus/shopify';

/** In-memory ProductStore, for testing the sync without a database. */
export class MemoryProductStore implements ProductStore {
  readonly products = new Map<string, MappedProduct>();
  readonly collections = new Map<string, MappedCollection>();
  readonly markedMissing: string[] = [];

  async upsertProduct(product: MappedProduct): Promise<void> {
    this.products.set(product.gid, product);
  }

  async upsertCollection(collection: MappedCollection): Promise<void> {
    this.collections.set(collection.gid, collection);
  }

  async knownProductGids(): Promise<string[]> {
    return [...this.products.keys()];
  }

  async markMissing(gids: string[]): Promise<void> {
    this.markedMissing.push(...gids);
  }
}
