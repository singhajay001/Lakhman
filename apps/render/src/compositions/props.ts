import type { AlignedWord } from '../components/CaptionTrack';
import type { Aspect } from '../theme';

/**
 * What every composition takes.
 *
 * The product is a URL to a **verified composited still** — never a prompt, never a generation
 * request. By the time a render starts, the four protection checks have already run over that
 * file and a human has approved it; this layer only moves it.
 */
export interface SpiritHausProps {
  aspect: Aspect;
  /** Verified composited still. */
  productSrc: string;
  kicker?: string;
  headline: string;
  /** Voice-over text, for the caption track when no alignment is supplied. */
  voiceover?: string;
  /** Word-level alignment from the voice provider. Preferred over an estimate. */
  alignment?: AlignedWord[];
  /** The confirmed Brand Kit line, or null when none is confirmed. */
  responsibleLine: string | null;
  licence?: string | null;
  /** Recorded on the asset so it can name what it was made under. */
  brandKitVersionId?: string | null;
  scrim?: { coverage: number; opacity: number };
  /**
   * Remotion's `Composition` types props as a record, so the interface carries an index
   * signature. Props still arrive typed inside each composition; this only satisfies the
   * registration boundary, and is the documented shape when not using a zod schema.
   */
  [key: string]: unknown;
}

export const DEFAULT_PROPS: SpiritHausProps = {
  aspect: '9:16',
  productSrc: '',
  kicker: 'NEW IN',
  headline: 'Applewood Gin,\nfrom the *Adelaide Hills*',
  voiceover: 'Applewood Gin, distilled in the Adelaide Hills with native botanicals.',
  responsibleLine: null,
  licence: null,
  scrim: { coverage: 0.42, opacity: 0.58 },
};
