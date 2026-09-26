import { findPattern, findPhrases } from '../text.js';
import type { Rule } from '../types.js';

export const PROMOTION_RULES: Rule[] = [
  {
    id: 'promotion.offer_terms',
    code: 'ACL-TERMS-1',
    category: 'promotion_terms',
    severity: 'BLOCKING',
    title: 'An offer with no recorded terms',
    standard:
      'A price or saving claim needs the conditions that qualify it. Under Australian Consumer Law an unqualified saving claim is a misleading representation.',
    suggestion:
      'Record the offer terms on the campaign — what the discount applies to, the period, and any exclusions — or remove the saving language.',
    check: (input) => {
      if (input.offerTerms && input.offerTerms.trim().length > 0) return [];
      return [
        ...findPattern(input.fields, /\b(\d{1,2})\s*%\s*off\b/i),
        ...findPattern(
          input.fields,
          /\b(save|saving|discount|was \$|now only|half price|bogo|2 for 1)\b/i,
        ),
        ...findPattern(
          input.fields,
          /\b(free shipping|free delivery|bonus (?:bottle|glass|gift))\b/i,
        ),
      ].map(({ captured: _captured, ...evidence }) => evidence);
    },
  },
  {
    id: 'promotion.competition',
    code: 'ACL-TERMS-2',
    category: 'promotion_terms',
    severity: 'BLOCKING',
    title: 'A competition or giveaway without the approval it requires',
    standard:
      'Competitions and giveaways carry permit, terms and platform-policy obligations, and section 20 requires two approvers for one.',
    suggestion:
      'Request a competition approval. It needs a Campaign Manager and a Compliance Reviewer, and the terms must be recorded on the campaign.',
    check: (input) => {
      if (input.competitionApproved) return [];
      return findPhrases(input.fields, [
        'win',
        'winner',
        'giveaway',
        'give away',
        'competition',
        'enter to win',
        'prize',
        'prizes',
        'sweepstake',
        'raffle',
        'tag a friend to win',
      ]);
    },
  },
  {
    id: 'promotion.age_targeting',
    code: 'PLATFORM-AGE-1',
    category: 'promotion_terms',
    severity: 'BLOCKING',
    title: 'Paid alcohol creative requires recorded age targeting',
    standard:
      'Every platform that permits alcohol advertising in Australia requires the audience to be age-restricted, and an audience configured once can be edited later by anyone with ad-account access.',
    suggestion:
      'Paid creative is not built in this phase. When it is, the preflight check must confirm 18+ targeting on the connected ad account at dispatch, not only at setup.',
    // Only relevant to paid, and paid arrives in Phase 7 — reported as not applicable
    // rather than silently passing.
    applies: (input) => input.paid,
    check: () => [
      {
        field: 'campaign',
        match: '(paid creative is not supported in this phase)',
        index: 0,
        excerpt:
          'Paid workflows, including age-restricted targeting checks and budget dual control, arrive in Phase 7. Nothing paid can be approved yet.',
      },
    ],
  },
];
