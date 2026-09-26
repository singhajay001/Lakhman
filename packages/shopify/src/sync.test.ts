import { describe, expect, it } from 'vitest';
import { CATALOGUE, MemoryProductStore, MockShopify, product } from '@spirithaus/testing';
import { AdminClient } from './admin-client.js';
import { syncCollections, syncProducts } from './sync.js';

const client = (shopify: MockShopify) =>
  new AdminClient({
    shopDomain: 'spirithaus-dev.myshopify.com',
    accessToken: 'shpat_test',
    apiVersion: '2025-07',
    fetchImpl: shopify.fetch,
    sleep: async () => {},
  });

describe('syncProducts', () => {
  it('mirrors the whole catalogue', async () => {
    const shopify = new MockShopify();
    const store = new MemoryProductStore();
    const result = await syncProducts({ client: client(shopify), store });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.productsSeen).toBe(CATALOGUE.length);
    expect(store.products.size).toBe(CATALOGUE.length);
    expect(store.products.get('gid://shopify/Product/1')?.handle).toBe('applewood-gin');
  });

  it('paginates, and counts the pages it walked', async () => {
    const shopify = new MockShopify();
    const store = new MemoryProductStore();
    const result = await syncProducts({ client: client(shopify), store, pageSize: 2 });

    if (!result.ok) throw new Error('expected ok');
    expect(result.value.pages).toBe(3); // 5 fixtures at 2 per page
    expect(store.products.size).toBe(5);
    expect(shopify.calls).toHaveLength(3);
  });

  it('reports progress as it goes', async () => {
    const seen: number[] = [];
    await syncProducts({
      client: client(new MockShopify()),
      store: new MemoryProductStore(),
      pageSize: 2,
      onProgress: (counts) => seen.push(counts.productsSeen),
    });
    expect(seen).toEqual([2, 4, 5]);
  });

  it('marks a product the mirror holds and Shopify no longer returns, without deleting it', async () => {
    const store = new MemoryProductStore();
    // A product that was synced previously and has since been removed upstream.
    await store.upsertProduct({
      gid: 'gid://shopify/Product/999',
      handle: 'gone',
      title: 'Gone',
      descriptionHtml: null,
      productType: null,
      vendor: null,
      tags: [],
      status: 'ACTIVE',
      featuredImageUrl: null,
      onlineStoreUrl: null,
      publishedAt: null,
      shopifyUpdatedAt: null,
      variants: [],
    });

    const result = await syncProducts({ client: client(new MockShopify()), store });
    expect(result.ok).toBe(true);
    expect(store.markedMissing).toEqual(['gid://shopify/Product/999']);
    // Section 31: revalidate, do not delete.
    expect(store.products.has('gid://shopify/Product/999')).toBe(true);
  });

  it('marks nothing when the mirror matches Shopify', async () => {
    const store = new MemoryProductStore();
    await syncProducts({ client: client(new MockShopify()), store });
    await syncProducts({ client: client(new MockShopify()), store });
    expect(store.markedMissing).toEqual([]);
  });

  it('survives a throttle and completes', async () => {
    const shopify = new MockShopify({ throttleFirst: 2 });
    const store = new MemoryProductStore();
    const result = await syncProducts({ client: client(shopify), store });
    expect(result.ok).toBe(true);
    expect(shopify.calls.length).toBeGreaterThan(1);
  });

  it('gives up on a rejected token without retrying, and says the app may need reinstalling', async () => {
    const result = await syncProducts({
      client: client(new MockShopify({ unauthorised: true })),
      store: new MemoryProductStore(),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.class).toBe('auth');
    expect(result.error.retryable).toBe(false);
    expect(result.error.message).toContain('reinstalling');
  });

  it('stops rather than looping when the cursor stops advancing', async () => {
    const result = await syncProducts({
      client: client(new MockShopify({ stuckCursor: true })),
      store: new MemoryProductStore(),
      pageSize: 2,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('same cursor twice');
  });

  it('stops at the page ceiling rather than running forever', async () => {
    const many = Array.from({ length: 30 }, (_unused, index) =>
      product({ id: `gid://shopify/Product/${index}`, handle: `p-${index}` }),
    );
    const result = await syncProducts({
      client: client(new MockShopify({ products: many })),
      store: new MemoryProductStore(),
      pageSize: 1,
      maxPages: 3,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('exceeded 3 pages');
  });

  it('does not mark anything missing when it failed part way', async () => {
    // A half-finished sync must not conclude that the rest of the catalogue is gone.
    const store = new MemoryProductStore();
    await syncProducts({ client: client(new MockShopify()), store });
    store.markedMissing.length = 0;

    await syncProducts({
      client: client(new MockShopify({ unauthorised: true })),
      store,
    });
    expect(store.markedMissing).toEqual([]);
  });
});

describe('syncCollections', () => {
  it('mirrors collections and their membership', async () => {
    const store = new MemoryProductStore();
    const result = await syncCollections({ client: client(new MockShopify()), store });
    if (!result.ok) throw new Error('expected ok');
    expect(result.value.collectionsSeen).toBe(2);
    expect(store.collections.get('gid://shopify/Collection/2')?.productGids).toHaveLength(2);
  });

  it('propagates a transient failure after retrying', async () => {
    const result = await syncCollections({
      client: client(new MockShopify({ failFirst: 10 })),
      store: new MemoryProductStore(),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.class).toBe('transient');
  });
});
