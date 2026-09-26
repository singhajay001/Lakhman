/**
 * Cost estimation (sections 37 and 5 of docs/social-studio/05-providers.md).
 *
 * There are no prices in this file. A rate card is configured per provider by an
 * administrator, with the date and source it was read from. An unconfigured rate
 * card produces `unknown`, and `unknown` refuses any operation that has a ceiling
 * rather than silently costing nothing.
 */

export type MeteredUnit =
  | 'input_tokens'
  | 'output_tokens'
  | 'images'
  | 'megapixels'
  | 'steps'
  | 'characters'
  | 'video_seconds'
  | 'render_seconds'
  | 'requests'
  | 'gb_months';

export type Usage = Partial<Record<MeteredUnit, number>>;

export interface RateCard {
  currency: 'AUD';
  /** Price per single unit, per metered unit. */
  rates: Partial<Record<MeteredUnit, number>>;
  /** When the rates were read, and from where. Both required — an undated rate card is a guess. */
  readAt: string;
  sourceUrl: string;
}

export type CostEstimate =
  | {
      known: true;
      currency: 'AUD';
      amount: number;
      breakdown: Partial<Record<MeteredUnit, number>>;
    }
  | { known: false; reason: 'no_rate_card' | 'unpriced_unit'; missing?: MeteredUnit[] };

export function estimate(usage: Usage, rateCard: RateCard | null | undefined): CostEstimate {
  if (!rateCard) return { known: false, reason: 'no_rate_card' };

  const breakdown: Partial<Record<MeteredUnit, number>> = {};
  const missing: MeteredUnit[] = [];
  let amount = 0;

  for (const [unit, quantity] of Object.entries(usage) as [MeteredUnit, number | undefined][]) {
    if (quantity === undefined || quantity === 0) continue;
    const rate = rateCard.rates[unit];
    if (rate === undefined) {
      missing.push(unit);
      continue;
    }
    const line = rate * quantity;
    breakdown[unit] = line;
    amount += line;
  }

  // A partially priced estimate is worse than none: it looks like a number.
  if (missing.length > 0) return { known: false, reason: 'unpriced_unit', missing };

  return { known: true, currency: 'AUD', amount: round4(amount), breakdown };
}

export interface Budget {
  /** Hard ceiling. Exceeding it refuses the operation. */
  ceilingAud: number;
  /** Soft threshold. Exceeding it warns and records. */
  warnAud?: number;
}

export type BudgetVerdict =
  | { allowed: true; warn: boolean }
  | { allowed: false; reason: 'over_ceiling' | 'cost_unknown'; ceilingAud?: number };

/**
 * An unknown cost against a configured ceiling is refused, not waved through.
 * Section 37 requires an estimate before expensive media work; a provider whose
 * rate card nobody filled in cannot be exempt from it.
 */
export function checkBudget(
  est: CostEstimate,
  spentAud: number,
  budget: Budget | null | undefined,
): BudgetVerdict {
  if (!budget) return { allowed: true, warn: false };
  if (!est.known) return { allowed: false, reason: 'cost_unknown', ceilingAud: budget.ceilingAud };

  const projected = round4(spentAud + est.amount);
  if (projected > budget.ceilingAud) {
    return { allowed: false, reason: 'over_ceiling', ceilingAud: budget.ceilingAud };
  }
  return { allowed: true, warn: budget.warnAud !== undefined && projected > budget.warnAud };
}

function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}
