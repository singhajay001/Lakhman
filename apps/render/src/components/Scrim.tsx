import React from 'react';
import { AbsoluteFill } from 'remotion';
import { THEME } from '../theme';

/**
 * The veil under the type.
 *
 * Uniform over the type region and feathered in above it — not a bottom-to-top gradient. A
 * gradient sinks the region's own floor faster than it dims a highlight sitting higher in it,
 * so the spread survives and the frame scores *worse*. That was measured on the storefront
 * harness, and the finding carries here unchanged.
 */
export interface ScrimProps {
  /** Fraction of the frame height the type region occupies, from the bottom. */
  coverage: number;
  opacity: number;
  /** Feather height above the region, as a fraction of the frame. */
  feather?: number;
}

export const Scrim: React.FC<ScrimProps> = ({ coverage, opacity, feather = 0.08 }) => (
  <AbsoluteFill>
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: `${coverage * 100}%`,
        backgroundColor: THEME.ink,
        opacity,
      }}
    />
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: `${coverage * 100}%`,
        height: `${feather * 100}%`,
        background: `linear-gradient(to top, ${THEME.ink}, rgba(17,17,16,0))`,
        opacity,
      }}
    />
  </AbsoluteFill>
);
