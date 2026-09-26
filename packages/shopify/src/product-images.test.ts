import { describe, expect, it } from 'vitest';
import {
  mapMediaProduct,
  originalImageUrl,
  parseAbv,
  parseVolumeMl,
  pickPrimaryImage,
  type CatalogueProduct,
} from './product-images.js';

/**
 * The URL shapes here are the ones the SPIRITHAUS CDN actually serves. The behaviour was checked
 * against it once: `HuskbamRum_600x600.webp` returns a 424x600 derivative, `?width=400` returns
 * 400x566, and the stripped URL returns the 1366x1932 original.
 */
describe('recovering the original behind a CDN URL', () => {
  it('strips a size suffix from the filename', () => {
    expect(
      originalImageUrl('https://cdn.shopify.com/s/files/1/0/files/bottle_600x600.jpg?v=123'),
    ).toBe('https://cdn.shopify.com/s/files/1/0/files/bottle.jpg?v=123');
  });

  it('strips one-sided, cropped and retina variants', () => {
    const base = 'https://cdn.shopify.com/s/files/1/0/files/bottle';
    expect(originalImageUrl(`${base}_1024x.png`)).toBe(`${base}.png`);
    expect(originalImageUrl(`${base}_x512.png`)).toBe(`${base}.png`);
    expect(originalImageUrl(`${base}_600x600_crop_center@2x.jpg?v=9`)).toBe(`${base}.jpg?v=9`);
  });

  it('strips transform query parameters but keeps the version', () => {
    expect(
      originalImageUrl(
        'https://cdn.shopify.com/s/files/1/0/files/bottle.png?v=7&width=800&height=600&crop=center',
      ),
    ).toBe('https://cdn.shopify.com/s/files/1/0/files/bottle.png?v=7');
  });

  it("leaves a URL that is not Shopify's alone", () => {
    // Another host's `_600x600` may be part of the filename. Guessing at someone else's scheme
    // would turn a working URL into a 404.
    const other = 'https://example.com/some/other_600x600.jpg?width=200';
    expect(originalImageUrl(other)).toBe(other);
  });

  it('returns unparseable input unchanged rather than throwing', () => {
    expect(originalImageUrl('not a url')).toBe('not a url');
  });
});

describe("reading strength and volume from a product's own text", () => {
  it('reads the forms a catalogue actually uses', () => {
    expect(parseAbv('Absolut Lime 40% ABV')).toBe(40);
    expect(parseAbv('Karu Affinity Gin 44% alc/vol')).toBe(44);
    expect(parseAbv('Something 43.5% alcohol')).toBe(43.5);
    expect(parseVolumeMl("Jack Daniel's Old No. 7 1 Ltr")).toBe(1000);
    expect(parseVolumeMl('Wild Turkey 101 700mL')).toBe(700);
    expect(parseVolumeMl('Half bottle 375ml')).toBe(375);
    expect(parseVolumeMl('European 75cl')).toBe(750);
  });

  it('refuses percentages that cannot be a strength', () => {
    // This value is used as ground truth against an OCR read. A wrong guess accuses honest
    // artwork, so the parser says nothing rather than something plausible.
    expect(parseAbv('Save 20%! Now 99% off')).toBe(20);
    expect(parseAbv('100% Australian owned')).toBeNull();
    expect(parseAbv('no numbers here')).toBeNull();
  });

  it('prefers the first source that states a value', () => {
    expect(parseAbv(null, '', 'Bottled at 47%')).toBe(47);
    expect(parseVolumeMl(undefined, 'no volume', '700ml')).toBe(700);
  });
});

describe('mapping an Admin media node', () => {
  const node = {
    id: 'gid://shopify/Product/1',
    handle: 'karu-lightning-gin',
    title: 'Karu Lightning Gin 700ml',
    vendor: 'Karu',
    productType: 'Gin',
    status: 'ACTIVE',
    description: 'A gin bottled at 44% alc/vol.',
    media: {
      nodes: [
        {
          image: {
            url: 'https://cdn.shopify.com/s/files/1/0/files/a_600x600.png?v=1',
            width: 600,
            height: 600,
            altText: 'front',
          },
        },
        { image: null },
        {
          image: {
            url: 'https://cdn.shopify.com/s/files/1/0/files/b.png',
            width: 1600,
            height: 1600,
            altText: null,
          },
        },
      ],
    },
  };

  it('keeps only real images, in order, at their original URLs', () => {
    const product = mapMediaProduct(node);
    expect(product.images).toHaveLength(2);
    expect(product.images[0]?.url).toBe('https://cdn.shopify.com/s/files/1/0/files/a.png?v=1');
    expect(product.images.map((image) => image.position)).toEqual([1, 2]);
  });

  it('carries the metadata the ground-truth check compares against', () => {
    const product = mapMediaProduct(node);
    expect(product.metadata.abv).toBe(44);
    expect(product.metadata.volumeMl).toBe(700);
  });

  it('picks image #1 as the primary packshot regardless of array order', () => {
    const product: CatalogueProduct = {
      ...mapMediaProduct(node),
      images: [
        { url: 'second', width: null, height: null, altText: null, position: 2 },
        { url: 'first', width: null, height: null, altText: null, position: 1 },
      ],
    };
    expect(pickPrimaryImage(product)?.url).toBe('first');
  });

  it('returns nothing for a product with no images', () => {
    expect(pickPrimaryImage({ ...mapMediaProduct(node), images: [] })).toBeNull();
  });
});
