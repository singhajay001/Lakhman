import React from 'react';
import { AbsoluteFill } from 'remotion';
import { AnimatedType, headlineBlockFraction } from '../components/AnimatedType';
import { BottomStack } from '../components/BottomStack';
import { CaptionTrack, estimateAlignment } from '../components/CaptionTrack';
import { ProductLayer } from '../components/ProductLayer';
import { ResponsibilityEndFrame } from '../components/ResponsibilityEndFrame';
import { Scrim } from '../components/Scrim';
import { ensureFonts } from '../fonts';
import { SAFE, THEME } from '../theme';
import type { SpiritHausProps } from './props';

/**
 * The house template: one bottle, one light, the headline along the bottom.
 *
 * The product moves by a slow push and a small upward drift. Nothing else about it changes, and
 * nothing is generated at render time.
 */
export const ProductHero: React.FC<SpiritHausProps> = (props) => {
  ensureFonts();
  const words = props.alignment ?? estimateAlignment(props.voiceover ?? '', 6000);

  return (
    <AbsoluteFill style={{ backgroundColor: THEME.ink }}>
      {props.productSrc ? (
        <ProductLayer src={props.productSrc} scaleFrom={1} scaleTo={1.06} />
      ) : null}
      <Scrim
        // Covers the headline and the caption band above it, not just the headline.
        coverage={
          props.scrim?.coverage ??
          Math.min(
            0.66,
            SAFE[props.aspect].bottom +
              headlineBlockFraction(props.headline, props.aspect, Boolean(props.kicker)) +
              0.14,
          )
        }
        opacity={props.scrim?.opacity ?? 0.58}
      />
      <BottomStack aspect={props.aspect}>
        <CaptionTrack words={words} aspect={props.aspect} />
        <AnimatedType kicker={props.kicker} headline={props.headline} aspect={props.aspect} />
      </BottomStack>
      <ResponsibilityEndFrame line={props.responsibleLine} licence={props.licence} />
    </AbsoluteFill>
  );
};
