import type { Platform } from '@spirithaus/domain';

/**
 * Where a platform puts its own furniture, and where we put our type.
 *
 * **Unverified**, like every other platform figure in this build: section 4 requires these
 * to be checked against current documentation and this environment cannot reach it. The
 * safe insets in particular are the ones most likely to be wrong, because platforms move
 * their buttons.
 */
export const PLATFORM_PROFILE_VERSION = '2026-09-26.unverified';

export type FormatKey =
  'feed' | 'story' | 'reel' | 'short' | 'standard' | 'pin' | 'thumbnail' | 'square';

/** Fractions of the delivered frame, 0–1. */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TypeSpec {
  /** Where the type block is anchored. */
  anchor: 'bottom-left' | 'bottom-centre' | 'centre';
  /** Lines of type, longest first, as a fraction of frame width. */
  lineWidths: number[];
  /** Line height as a fraction of frame height. */
  lineHeight: number;
  /** Inset from the anchored edges, as fractions. */
  inset: { x: number; y: number };
  /** Dilation applied around the glyph boxes, in em. The storefront tool settled on 0.25. */
  dilateEm: number;
}

/**
 * One surface the master is shown on.
 *
 * The insets belong here rather than on the format, because the same file appears on
 * surfaces with different furniture: a Reel has a right-hand action rail and a caption
 * row, and the grid thumbnail of that same Reel has neither. Hanging one set of insets off
 * the format and applying it to every crop reported a subject near the top of a feed crop
 * as "behind the interface", which is how this shape was found.
 */
export interface DeliveredSurface {
  name: string;
  /** Delivered aspect, width / height. */
  aspect: number;
  /** The platform's own furniture on *this* surface, as fractions of the delivered frame. */
  safe: Insets;
  note?: string;
}

export interface PlatformFormat {
  platform: Platform;
  format: FormatKey;
  label: string;
  /** The master aspect this format is composed at, as width / height. */
  aspect: number;
  render: { w: number; h: number };
  /**
   * Every surface the same master is shown on. A subject must survive all of them, because
   * an asset's verdict is its worst viewport.
   */
  deliveredAspects: DeliveredSurface[];
  type: TypeSpec;
  scrim: { hex: string; opacity: number; coverage: 'type-region' | 'full' };
  verified: false;
  note: string;
}

const INK = '#111110';

/**
 * A bottom-left headline over a scrim: the SPIRITHAUS storefront pattern.
 *
 * The metrics mirror what apps/render actually draws — 5.2% of the frame height per line at a
 * 1.04 line height, anchored at the format's own bottom inset. The first version used smaller
 * numbers and a 7% inset, and the measurement engine consequently thought the type region was
 * half the size it is: a rendered frame put the headline straight across the label while the
 * engine reported a pass.
 *
 * Three lines, not two: headlines wrap, and a model that assumes they do not understates the
 * region every time one does.
 */
const headline = (lines: number[], bottomInset: number, lineHeight = 0.054): TypeSpec => ({
  anchor: 'bottom-left',
  lineWidths: lines,
  lineHeight,
  inset: { x: 0.06, y: bottomInset },
  dilateEm: 0.25,
});

