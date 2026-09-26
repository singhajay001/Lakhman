import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { THEME } from '../theme';

export interface ResponsibilityEndFrameProps {
  /** The confirmed Brand Kit line. Null means none is confirmed, and none is invented here. */
  line: string | null;
  licence?: string | null;
  /** Frames from the end that the card occupies. */
  frames?: number;
}

/**
 * The closing card.
 *
 * If the Brand Kit has no confirmed responsible-consumption line, this renders the wordmark and
 * nothing else. It does not fall back to "drink responsibly" — that phrase is on the Brand Kit's
 * prohibited list, because it is the one every regulator has seen used as a fig leaf, and a
 * render inventing it would put words on an asset that nobody approved.
 */
export const ResponsibilityEndFrame: React.FC<ResponsibilityEndFrameProps> = ({
  line,
  licence,
  frames = 45,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, height } = useVideoConfig();
  const start = durationInFrames - frames;
  if (frame < start) return null;

  const opacity = interpolate(frame, [start, start + 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: THEME.ink,
        opacity,
        alignItems: 'center',
        justifyContent: 'center',
        gap: height * 0.02,
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          fontFamily: THEME.display,
          fontWeight: THEME.weights.black,
          fontSize: Math.round(height * 0.05),
          letterSpacing: height * 0.004,
          color: THEME.bone,
        }}
      >
        SPIRITHAUS
      </div>
      {line ? (
        <div
          style={{
            fontFamily: THEME.mono,
            fontSize: Math.round(height * 0.016),
            color: THEME.bone,
            opacity: 0.85,
          }}
        >
          {line}
        </div>
      ) : null}
      {licence ? (
        <div
          style={{
            fontFamily: THEME.mono,
            fontSize: Math.round(height * 0.012),
            color: THEME.bone,
            opacity: 0.6,
          }}
        >
          {licence}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
