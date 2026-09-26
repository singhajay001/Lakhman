import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@spirithaus/db';
import { CATALOGUE, MockShopify } from '@spirithaus/testing';
import { AdminClient } from './admin-client.js';
import { PrismaProductStore } from './prisma-store.js';
import { syncCollections, syncProducts } from './sync.js';

const DOMAIN = 'sync-integration.myshopify.com';
let shopId: string;

const client = (shopify: MockShopify) =>
  new AdminClient({
    shopDomain: DOMAIN,
    accessToken: 'shpat_test',
    apiVersion: '2025-07',
    fetchImpl: shopify.fetch,
    sleep: async () => {},
  });

beforeEach(async () => {
  // TRUNCATE rather than DELETE: audit_event rejects a row DELETE, and a truncate
  // fires a TRUNCATE trigger instead.
  await prisma.$executeRawUnsafe(
    'TRUNCATE shopify_collection_product, shopify_variant, shopify_product, shopify_collection, sync_run, audit_event, shop CASCADE',
  );
  const shop = await prisma.shop.create({ data: { domain: DOMAIN } });
  shopId = shop.id;
});

afterAll(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE shopify_collection_product, shopify_variant, shopify_product, shopify_collection, sync_run, audit_event, shop CASCADE',
  );
  await prisma.$disconnect();
});

describe('a product sync into Postgres', () => {
  it('mirrors the catalogue, its variants and its money', async () => {
    const result = await syncProducts({
      client: client(new MockShopify()),
      store: new PrismaProductStore(shopId),
      pageSize: 2,
    });
    expect(result.ok).toBe(true);

    const products = await prisma.shopifyProduct.findMany({
      where: { shopId },
      include: { variants: true },
      orderBy: { handle: 'asc' },
    });
    expect(products).toHaveLength(CATALOGUE.length);

    const applewood = products.find((product) => product.handle === 'applewood-gin');
    expect(applewood?.status).toBe('ACTIVE');
    expect(applewood?.variants).toHaveLength(1);
    // Decimal(12,4) all the way through: the price that went in is the price that
    // comes out, to the cent.
    expect(applewood?.variants[0]?.price.toString()).toBe('89.99');
    expect(applewood?.variants[0]?.unitCost?.toString()).toBe('48.5');

    const starward = products.find((product) => product.handle === 'starward-nova');
    expect(starward?.variants[0]?.compareAtPrice?.toString()).toBe('110');
    // No unit cost upstream, so none stored — margin must report itself as estimated
    // rather than inventing a cost.
    expect(starward?.variants[0]?.unitCost).toBeNull();

    const draft = products.find((product) => product.handle === 'unreleased-cask');
    expect(draft?.status).toBe('DRAFT');
    expect(draft?.onlineStoreUrl).toBeNull();
  });

  it('is idempotent: a second sync updates rather than duplicates', async () => {
    const store = new PrismaProductStore(shopId);
    await syncProducts({ client: client(new MockShopify()), store });
    await syncProducts({ client: client(new MockShopify()), store });

    expect(await prisma.shopifyProduct.count({ where: { shopId } })).toBe(CATALOGUE.length);
    expect(await prisma.shopifyVariant.count({ where: { shopId } })).toBe(CATALOGUE.length);
  });

  it('archives a product Shopify stopped returning, and never deletes it', async () => {
    const store = new PrismaProductStore(shopId);
    await syncProducts({ client: client(new MockShopify()), store });

    // The next sync sees a catalogue with one product withdrawn.
    const withoutStarward = CATALOGUE.filter((product) => product.handle !== 'starward-nova');
    await syncProducts({
      client: client(new MockShopify({ products: withoutStarward })),
      store,
    });

    const starward = await prisma.shopifyProduct.findFirst({
      where: { shopId, handle: 'starward-nova' },
      include: { variants: true },
    });

    // Section 31: revalidate, do not delete. The row survives so a published post
    // referencing it fails its preflight check instead of pointing at nothing.
    expect(starward).not.toBeNull();
    expect(starward?.status).toBe('ARCHIVED');
    expect(starward?.variants[0]?.availableForSale).toBe(false);
    expect(starward?.variants[0]?.inventoryQuantity).toBe(0);
  });

  it('brings an archived product back when Shopify returns it again', async () => {
    const store = new PrismaProductStore(shopId);
    const withoutStarward = CATALOGUE.filter((product) => product.handle !== 'starward-nova');
    await syncProducts({ client: client(new MockShopify({ products: withoutStarward })), store });
    await syncProducts({ client: client(new MockShopify()), store });

    const starward = await prisma.shopifyProduct.findFirst({
      where: { shopId, handle: 'starward-nova' },
    });
    expect(starward?.status).toBe('ACTIVE');
  });

  it('stores collection membership, and replaces it rather than accumulating it', async () => {
    const store = new PrismaProductStore(shopId);
    await syncProducts({ client: client(new MockShopify()), store });
    await syncCollections({ client: client(new MockShopify()), store });

    const gin = await prisma.shopifyCollection.findFirst({
      where: { shopId, handle: 'gin' },
      include: { products: true },
    });
    expect(gin?.productCount).toBe(2);
    expect(gin?.products).toHaveLength(2);

    // Re-running must not double the join rows.
    await syncCollections({ client: client(new MockShopify()), store });
    const again = await prisma.shopifyCollection.findFirst({
      where: { shopId, handle: 'gin' },
      include: { products: true },
    });
    expect(again?.products).toHaveLength(2);
  });

  it('keeps one shop’s catalogue out of another’s', async () => {
    const other = await prisma.shop.create({ data: { domain: 'other-shop.myshopify.com' } });
    await syncProducts({
      client: client(new MockShopify()),
      store: new PrismaProductStore(shopId),
    });

    expect(await prisma.shopifyProduct.count({ where: { shopId: other.id } })).toBe(0);
    expect(await new PrismaProductStore(other.id).knownProductGids()).toEqual([]);
  });
});