export const PLATFORM_FORMATS: PlatformFormat[] = [
  {
    platform: 'INSTAGRAM',
    format: 'feed',
    label: 'Instagram feed 4:5',
    aspect: 4 / 5,
    render: { w: 1080, h: 1350 },
    deliveredAspects: [
      {
        name: 'feed 4:5',
        aspect: 4 / 5,
        safe: { top: 0.02, right: 0.04, bottom: 0.06, left: 0.04 },
        note: 'Handle above, caption below; little overlays the image itself.',
      },
      {
        // The profile grid and most previews crop the same master to a square, and put
        // nothing over it.
        name: 'grid 1:1',
        aspect: 1,
        safe: { top: 0, right: 0, bottom: 0, left: 0 },
        note: 'No furniture; the crop is the whole constraint.',
      },
    ],
    type: headline([0.72, 0.5, 0.5], 0.06),
    scrim: { hex: INK, opacity: 0.58, coverage: 'type-region' },
    verified: false,
    note: 'Feed crops to 4:5; the grid and many surfaces crop the same file to 1:1.',
  },
  {
    platform: 'INSTAGRAM',
    format: 'story',
    label: 'Instagram Story 9:16',
    aspect: 9 / 16,
    render: { w: 1080, h: 1920 },
    deliveredAspects: [
      {
        name: 'story 9:16',
        aspect: 9 / 16,
        // Stories put the profile row at the top and the reply field at the bottom.
        safe: { top: 0.14, right: 0.06, bottom: 0.2, left: 0.06 },
      },
    ],
    type: headline([0.76, 0.54, 0.54], 0.2),
    scrim: { hex: INK, opacity: 0.58, coverage: 'type-region' },
    verified: false,
    note: 'Sticker and reply furniture take roughly the top 14% and bottom 20%.',
  },
  {
    platform: 'INSTAGRAM',
    format: 'reel',
    label: 'Instagram Reel 9:16',
    aspect: 9 / 16,
    render: { w: 1080, h: 1920 },
    deliveredAspects: [
      {
        name: 'reel 9:16',
        aspect: 9 / 16,
        safe: { top: 0.1, right: 0.18, bottom: 0.24, left: 0.06 },
        note: 'Action rail on the right, caption and audio row along the bottom.',
      },
      {
        // A Reel also appears in the feed cropped to 4:5, with feed furniture, not the
        // player's.
        name: 'feed crop 4:5',
        aspect: 4 / 5,
        safe: { top: 0.02, right: 0.04, bottom: 0.06, left: 0.04 },
      },
      { name: 'grid 1:1', aspect: 1, safe: { top: 0, right: 0, bottom: 0, left: 0 } },
    ],
    type: headline([0.62, 0.44, 0.44], 0.24),
    scrim: { hex: INK, opacity: 0.58, coverage: 'type-region' },
    verified: false,
    note: 'The right rail carries the action buttons; the caption and audio row take the bottom.',
  },
  {
    platform: 'TIKTOK',
    format: 'reel',
    label: 'TikTok 9:16',
    aspect: 9 / 16,
    render: { w: 1080, h: 1920 },
    deliveredAspects: [
      {
        name: 'feed 9:16',
        aspect: 9 / 16,
        // TikTok's furniture is the heaviest of the six.
        safe: { top: 0.1, right: 0.2, bottom: 0.26, left: 0.05 },
      },
    ],
    type: headline([0.6, 0.42, 0.42], 0.26),
    scrim: { hex: INK, opacity: 0.66, coverage: 'type-region' },
    verified: false,
    note: 'Caption, handle, music row and the right-hand action rail all overlay the frame.',
  },
  {
    platform: 'YOUTUBE',
    format: 'short',
    label: 'YouTube Short 9:16',
    aspect: 9 / 16,
    render: { w: 1080, h: 1920 },
    deliveredAspects: [
      {
        name: 'short 9:16',
        aspect: 9 / 16,
        safe: { top: 0.08, right: 0.16, bottom: 0.22, left: 0.05 },
      },
    ],
    type: headline([0.62, 0.44, 0.44], 0.22),
    scrim: { hex: INK, opacity: 0.58, coverage: 'type-region' },
    verified: false,
    note: 'Title, channel row and action rail overlay the frame.',
  },
  {
    platform: 'YOUTUBE',
    format: 'standard',
    label: 'YouTube standard 16:9',
    aspect: 16 / 9,
    render: { w: 1920, h: 1080 },
    deliveredAspects: [
      {
        name: 'player 16:9',
        aspect: 16 / 9,
        // The progress bar and controls take the bottom band on hover.
        safe: { top: 0.03, right: 0.03, bottom: 0.12, left: 0.03 },
      },
      {
        // The same frame as a thumbnail: same aspect, and the duration chip sits
        // bottom-right.
        name: 'thumbnail 16:9',
        aspect: 16 / 9,
        safe: { top: 0, right: 0.02, bottom: 0.08, left: 0 },
      },
    ],
    type: headline([0.5, 0.34, 0.34], 0.12, 0.075),
    scrim: { hex: INK, opacity: 0.58, coverage: 'type-region' },
    verified: false,
    note: 'The progress bar and controls take the bottom band on hover.',
  },
  {
    platform: 'FACEBOOK',
    format: 'square',
    label: 'Facebook 1:1',
    aspect: 1,
    render: { w: 1080, h: 1080 },
    deliveredAspects: [
      { name: 'feed 1:1', aspect: 1, safe: { top: 0.02, right: 0.03, bottom: 0.04, left: 0.03 } },
      {
        name: 'right column 16:9',
        aspect: 16 / 9,
        safe: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    ],
    type: headline([0.66, 0.46, 0.46], 0.04, 0.07),
    scrim: { hex: INK, opacity: 0.58, coverage: 'type-region' },
    verified: false,
    note: 'The same file is re-cropped to 16:9 in some placements.',
  },
  {
    platform: 'X',
    format: 'feed',
    label: 'X 16:9',
    aspect: 16 / 9,
    render: { w: 1600, h: 900 },
    deliveredAspects: [
      {
        name: 'timeline 16:9',
        aspect: 16 / 9,
        safe: { top: 0.02, right: 0.03, bottom: 0.04, left: 0.03 },
      },
      {
        // The timeline preview crops tall images; a 16:9 master survives, a square does not.
        name: 'preview 2:1',
        aspect: 2,
        safe: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    ],
    type: headline([0.55, 0.38, 0.38], 0.04, 0.085),
    scrim: { hex: INK, opacity: 0.58, coverage: 'type-region' },
    verified: false,
    note: 'Timeline previews crop; the full image is only seen when opened.',
  },
  {
    platform: 'PINTEREST',
    format: 'pin',
    label: 'Pinterest Pin 2:3',
    aspect: 2 / 3,
    render: { w: 1000, h: 1500 },
    deliveredAspects: [
      {
        name: 'pin 2:3',
        aspect: 2 / 3,
        safe: { top: 0.03, right: 0.05, bottom: 0.08, left: 0.05 },
      },
      {
        // Pins are shown in a masonry grid that crops taller pins.
        name: 'grid crop 1:1.4',
        aspect: 1 / 1.4,
        safe: { top: 0, right: 0, bottom: 0.06, left: 0 },
      },
    ],
    type: headline([0.74, 0.52, 0.52], 0.08),
    scrim: { hex: INK, opacity: 0.58, coverage: 'type-region' },
    verified: false,
    note: 'Keyword-led title reads over the lower band.',
  },
];

export function formatFor(platform: Platform, format: FormatKey): PlatformFormat {
  const found = PLATFORM_FORMATS.find(
    (entry) => entry.platform === platform && entry.format === format,
  );
  if (!found) throw new Error(`no platform profile for ${platform}/${format}`);
  return found;
}

export const formatsFor = (platform: Platform): PlatformFormat[] =>
  PLATFORM_FORMATS.filter((entry) => entry.platform === platform);
