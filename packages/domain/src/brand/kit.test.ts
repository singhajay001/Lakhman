import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { brandKitReadiness, buildBrandKit, type ThemeProfileShape } from './kit.js';

// The real generated profile, read from the repository. If the theme changes shape, this
// test fails rather than the Brand Kit silently seeding from a guess.
const profile = JSON.parse(
  readFileSync(new URL('../../../../docs/spirithaus/theme-profile.json', import.meta.url), 'utf8'),
) as ThemeProfileShape;

describe('seeding from the live theme profile', () => {
  it('reads the profile this repository actually holds', () => {
    expect(profile.tokens.ink).toBe('#111110');
    expect(profile.tokens.red).toBe('#cf1c29');
    expect(profile.tokens.fontDisplay).toBe('Archivo');
    expect(profile.tokens.fontMono).toBe('Space Mono');
  });

  it('carries the theme colours into the kit with a stated use', () => {
    const kit = buildBrandKit({ themeProfile: profile });
    const red = kit.content.colours.find((colour) => colour.name === 'red');
    expect(red?.hex).toBe('#cf1c29');
    expect(red?.use).toContain('calls to action');
    expect(kit.content.colours.map((c) => c.hex)).toEqual(
      expect.arrayContaining(['#111110', '#f2efe9', '#ffffff', '#cf1c29']),
    );
  });

  it('carries the two licensed faces and their weights', () => {
    const kit = buildBrandKit({ themeProfile: profile });
    const display = kit.content.typography.find((face) => face.role === 'display');
    expect(display?.family).toBe('Archivo');
    expect(display?.weights).toContain(300);
    expect(display?.weights).toContain(900);
  });

  it('records where it was derived from, so a stale kit is visible', () => {
    const kit = buildBrandKit({ themeProfile: profile });
    expect(kit.content.derivedFrom.themeProfile).toBe('docs/spirithaus/theme-profile.json');
    expect(kit.content.derivedFrom.shop).toBe('spirithaus.com.au');
    expect(kit.content.derivedFrom.themeUpdatedAt).toBeTruthy();
  });
});

describe('what it refuses to invent', () => {
  it('leaves the responsible-consumption line unset, as a placeholder', () => {
    const kit = buildBrandKit({ themeProfile: profile });
    expect(kit.content.responsibleConsumptionLine).toBeNull();
    expect(kit.placeholders).toContain('responsibleConsumptionLine');
  });

  it('prohibits "drink responsibly" — the phrase used as a fig leaf', () => {
    expect(buildBrandKit({ themeProfile: profile }).content.prohibitedPhrases).toContain(
      'drink responsibly',
    );
  });

  it('leaves the licence number and premises as placeholders unless supplied', () => {
    const kit = buildBrandKit({ themeProfile: profile });
    expect(kit.content.business.licenceNumber).toBeNull();
    expect(kit.placeholders).toEqual(
      expect.arrayContaining(['business.licenceNumber', 'business.licensedPremises']),
    );
  });

  it('accepts a licence number that was read off something authoritative', () => {
    const kit = buildBrandKit({ themeProfile: profile, licenceNumber: 'LIQP700301260' });
    expect(kit.content.business.licenceNumber).toBe('LIQP700301260');
    expect(kit.placeholders).not.toContain('business.licenceNumber');
  });

  it('records no approved brand variation by default', () => {
    // Section 2: no variation unless an administrator records one.
    expect(buildBrandKit({ themeProfile: profile }).content.approvedBrandVariations).toEqual([]);
  });

  it('leaves social handles unset, because no account exists yet', () => {
    const kit = buildBrandKit({ themeProfile: profile });
    expect(Object.values(kit.content.socialHandles).every((handle) => handle === null)).toBe(true);
    expect(kit.placeholders).toContain('socialHandles');
  });
});

describe('readiness', () => {
  it('is unusable while the responsible line is unconfirmed', () => {
    const kit = buildBrandKit({ themeProfile: profile });
    const readiness = brandKitReadiness(kit.placeholders);
    expect(readiness.usable).toBe(false);
    expect(readiness.blocking).toContain('responsibleConsumptionLine');
  });

  it('does not block on a detail a draft can live without', () => {
    expect(brandKitReadiness(['business.deliveryAreas', 'socialHandles']).usable).toBe(true);
  });

  it('is usable once the blocking placeholders are confirmed', () => {
    expect(brandKitReadiness([]).usable).toBe(true);
  });
});

describe('product presentation rules', () => {
  it('carries the scenes-only rule the prompt pack already reached', () => {
    const rules = buildBrandKit({ themeProfile: profile }).content.productPresentationRules.join(
      ' ',
    );
    expect(rules).toContain('photographed, never generated');
    expect(rules).toContain('Scenes only');
    expect(rules).toContain('35 or older');
  });
});
