import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { THEME, type Aspect } from '../theme';

export interface AnimatedTypeProps {
  kicker?: string;
  headline: string;
  /** Words wrapped in asterisks render at the display face's black weight. */
  aspect: Aspect;
  /** Frame the type starts arriving. */
  startAt?: number;
}

/**
 * How tall the headline block is, as a fraction of the frame.
 *
 * Exported because anything else laid out near the bottom has to know — the caption track
 * was positioned by eye and rendered straight through the headline, which no test caught and
 * one look at a frame did.
 */
export function headlineBlockFraction(
  headline: string,
  aspect: Aspect,
  hasKicker: boolean,
): number {
  const lines = headline.split('\n').length;
  const headlineSize = aspect === '16:9' ? 0.072 : 0.052;
  const kickerSize = hasKicker ? 0.016 + headlineSize * 0.28 : 0;
  return lines * headlineSize * 1.04 + (lines - 1) * headlineSize * 0.28 + kickerSize;
}

/**
 * The headline, laid out at the brand's own metrics and anchored to the bottom left, which is
 * where the storefront puts it. Emphasis is marked in the copy with asterisks rather than by a
 * second field, so a caption stays one editable string.
 */
export const AnimatedType: React.FC<AnimatedTypeProps> = ({
  kicker,
  headline,
  aspect,
  startAt = 6,
}) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();

  const lines = headline.split('\n');
  const headlineSize = Math.round(height * (aspect === '16:9' ? 0.072 : 0.052));
  const kickerSize = Math.round(height * 0.016);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: Math.round(headlineSize * 0.28),
      }}
    >
      {kicker ? (
        <div
          style={{
            fontFamily: THEME.mono,
            fontSize: kickerSize,
            letterSpacing: kickerSize * 0.14,
            textTransform: 'uppercase',
            color: THEME.bone,
            opacity: reveal(frame, startAt),
          }}
        >
          {kicker}
        </div>
      ) : null}

      {lines.map((line, index) => (
        <div
          key={`${line}-${index}`}
          style={{
            fontFamily: THEME.display,
            fontWeight: THEME.weights.light,
            fontSize: headlineSize,
            lineHeight: 1.04,
            color: THEME.bone,
            opacity: reveal(frame, startAt + index * 4),
            transform: `translateY(${interpolate(
              frame,
              [startAt + index * 4, startAt + index * 4 + 12],
              [headlineSize * 0.18, 0],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
            )}px)`,
          }}
        >
          {emphasise(line)}
        </div>
      ))}
    </div>
  );
};

const reveal = (frame: number, at: number): number =>
  interpolate(frame, [at, at + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

/** `*word*` renders at the black weight, matching the storefront's emphasis spans. */
function emphasise(line: string): React.ReactNode[] {
  return line
    .split(/(\*[^*]+\*)/g)
    .filter(Boolean)
    .map((part, index) =>
      part.startsWith('*') && part.endsWith('*') ? (
        <span key={index} style={{ fontWeight: THEME.weights.black }}>
          {part.slice(1, -1)}
        </span>
      ) : (
        <span key={index}>{part}</span>
      ),
    );
}
