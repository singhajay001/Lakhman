import { findPhrases } from '../text.js';
import type { Rule } from '../types.js';

/**
 * Rules aimed at the ABAC Responsible Alcohol Marketing Code.
 *
 * The standard is described in each rule rather than cited by clause number: a wrong
 * clause reference is worse than none, because it looks authoritative. A Compliance
 * Reviewer reads the standard text and decides.
 *
 * Word lists are deliberately visible and editable. A hidden heuristic that blocks a
 * campaign is not something a reviewer can argue with.
 */
export const ABAC_RULES: Rule[] = [
  {
    id: 'abac.minors.appeal',
    code: 'ABAC-MINORS-1',
    category: 'minors',
    severity: 'BLOCKING',
    title: 'Content with strong or evident appeal to minors',
    standard:
      'Alcohol marketing must not have strong or evident appeal to minors, which includes child-oriented characters, themes, animation styles and confectionery references.',
    suggestion:
      'Remove the child-oriented reference. If the product genuinely tastes of something confectionery-like, describe the flavour in adult terms — "orange peel and burnt sugar" rather than "like a lolly".',
    check: (input) =>
      findPhrases(input.fields, [
        'cartoon',
        'animated character',
        'superhero',
        'unicorn',
        'candy',
        'lolly',
        'lollies',
        'bubblegum',
        'gummy',
        'sherbet',
        'fairy floss',
        'toy',
        'mascot',
        'playground',
        'kids',
        'children',
        'schoolyard',
        'nursery',
      ]),
  },
  {
    id: 'abac.minors.under25',
    code: 'ABAC-MINORS-2',
    category: 'minors',
    severity: 'BLOCKING',
    title: 'People who may not clearly appear to be 25 or older',
    standard:
      'Adults shown in alcohol marketing should clearly appear to be at least 25. Copy that describes young people signals imagery that will not meet that standard.',
    suggestion:
      'Describe adults in a way that reads unambiguously over 25, and check the imagery brief. The SPIRITHAUS prompt pack already requires hands that read 35 or older and no faces.',
    check: (input) =>
      findPhrases(input.fields, [
        'teen',
        'teenager',
        'teenagers',
        'schoolie',
        'schoolies',
        'school leaver',
        'uni student',
        'university student',
        'college student',
        'freshers',
        'eighteenth',
        '18th birthday',
        'young adults',
        'youngsters',
        'barely legal',
      ]),
  },
  {
    id: 'abac.consumption.excessive',
    code: 'ABAC-CONSUME-1',
    category: 'consumption',
    severity: 'BLOCKING',
    title: 'Excessive or rapid consumption',
    standard:
      'Alcohol marketing must not encourage excessive or rapid consumption, or present volume as the point of the occasion.',
    suggestion:
      'Move the emphasis from how much to what it is. A tasting note, a serve, or a pairing carries the same enthusiasm without implying volume.',
    check: (input) =>
      findPhrases(input.fields, [
        'skull it',
        'skulling',
        'chug',
        'chugging',
        'shots all round',
        'round of shots',
        'bottomless',
        'all you can drink',
        'unlimited drinks',
        'drink up',
        'keep them coming',
        'sink a few',
        'smash a few',
        'get on it',
        'pre-drinks',
        'pregame',
        'big night',
        'session',
        'sessionable',
        'one more won',
        'binge',
      ]),
  },
  {
    id: 'abac.consumption.intoxication',
    code: 'ABAC-CONSUME-2',
    category: 'consumption',
    severity: 'BLOCKING',
    title: 'Intoxication presented positively or humorously',
    standard:
      'Alcohol marketing must not depict or refer approvingly to intoxication, or treat its aftermath as a joke.',
    suggestion:
      'Remove the reference. There is no framing of intoxication that this standard permits.',
    check: (input) =>
      findPhrases(input.fields, [
        'drunk',
        'drunken',
        'hammered',
        'wasted',
        'plastered',
        'smashed',
        'tipsy',
        'buzzed',
        'merry',
        'three sheets',
        'blind drunk',
        'blotto',
        'write-off',
        'hair of the dog',
      ]),
  },
  {
    id: 'abac.consumption.hangover',
    code: 'ABAC-CONSUME-3',
    category: 'consumption',
    severity: 'ADVISORY',
    title: 'Hangover reference',
    standard:
      'A hangover reference implies the consumption that produced it, and reads as treating excess lightly.',
    suggestion:
      'Usually best removed. A reviewer may keep it where the context is clearly cautionary.',
    check: (input) => findPhrases(input.fields, ['hangover', 'hungover', 'morning after']),
  },
  {
    id: 'abac.safety.driving',
    code: 'ABAC-SAFETY-1',
    category: 'safety',
    severity: 'BLOCKING',
    title: 'Alcohol associated with driving or operating machinery',
    standard:
      'Alcohol marketing must not associate consumption with driving, boating, swimming or any activity requiring care or skill.',
    suggestion:
      'Remove the association entirely. A distillery visit can be described without the journey to it, and "designated driver" is the only driving phrase this check permits.',
    check: (input) =>
      findPhrases(
        input.fields,
        [
          'drive',
          'driving',
          'driver',
          'behind the wheel',
          'road trip',
          'roadie',
          'one for the road',
          'boating',
          'jet ski',
          'swimming',
          'surf',
        ],
        // Responsible messaging must not trip a safety rule.
        { exclude: ['designated driver', 'designated drivers', 'skip the drive'] },
      ),
  },
  {
    id: 'abac.health.claims',
    code: 'ABAC-HEALTH-1',
    category: 'health',
    severity: 'BLOCKING',
    title: 'Health, therapeutic or nutritional claim',
    standard:
      'Alcohol must not be presented as healthy, therapeutic, nutritious or beneficial to wellbeing, and must not carry a claim that it treats or prevents anything.',
    suggestion:
      'Replace the health framing with a product characteristic and a purchase reason — what it tastes like, how it is made, what to serve it with.',
    check: (input) =>
      findPhrases(input.fields, [
        'healthy',
        'health benefits',
        'good for you',
        'guilt free',
        'guilt-free',
        'detox',
        'cleanse',
        'antioxidant',
        'antioxidants',
        'immune',
        'immunity',
        'heart healthy',
        'lowers cholesterol',
        'medicinal',
        'medicine',
        'cure',
        'cures',
        'remedy',
        'wellness',
        'nutritious',
        'superfood',
        'probiotic',
        'vitamin',
        'skinny',
        'diet',
        'fat burning',
      ]),
  },
  {
    id: 'abac.health.therapeutic',
    code: 'ABAC-HEALTH-2',
    category: 'health',
    severity: 'BLOCKING',
    title: 'Alcohol offered as relief from a mental or emotional state',
    standard:
      'Alcohol marketing must not suggest that consumption relieves stress, anxiety, sadness or boredom, or that it is a way to cope.',
    suggestion:
      'Anchor the moment in the drink rather than in the feeling it is supposed to fix: the serve, the company, the food.',
    check: (input) =>
      findPhrases(input.fields, [
        'relieve stress',
        'stress relief',
        'de-stress',
        'destress',
        'calm your nerves',
        'take the edge off',
        'anxiety',
        'cheer you up',
        'drown your sorrows',
        'forget your troubles',
        'escape reality',
        'you deserve it after',
        'earned this',
        'need a drink',
        'needed this',
      ]),
  },
  {
    id: 'abac.social.success',
    code: 'ABAC-SOCIAL-1',
    category: 'social_success',
    severity: 'BLOCKING',
    title: 'Alcohol linked to social, sexual or personal success',
    standard:
      'Alcohol marketing must not suggest that consumption contributes to social acceptance, popularity, confidence, sexual success or personal achievement.',
    suggestion:
      'Let the product be the reason to buy. Remove the implied outcome about the drinker rather than softening it.',
    check: (input) =>
      findPhrases(input.fields, [
        'confidence',
        'confident',
        'liquid courage',
        'dutch courage',
        'make friends',
        'be popular',
        'life of the party',
        'impress your',
        'impress them',
        'irresistible',
        'get lucky',
        'sexier',
        'seductive',
        'pulls a crowd',
        'everyone will want',
        'be the hero',
        'win them over',
      ]),
  },
  {
    id: 'abac.social.performance',
    code: 'ABAC-SOCIAL-2',
    category: 'social_success',
    severity: 'BLOCKING',
    title: 'Alcohol linked to performance or capability',
    standard:
      'Alcohol marketing must not suggest that consumption improves energy, stamina, focus or any physical or mental performance.',
    suggestion:
      'Remove the performance claim; it cannot be substantiated and the standard prohibits it.',
    check: (input) =>
      findPhrases(input.fields, [
        'energy boost',
        'boosts energy',
        'stamina',
        'sharpens focus',
        'perform better',
        'pick-me-up',
        'pick me up',
        'keeps you going',
        'fuel for',
        'power through',
      ]),
  },
  {
    id: 'abac.service.irresponsible',
    code: 'ABAC-SERVICE-1',
    category: 'responsible_service',
    severity: 'BLOCKING',
    title: 'Irresponsible service or supply',
    standard:
      'Marketing must not promote service practices that encourage excessive supply, and an online retailer must not imply supply without limit.',
    suggestion:
      'Describe the offer in units and price. Remove any suggestion that supply is unlimited or unmonitored.',
    check: (input) =>
      findPhrases(input.fields, [
        'free pour',
        'unlimited',
        'no limits',
        'as much as you like',
        'keep drinking',
        'never runs out',
        'endless',
        'no questions asked',
      ]),
  },
  {
    id: 'abac.service.responsible_line',
    code: 'ABAC-SERVICE-2',
    category: 'responsible_service',
    severity: 'ADVISORY',
    title: 'No responsible-consumption wording',
    standard:
      'Responsible-consumption wording is expected on promotional alcohol marketing, and is required by several platforms for paid placements.',
    suggestion:
      'Add the responsible-consumption line from the Brand Kit. It must be confirmed by an administrator before it can be used; until then this cannot pass.',
    // Paid creative raises this to blocking; the engine applies that escalation.
    check: (input) => {
      const line = input.brand.responsibleConsumptionLine?.trim();
      if (!line) {
        return [
          {
            field: 'brandKit',
            match: '(no confirmed responsible-consumption line)',
            index: 0,
            excerpt:
              'The Brand Kit has no confirmed responsible-consumption line, so no campaign can carry one.',
          },
        ];
      }
      const present = input.fields.some((field) =>
        field.value.toLowerCase().includes(line.toLowerCase()),
      );
      return present
        ? []
        : [
            {
              field: 'primaryCopy',
              match: '(responsible-consumption line absent)',
              index: 0,
              excerpt: `Expected the Brand Kit line: "${line}"`,
            },
          ];
    },
  },
];
