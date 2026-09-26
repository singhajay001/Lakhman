import React from 'react';
import { Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

/**
 * The protected product layer (section 15).
 *
 * The approved image, moved by deterministic transforms and nothing else. There is no frame in
 * which a model could have redrawn it, because no model is in this path — the movement is
 * arithmetic on position and scale, applied to pixels that were verified before they got here.
 *
 * That is the whole reason video is composed this way rather than generated.
 */
export interface ProductLayerProps {
  /** A verified, composited still. Never a prompt. */
  src: string;
  /** Normalised centre of the product in the frame. */
  centre?: { x: number; y: number };
  /** Scale at the first frame and at the last, interpolated linearly. */
  scaleFrom?: number;
  scaleTo?: number;
  /** Parallax drift in fractions of the frame, over the whole composition. */
  driftX?: number;
  driftY?: number;
}

export const ProductLayer: React.FC<ProductLayerProps> = ({
  src,
  centre = { x: 0.5, y: 0.42 },
  scaleFrom = 1,
  scaleTo = 1.06,
  driftX = 0,
  driftY = -0.015,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const progress = durationInFrames <= 1 ? 0 : frame / (durationInFrames - 1);

  const scale = interpolate(progress, [0, 1], [scaleFrom, scaleTo]);
  const x = (centre.x + driftX * progress) * width;
  const y = (centre.y + driftY * progress) * height;

  return (
    <Img
      src={src}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width,
        height,
        objectFit: 'cover',
        transformOrigin: `${x}px ${y}px`,
        transform: `scale(${scale})`,
      }}
    />
  );
};
