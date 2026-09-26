import sharp from 'sharp';

/**
 * Synthetic product fixtures.
 *
 * The real SPIRITHAUS packshots are not reachable from this environment (`cdn.shopify.com`
 * is refused), and a scene photograph is not a packshot. So the protected-product pipeline
 * is exercised against a bottle this module draws: a silhouette with alpha, and a label
 * carrying real text that OCR can read and that a test can deliberately falsify.
 *
 * That is a better test subject than a real photograph in one respect — the corruption is
 * exact, so "the label now says 45%" is a one-character change rather than a judgement.
 */
export interface BottleOptions {
  width?: number;
  height?: number;
  /** The name line on the label. */
  name?: string;
  /** The statement line: strength and volume. */
  statement?: string;
  /** Label background, so a colour shift can be introduced deliberately. */
  labelHex?: string;
  /** Label text colour. */
  inkHex?: string;
  /** Nudges the label down by this many pixels, to introduce a geometry change. */
  labelOffsetY?: number;
  /** Glass colour. */
  glassHex?: string;
}

export const DEFAULT_BOTTLE: Required<BottleOptions> = {
  width: 600,
  height: 1200,
  name: 'APPLEWOOD GIN',
  statement: '43% ABV 700ml',
  labelHex: '#f2efe9',
  inkHex: '#111110',
  labelOffsetY: 0,
  glassHex: '#3a5a3f',
};

