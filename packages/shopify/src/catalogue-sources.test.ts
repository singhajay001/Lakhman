import { describe, expect, it, vi } from 'vitest';
import { AdminCatalogueSource, StorefrontCatalogueSource } from './catalogue-sources.js';
import { AdminClient } from './admin-client.js';

const page = (products: unknown[]) =>
  new Response(JSON.stringify({ products }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const storefrontProduct = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  handle: `product-${id}`,
  title: `Product ${id} 700ml`,
  vendor: 'Vendor',
  product_type: 'Gin',
  body_html: '<p>Bottled at 42% alc/vol.</p>',
  images: [
    {
      src: `https://cdn.shopify.com/s/files/1/0/files/p${id}_600x600.jpg?v=1`,
      width: 600,
      height: 600,
      position: 1,
      alt: null,
    },
  ],
  variants: [{ title: 'Default' }],
  ...overrides,
});

describe('the public storefront catalogue source', () => {
  it('reads products and normalises their image URLs to the original', async () => {
    const fetchImpl = vi.fn(async () => page([storefrontProduct(1)]));
    const source = new StorefrontCatalogueSource('https://shop.example', fetchImpl as never);

    const products = await source.products(1);
    expect(products).toHaveLength(1);
    expect(products[0]?.images[0]?.url).toBe(
      'https://cdn.shopify.com/s/files/1/0/files/p1.jpg?v=1',
    );
    expect(products[0]?.metadata).toEqual({ abv: 42, volumeMl: 700 });
  });

  it('marks its ids as storefront ids, so none is mistaken for an Admin gid', async () => {
    const fetchImpl = vi.fn(async () => page([storefrontProduct(7)]));
    const source = new StorefrontCatalogueSource('https://shop.example', fetchImpl as never);
    const products = await source.products(1);
    expect(products[0]?.gid).toBe('storefront://product/7');
    // The audit record must never imply an Admin read happened.
    expect(source.describe).toContain('public storefront');
  });

  it('pages until the limit is reached and then stops asking', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(page([storefrontProduct(1), storefrontProduct(2)]))
      .mockResolvedValueOnce(page([storefrontProduct(3)]));
    const source = new StorefrontCatalogueSource('https://shop.example', fetchImpl as never);

    const products = await source.products(3);
    expect(products.map((product) => product.handle)).toEqual([
      'product-1',
      'product-2',
      'product-3',
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('stops on an empty page rather than paging forever', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(page([storefrontProduct(1)]))
      .mockResolvedValue(page([]));
    const source = new StorefrontCatalogueSource('https://shop.example', fetchImpl as never);

    expect(await source.products(50)).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('raises the status rather than returning an empty catalogue', async () => {
    // A 403 that reads as "no products" would quietly ingest nothing and report success.
    const fetchImpl = vi.fn(async () => new Response('denied', { status: 403 }));
    const source = new StorefrontCatalogueSource('https://shop.example', fetchImpl as never);
    await expect(source.products(1)).rejects.toThrow('403');
  });

  it('tolerates a product with no images or variants', async () => {
    const fetchImpl = vi.fn(async () =>
      page([storefrontProduct(9, { images: undefined, variants: undefined, body_html: null })]),
    );
    const source = new StorefrontCatalogueSource('https://shop.example', fetchImpl as never);
    const products = await source.products(1);
    expect(products[0]?.images).toEqual([]);
    expect(products[0]?.metadata.abv).toBeNull();
  });
});

describe('the Admin catalogue source', () => {
  const adminPage = (nodes: unknown[], hasNextPage = false, endCursor = 'a') =>
    new Response(
      JSON.stringify({ data: { products: { pageInfo: { hasNextPage, endCursor }, nodes } } }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );

  const node = (id: number) => ({
    id: `gid://shopify/Product/${id}`,
    handle: `admin-${id}`,
    title: `Admin ${id} 700ml`,
    vendor: 'V',
    productType: 'Whisky',
    status: 'ACTIVE',
    description: '40% alc/vol',
    media: {
      nodes: [
        {
          image: {
            url: `https://cdn.shopify.com/s/files/1/0/files/a${id}_1024x.png`,
            width: 1024,
            height: 1024,
            altText: null,
          },
        },
      ],
    },
  });

  it('maps products and strips CDN sizing', async () => {
    const fetchImpl = vi.fn(async () => adminPage([node(1)]));
    const client = new AdminClient({
      shopDomain: 'x.myshopify.com',
      accessToken: 't',
      apiVersion: '2025-07',
      fetchImpl: fetchImpl as never,
    });
    const source = new AdminCatalogueSource(client, 'x.myshopify.com');

    const products = await source.products(10);
    expect(products[0]?.images[0]?.url).toBe('https://cdn.shopify.com/s/files/1/0/files/a1.png');
    expect(source.describe).toContain('Admin GraphQL');
  });

  it('stops when the cursor stops advancing rather than looping', async () => {
    const fetchImpl = vi.fn(async () => adminPage([node(1)], true, 'same'));
    const client = new AdminClient({
      shopDomain: 'x.myshopify.com',
      accessToken: 't',
      apiVersion: '2025-07',
      fetchImpl: fetchImpl as never,
    });
    const source = new AdminCatalogueSource(client, 'x.myshopify.com');

    const products = await source.products(100);
    expect(products.length).toBeGreaterThan(0);
    expect(fetchImpl.mock.calls.length).toBeLessThan(5);
  });

  it('raises rather than returning a partial catalogue when Admin fails', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 401 }));
    const client = new AdminClient({
      shopDomain: 'x.myshopify.com',
      accessToken: 't',
      apiVersion: '2025-07',
      fetchImpl: fetchImpl as never,
    });
    const source = new AdminCatalogueSource(client, 'x.myshopify.com');
    await expect(source.products(1)).rejects.toThrow();
  });
});
