import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { THEME, type Aspect } from '../theme';

/** Word-level alignment, as a VoiceProvider returns it. */
export interface AlignedWord {
  word: string;
  startMs: number;
  endMs: number;
}

export interface CaptionTrackProps {
  words: AlignedWord[];
  aspect: Aspect;
  /** Words shown at once. Kinetic captions read best in short groups. */
  groupSize?: number;
}

/**
 * Kinetic captions driven by the voice track's own word timings.
 *
 * Driven by alignment rather than by an even split of the duration, because an even split
 * drifts audibly within a sentence — which is the reason the VoiceProvider contract asks for
 * word-level alignment in the first place, and why a provider that cannot supply it is a
 * different capability rather than a cheaper one.
 *
 * Accessibility, not decoration: section 13 counts captions as part of the asset.
 */
export const CaptionTrack: React.FC<CaptionTrackProps> = ({ words, aspect, groupSize = 4 }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const nowMs = (frame / fps) * 1000;

  const groups: AlignedWord[][] = [];
  for (let index = 0; index < words.length; index += groupSize) {
    groups.push(words.slice(index, index + groupSize));
  }

  const active = groups.find((group) => {
    const first = group[0];
    const last = group[group.length - 1];
    return first && last && nowMs >= first.startMs && nowMs <= last.endMs;
  });

  // Reserves its own height whether or not a group is active, so the block above it does not
  // jump between frames.
  const size = Math.round(height * (aspect === '16:9' ? 0.042 : 0.03));
  if (!active) return <div style={{ height: size * 1.4 }} />;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: size * 0.35,
        fontFamily: THEME.display,
        fontWeight: THEME.weights.regular,
        fontSize: size,
      }}
    >
      {active.map((word, index) => {
        const spoken = nowMs >= word.startMs;
        return (
          <span
            key={`${word.word}-${index}`}
            style={{
              color: spoken ? THEME.bone : 'rgba(242,239,233,0.45)',
              // The word being spoken carries the accent, one word at a time.
              borderBottom:
                spoken && nowMs <= word.endMs
                  ? `${Math.max(2, size * 0.06)}px solid ${THEME.red}`
                  : 'none',
            }}
          >
            {word.word}
          </span>
        );
      })}
    </div>
  );
};

/**
 * A fallback alignment for when no voice track exists: an even split, explicitly marked as
 * estimated so nothing downstream mistakes it for measured timing.
 */
export function estimateAlignment(text: string, durationMs: number): AlignedWord[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const per = durationMs / words.length;
  return words.map((word, index) => ({
    word,
    startMs: Math.round(index * per),
    endMs: Math.round((index + 1) * per),
  }));
}