function bottleSvg(options: Required<BottleOptions>): string {
  const { width: w, height: h } = options;
  const bodyTop = h * 0.3;
  const neckW = w * 0.28;
  const labelX = w * 0.16;
  const labelY = h * 0.52 + options.labelOffsetY;
  const labelW = w * 0.68;
  const labelH = h * 0.24;

  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="glass" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${options.glassHex}" stop-opacity="0.95"/>
      <stop offset="45%" stop-color="#8fae92" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="${options.glassHex}" stop-opacity="0.95"/>
    </linearGradient>
  </defs>
  <g>
    <rect x="${(w - neckW) / 2}" y="${h * 0.06}" width="${neckW}" height="${bodyTop - h * 0.06}" fill="url(#glass)"/>
    <rect x="${(w - neckW * 1.25) / 2}" y="${h * 0.04}" width="${neckW * 1.25}" height="${h * 0.035}" fill="#1b1b1a"/>
    <rect x="${w * 0.1}" y="${bodyTop}" width="${w * 0.8}" height="${h * 0.64}" rx="${w * 0.08}" fill="url(#glass)"/>
    <rect x="${labelX}" y="${labelY}" width="${labelW}" height="${labelH}" fill="${options.labelHex}"/>
    <text x="${labelX + labelW / 2}" y="${labelY + labelH * 0.42}" font-family="DejaVu Sans, sans-serif" font-size="${w * 0.078}" font-weight="bold" fill="${options.inkHex}" text-anchor="middle">${options.name}</text>
    <text x="${labelX + labelW / 2}" y="${labelY + labelH * 0.78}" font-family="DejaVu Sans, sans-serif" font-size="${w * 0.062}" fill="${options.inkHex}" text-anchor="middle">${options.statement}</text>
  </g>
</svg>`;
}

/** A PNG with alpha: the bottle, on transparency, as a cutout master would arrive. */
export async function bottlePng(options: BottleOptions = {}): Promise<Buffer> {
  const merged = { ...DEFAULT_BOTTLE, ...options };
  return sharp(Buffer.from(bottleSvg(merged)))
    .png()
    .toBuffer();
}

/**
 * The protected label region, normalised on the master.
 *
 * Drawn with a margin around the printed area rather than flush to it, which is both what a
 * reviewer would do by hand and what OCR needs: a crop flush to the label clipped the first
 * and last glyphs and read "PPLEWOOD GIT" instead of "APPLEWOOD GIN".
 */
export function labelRegion(options: BottleOptions = {}): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const merged = { ...DEFAULT_BOTTLE, ...options };
  return {
    x: 0.12,
    y: 0.5 + merged.labelOffsetY / merged.height,
    w: 0.76,
    h: 0.28,
  };
}

/** A plausible generated environment: a warm gradient with grain, no product in it. */
export async function environmentPng(width: number, height: number, seed = 1): Promise<Buffer> {
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="light" cx="0.3" cy="0.25" r="0.8">
      <stop offset="0%" stop-color="#6b5136"/>
      <stop offset="55%" stop-color="#241d15"/>
      <stop offset="100%" stop-color="#0d0c0a"/>
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#light)"/>
  <rect y="${height * 0.72}" width="${width}" height="${height * 0.28}" fill="#1a1611" opacity="0.7"/>
  <circle cx="${width * (0.2 + (seed % 5) * 0.12)}" cy="${height * 0.8}" r="${width * 0.06}" fill="#2b2118" opacity="0.6"/>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * A packshot as a supplier actually ships one: the bottle on an opaque white backdrop, with no
 * alpha at all. Roughly a third of the primary images in the SPIRITHAUS catalogue look like this,
 * and they are the ones the cutout step exists for.
 *
 * `backdropHex` exists so a test can prove the cutout subtracts the backdrop it measured rather
 * than assuming white, and `noise` so a test can prove a textured backdrop is refused instead of
 * being hacked at.
 */
export async function packshotOnBackdropPng(
  options: BottleOptions & { backdropHex?: string; noise?: number } = {},
): Promise<Buffer> {
  const bottle = await bottlePng(options);
  const config = { ...DEFAULT_BOTTLE, ...options };
  const backdrop = options.backdropHex ?? '#ffffff';
  const noise = options.noise ?? 0;

  let base = sharp({
    create: {
      width: config.width,
      height: config.height,
      channels: 4,
      background: backdrop,
    },
  }).composite([{ input: bottle, left: 0, top: 0 }]);

  if (noise > 0) {
    // A lifestyle plate's backdrop is not one colour. Grain here stands in for that, so the
    // "is this a plain backdrop" test is exercised on something that is genuinely not.
    const grain = Buffer.alloc(config.width * config.height * 3);
    for (let index = 0; index < grain.length; index += 1) {
      grain[index] = Math.round(128 + ((Math.sin(index * 12.9898) * 43758.5453) % noise));
    }
    base = sharp({
      create: { width: config.width, height: config.height, channels: 4, background: backdrop },
    }).composite([
      {
        input: grain,
        raw: { width: config.width, height: config.height, channels: 3 },
        blend: 'over',
      },
      { input: bottle, left: 0, top: 0 },
    ]);
  }

  // Flattened to three channels, because a supplier's JPEG has no alpha to fall back on.
  return base.removeAlpha().png().toBuffer();
}

/**
 * A cut-out bottle sitting inside a much larger transparent canvas, the way packshots are
 * routinely exported. A 1600x1600 frame holding a 649x1437 bottle is 63% nothing, and that
 * padding is what `trimToSubject` removes before the master is digested.
 */
export async function paddedPackshotPng(
  options: BottleOptions & { canvas?: { width: number; height: number } } = {},
): Promise<Buffer> {
  const bottle = await bottlePng(options);
  const config = { ...DEFAULT_BOTTLE, ...options };
  const canvas = options.canvas ?? { width: config.width * 2, height: config.height * 2 };

  return sharp({
    create: { width: canvas.width, height: canvas.height, channels: 4, background: '#00000000' },
  })
    .composite([
      {
        input: bottle,
        left: Math.round((canvas.width - config.width) / 2),
        top: Math.round((canvas.height - config.height) / 2),
      },
    ])
    .png()
    .toBuffer();
}

/**
 * A bottle standing beside its gift box: two subjects in one packshot, separated by a gap of
 * backdrop. This is the case `subjectProfile` exists to flag — real examples in the catalogue
 * include Talisker 10 and Lark Devil's Storm, and staging one means masking and colour-
 * referencing whichever object the detector happened to land on.
 */
export async function bottleAndBoxPng(options: BottleOptions = {}): Promise<Buffer> {
  const config = { ...DEFAULT_BOTTLE, ...options };
  const bottle = await bottlePng(options);
  const gap = Math.round(config.width * 0.35);
  const boxWidth = Math.round(config.width * 0.8);
  const boxHeight = Math.round(config.height * 0.85);

  const box = await sharp({
    create: { width: boxWidth, height: boxHeight, channels: 4, background: '#1e2a44' },
  })
    .png()
    .toBuffer();

  const width = boxWidth + gap + config.width;
  return sharp({
    create: { width, height: config.height, channels: 4, background: '#00000000' },
  })
    .composite([
      { input: box, left: 0, top: config.height - boxHeight },
      { input: bottle, left: boxWidth + gap, top: 0 },
    ])
    .png()
    .toBuffer();
}
