import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { CaptionTrack, estimateAlignment } from '../components/CaptionTrack';
import { BottomStack } from '../components/BottomStack';
import { ProductLayer } from '../components/ProductLayer';
import { ResponsibilityEndFrame } from '../components/ResponsibilityEndFrame';
import { Scrim } from '../components/Scrim';
import { ensureFonts } from '../fonts';
import { THEME } from '../theme';
import type { SpiritHausProps } from './props';

export interface CocktailRecipeProps extends SpiritHausProps {
  drinkName: string;
  /** Measures, in order. Shown one at a time, on the beat. */
  steps: string[];
}

/**
 * A serve, built one measure at a time.
 *
 * Steps appear on a fixed cadence rather than on audio beats: a beat detector would make the
 * render non-deterministic, and section 16 asks for deterministic composition.
 */
export const CocktailRecipe: React.FC<CocktailRecipeProps> = (props) => {
  ensureFonts();
  const frame = useCurrentFrame();
  const { width, height, durationInFrames, fps } = useVideoConfig();
  const words =
    props.alignment ?? estimateAlignment(props.voiceover ?? '', (durationInFrames / fps) * 1000);

  const perStep = Math.max(
    1,
    Math.floor((durationInFrames - fps) / Math.max(1, props.steps.length)),
  );

  return (
    <AbsoluteFill style={{ backgroundColor: THEME.ink }}>
      {props.productSrc ? (
        <ProductLayer src={props.productSrc} scaleFrom={1} scaleTo={1.08} driftY={-0.02} />
      ) : null}
      <Scrim coverage={props.scrim?.coverage ?? 0.5} opacity={props.scrim?.opacity ?? 0.6} />

      <BottomStack aspect={props.aspect} gap={0.012}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: height * 0.014 }}>
          <div
            style={{
              fontFamily: THEME.display,
              fontWeight: THEME.weights.black,
              fontSize: Math.round(height * 0.042),
              color: THEME.bone,
            }}
          >
            {props.drinkName}
          </div>
          {props.steps.map((step, index) => {
            const at = index * perStep;
            const opacity = interpolate(frame, [at, at + 8], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            return (
              <div
                key={`${step}-${index}`}
                style={{
                  fontFamily: THEME.mono,
                  fontSize: Math.round(height * 0.016),
                  color: THEME.bone,
                  opacity,
                  transform: `translateX(${(1 - opacity) * width * 0.02}px)`,
                }}
              >
                {step}
              </div>
            );
          })}
        </div>
        <CaptionTrack words={words} aspect={props.aspect} />
      </BottomStack>

      <ResponsibilityEndFrame line={props.responsibleLine} licence={props.licence} />
    </AbsoluteFill>
  );
};
