import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { AnimatedType } from '../components/AnimatedType';
import { ProductLayer } from '../components/ProductLayer';
import { ResponsibilityEndFrame } from '../components/ResponsibilityEndFrame';
import { Scrim } from '../components/Scrim';
import { ensureFonts } from '../fonts';
import { SAFE, THEME } from '../theme';
import type { SpiritHausProps } from './props';

export interface WeekendOfferProps extends SpiritHausProps {
  /** The offer, as a short line. */
  offer: string;
  /** The terms. Required: an unqualified saving claim is blocked before it reaches a render. */
  terms: string;
}

/**
 * An offer card.
 *
 * The terms are a required prop rather than an optional one, because the compliance engine
 * blocks a saving claim with no recorded terms — so a render that could omit them would be a
 * way around a rule that holds everywhere else.
 */
export const WeekendOffer: React.FC<WeekendOfferProps> = (props) => {
  ensureFonts();
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const safe = SAFE[props.aspect];
  const chip = interpolate(frame, [10, 24], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: THEME.ink }}>
      {props.productSrc ? (
        <ProductLayer src={props.productSrc} scaleFrom={1.04} scaleTo={1} />
      ) : null}
      <Scrim coverage={props.scrim?.coverage ?? 0.48} opacity={props.scrim?.opacity ?? 0.62} />

      <div
        style={{
          position: 'absolute',
          left: safe.left * width,
          top: safe.top * height,
          backgroundColor: THEME.red,
          color: THEME.bone,
          fontFamily: THEME.mono,
          fontSize: Math.round(height * 0.018),
          letterSpacing: height * 0.002,
          padding: `${height * 0.012}px ${height * 0.018}px`,
          opacity: chip,
          transform: `translateY(${(1 - chip) * height * 0.02}px)`,
        }}
      >
        {props.offer.toUpperCase()}
      </div>

      <AnimatedType kicker={props.kicker} headline={props.headline} aspect={props.aspect} />

      <div
        style={{
          position: 'absolute',
          left: safe.left * width,
          right: safe.right * width,
          bottom: safe.bottom * height * 0.35,
          fontFamily: THEME.mono,
          fontSize: Math.round(height * 0.011),
          lineHeight: 1.4,
          color: THEME.bone,
          opacity: 0.72,
        }}
      >
        {props.terms}
      </div>

      <ResponsibilityEndFrame line={props.responsibleLine} licence={props.licence} />
    </AbsoluteFill>
  );
};
