/**
 * Getting a product's primary packshot at its original resolution.
 *
 * Two things here are not obvious.
 *
 * **Shopify serves derivatives, not originals, unless you ask.** A CDN URL carries the
 * requested size in the filename (`bottle_600x600.jpg`, `bottle_1024x.jpg`,
 * `bottle_600x600_crop_center@2x.jpg`) or in the query (`?width=800`). Ingesting a derivative
 * would make the protected master a resampled copy of the artwork — exactly what ADR 0009 says
 * never to verify against. `originalImageUrl` strips the sizing and keeps `v`, which identifies
 * the uploaded version and is not a transform.
 *
 * **Image #1 is not always a clean packshot.** The store architecture says it should be, and
 * usually it is, but real catalogues contain bottle-plus-gift-box shots and lifestyle plates.
 * Nothing here can tell those apart from pixels alone; `pickPrimaryImage` returns position 1 and
 * the ingestion step measures what it got rather than assuming.
 */

/** Sizing suffixes Shopify appends before the extension, e.g. `_1024x1024_crop_center@2x`. */
const SIZE_SUFFIX =
  /_(?:\d+x\d*|x\d+)(?:_crop_(?:top|center|bottom|left|right))?(?:@[0-9.]+x)?(?=\.[a-z0-9]+$)/i;

/** Query parameters that ask the CDN for a transform rather than identifying the asset. */
const TRANSFORM_PARAMS = [
  'width',
  'height',
  'crop',
  'format',
  'quality',
  'scale',
  'pad_color',
  'size',
];

/**
 * The URL of the uploaded original behind a Shopify CDN URL.
 *
 * Returns the input unchanged when it is not a Shopify CDN URL, because a merchant may host an
 * image elsewhere and guessing at someone else's URL scheme would be worse than leaving it alone.
 */
export function originalImageUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  if (
    !/(^|\.)shopify\.com$/i.test(parsed.hostname) &&
    !/(^|\.)shopifycdn\.com$/i.test(parsed.hostname)
  ) {
    return url;
  }

  parsed.pathname = parsed.pathname.replace(SIZE_SUFFIX, '');
  for (const param of TRANSFORM_PARAMS) parsed.searchParams.delete(param);
  return parsed.toString();
}

export interface CatalogueImage {
  url: string;
  /** As the source reports it. The bytes are measured again after download. */
  width: number | null;
  height: number | null;
  altText: string | null;
  position: number;
}

export interface CatalogueProduct {
  /** Admin gid where there is one; the storefront source synthesises a stable id. */
  gid: string;
  handle: string;
  title: string;
  vendor: string | null;
  productType: string | null;
  status: string;
  images: CatalogueImage[];
  /** Everything the ground-truth check compares OCR against. */
  metadata: {
    /** Alcohol by volume as a percentage, where the catalogue states one. */
    abv: number | null;
    /** Container volume in millilitres, where the catalogue states one. */
    volumeMl: number | null;
  };
}

/** The primary packshot: position 1, per the store's image architecture. */
export function pickPrimaryImage(product: CatalogueProduct): CatalogueImage | null {
  if (product.images.length === 0) return null;
  return [...product.images].sort((a, b) => a.position - b.position)[0] ?? null;
}

/**
 * ABV as stated in a product's own text.
 *
 * Deliberately narrow. It reads "40% ABV", "40% alc/vol", "40% alcohol" and bare "40%" — and
 * nothing cleverer, because this number is used as *ground truth* to check an OCR read against.
 * A wrong guess here would accuse honest artwork. Returns null rather than reaching.
 */
export function parseAbv(...sources: (string | null | undefined)[]): number | null {
  for (const source of sources) {
    if (!source) continue;
    const match = source.match(
      /(\d{1,2}(?:\.\d)?)\s*%\s*(?:abv|alc(?:ohol)?\s*\/?\s*vol|alcohol)?/i,
    );
    if (!match?.[1]) continue;
    const value = Number(match[1]);
    // Beer through overproof spirit. Outside that it is some other percentage.
    if (value >= 0.5 && value <= 96) return value;
  }
  return null;
}

/** Container volume in millilitres, from "700ml", "1 Ltr", "1.75L", "75cl". */
export function parseVolumeMl(...sources: (string | null | undefined)[]): number | null {
  for (const source of sources) {
    if (!source) continue;
    const ml = source.match(/(\d{2,4})\s*ml\b/i);
    if (ml?.[1]) return Number(ml[1]);
    const cl = source.match(/(\d{2,3})\s*cl\b/i);
    if (cl?.[1]) return Number(cl[1]) * 10;
    const litre = source.match(/(\d(?:\.\d{1,2})?)\s*(?:l|ltr|litre|liter)\b/i);
    if (litre?.[1]) return Math.round(Number(litre[1]) * 1000);
  }
  return null;
}

/**
 * Where product images come from, as a port.
 *
 * The Admin API is the production source. A second implementation reads the public storefront
 * catalogue, because this container's network policy refuses `*.myshopify.com` at CONNECT while
 * allowing `cdn.shopify.com` — so the pipeline can be exercised on real artwork without an
 * Admin token, and without pretending an Admin call succeeded.
 */
export interface CatalogueSource {
  /** What this source is, for the audit record. Never a guess. */
  readonly describe: string;
  products(limit: number): Promise<CatalogueProduct[]>;
}

export const PRODUCT_MEDIA_PAGE_QUERY = `
query ProductMediaPage($cursor: String, $pageSize: Int!) {
  products(first: $pageSize, after: $cursor, sortKey: UPDATED_AT, query: "status:active") {
    pageInfo { hasNextPage endCursor }
    nodes {
      id
      handle
      title
      vendor
      productType
      status
      description
      media(first: 10) {
        nodes {
          ... on MediaImage {
            image { url width height altText }
          }
        }
      }
    }
  }
}`;

export interface MediaProductNode {
  id: string;
  handle: string;
  title: string;
  vendor?: string | null;
  productType?: string | null;
  status?: string | null;
  description?: string | null;
  media?: {
    nodes: {
      image?: {
        url?: string | null;
        width?: number | null;
        height?: number | null;
        altText?: string | null;
      } | null;
    }[];
  } | null;
}

/** Admin media node to the shape the ingestion works in. Pure, so it is tested without a network. */
export function mapMediaProduct(node: MediaProductNode): CatalogueProduct {
  const images: CatalogueImage[] = [];
  for (const media of node.media?.nodes ?? []) {
    const url = media.image?.url;
    if (!url) continue;
    images.push({
      url: originalImageUrl(url),
      width: media.image?.width ?? null,
      height: media.image?.height ?? null,
      altText: media.image?.altText ?? null,
      position: images.length + 1,
    });
  }

  return {
    gid: node.id,
    handle: node.handle,
    title: node.title,
    vendor: node.vendor ?? null,
    productType: node.productType ?? null,
    status: node.status ?? 'ACTIVE',
    images,
    metadata: {
      abv: parseAbv(node.title, node.description),
      volumeMl: parseVolumeMl(node.title, node.description),
    },
  };
}
