/**
 * The brand, as render constants.
 *
 * Mirrors the tokens in docs/spirithaus/theme-profile.json rather than restating them by
 * taste. The Brand Kit is the authority at campaign time; these are the render-time defaults,
 * and a composition takes overrides from its props so an asset can name the Brand Kit version
 * it was made under.
 */
export const THEME = {
  ink: '#111110',
  bone: '#f2efe9',
  white: '#ffffff',
  red: '#cf1c29',
  display: 'Archivo',
  mono: 'Space Mono',
  weights: { light: 300, regular: 400, black: 900 },
} as const;

export type Aspect = '9:16' | '1:1' | '16:9' | '4:5';

export const DIMENSIONS: Record<Aspect, { width: number; height: number }> = {
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
  '16:9': { width: 1920, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
};

/**
 * Safe insets per aspect, as fractions. Deliberately the same numbers the geometry engine
 * carries (packages/media-geometry), and like those, unverified.
 */
export const SAFE: Record<Aspect, { top: number; right: number; bottom: number; left: number }> = {
  '9:16': { top: 0.1, right: 0.18, bottom: 0.24, left: 0.06 },
  '1:1': { top: 0.02, right: 0.03, bottom: 0.04, left: 0.03 },
  '16:9': { top: 0.03, right: 0.03, bottom: 0.12, left: 0.03 },
  '4:5': { top: 0.02, right: 0.04, bottom: 0.06, left: 0.04 },
};
