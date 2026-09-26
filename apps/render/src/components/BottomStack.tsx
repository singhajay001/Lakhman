import React from 'react';
import { SAFE, type Aspect } from '../theme';

/**
 * Everything anchored to the bottom of the frame, in one column.
 *
 * The first version positioned the caption track by predicting the headline's height. The
 * prediction was wrong the moment a headline wrapped — which it did on the first real render,
 * putting the captions through the kicker. Predicting a layout is a bug waiting for a longer
 * word; stacking it is not.
 */
export const BottomStack: React.FC<{
  aspect: Aspect;
  gap?: number;
  children: React.ReactNode;
}> = ({ aspect, gap = 0.03, children }) => {
  const safe = SAFE[aspect];
  return (
    <div
      style={{
        position: 'absolute',
        left: `${safe.left * 100}%`,
        right: `${safe.right * 100}%`,
        bottom: `${safe.bottom * 100}%`,
        display: 'flex',
        flexDirection: 'column',
        gap: `${gap * 100}%`,
      }}
    >
      {children}
    </div>
  );
};
