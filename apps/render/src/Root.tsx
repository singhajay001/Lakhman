import React from 'react';
import { Composition } from 'remotion';
import { CocktailRecipe } from './compositions/CocktailRecipe';
import { ProductHero } from './compositions/ProductHero';
import { WeekendOffer } from './compositions/WeekendOffer';
import { DEFAULT_PROPS } from './compositions/props';
import { DIMENSIONS, type Aspect } from './theme';

/**
 * Every template is registered once per aspect, so a composition id names both the template and
 * the shape: `ProductHero-9x16`. The publish queue asks for an id, and there is no runtime
 * resizing that could put type outside a safe zone the geometry engine measured.
 */
const ASPECTS: Aspect[] = ['9:16', '1:1', '16:9'];
const idFor = (template: string, aspect: Aspect): string =>
  `${template}-${aspect.replace(':', 'x')}`;

export const RemotionRoot: React.FC = () => (
  <>
    {ASPECTS.map((aspect) => (
      <Composition
        key={idFor('ProductHero', aspect)}
        id={idFor('ProductHero', aspect)}
        component={ProductHero}
        durationInFrames={210}
        fps={30}
        width={DIMENSIONS[aspect].width}
        height={DIMENSIONS[aspect].height}
        defaultProps={{ ...DEFAULT_PROPS, aspect }}
      />
    ))}

    {ASPECTS.map((aspect) => (
      <Composition
        key={idFor('WeekendOffer', aspect)}
        id={idFor('WeekendOffer', aspect)}
        component={WeekendOffer}
        durationInFrames={180}
        fps={30}
        width={DIMENSIONS[aspect].width}
        height={DIMENSIONS[aspect].height}
        defaultProps={{
          ...DEFAULT_PROPS,
          aspect,
          offer: '15% off Australian gin',
          terms: '15% off Australian gin, 1–7 October 2026. Excludes gift sets. While stocks last.',
        }}
      />
    ))}

    {ASPECTS.map((aspect) => (
      <Composition
        key={idFor('CocktailRecipe', aspect)}
        id={idFor('CocktailRecipe', aspect)}
        component={CocktailRecipe}
        durationInFrames={240}
        fps={30}
        width={DIMENSIONS[aspect].width}
        height={DIMENSIONS[aspect].height}
        defaultProps={{
          ...DEFAULT_PROPS,
          aspect,
          drinkName: 'Gin and tonic, properly',
          steps: [
            '60 ml Applewood Gin',
            '120 ml Indian tonic',
            'One large cube',
            'Grapefruit peel',
          ],
        }}
      />
    ))}
  </>
);
