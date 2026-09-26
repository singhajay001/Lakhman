import { describe, expect, it } from 'vitest';
import { checkBudget, estimate, type RateCard } from './cost-meter.js';

const card: RateCard = {
  currency: 'AUD',
  rates: { input_tokens: 0.000005, output_tokens: 0.000025, images: 0.05 },
  readAt: '2026-09-26',
  sourceUrl: 'https://example.invalid/pricing',
};

describe('estimate', () => {
  it('prices a usage against the configured rate card', () => {
    const result = estimate({ input_tokens: 1000, output_tokens: 500 }, card);
    expect(result.known).toBe(true);
    if (!result.known) return;
    expect(result.amount).toBeCloseTo(0.0175, 6);
    expect(result.breakdown.input_tokens).toBeCloseTo(0.005, 6);
  });

  it('is unknown without a rate card, rather than free', () => {
    const result = estimate({ images: 4 }, null);
    expect(result).toEqual({ known: false, reason: 'no_rate_card' });
  });

  it('is unknown when any unit is unpriced — a partial estimate looks like a number', () => {
    const result = estimate({ images: 1, video_seconds: 30 }, card);
    expect(result.known).toBe(false);
    if (result.known) return;
    expect(result.reason).toBe('unpriced_unit');
    expect(result.missing).toEqual(['video_seconds']);
  });

  it('ignores zero and absent quantities', () => {
    const result = estimate({ input_tokens: 0, images: 2 }, card);
    if (!result.known) throw new Error('expected known');
    expect(result.amount).toBeCloseTo(0.1, 6);
    expect(result.breakdown.input_tokens).toBeUndefined();
  });
});

describe('checkBudget', () => {
  it('allows without a budget', () => {
    expect(checkBudget(estimate({ images: 1 }, card), 0, null)).toEqual({
      allowed: true,
      warn: false,
    });
  });

  it('refuses over the ceiling', () => {
    const verdict = checkBudget(estimate({ images: 10 }, card), 0, { ceilingAud: 0.4 });
    expect(verdict).toEqual({ allowed: false, reason: 'over_ceiling', ceilingAud: 0.4 });
  });

  it('counts what has already been spent', () => {
    const est = estimate({ images: 1 }, card);
    expect(checkBudget(est, 0.9, { ceilingAud: 1 }).allowed).toBe(true);
    expect(checkBudget(est, 0.96, { ceilingAud: 1 }).allowed).toBe(false);
  });

  it('warns at the soft threshold without refusing', () => {
    const verdict = checkBudget(estimate({ images: 1 }, card), 0.5, {
      ceilingAud: 1,
      warnAud: 0.5,
    });
    expect(verdict).toEqual({ allowed: true, warn: true });
  });

  it('refuses an unknown cost against a ceiling rather than waving it through', () => {
    // A provider whose rate card nobody filled in is not exempt from section 37.
    const verdict = checkBudget(estimate({ images: 1 }, null), 0, { ceilingAud: 100 });
    expect(verdict).toEqual({ allowed: false, reason: 'cost_unknown', ceilingAud: 100 });
  });
});
