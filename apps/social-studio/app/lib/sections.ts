import type { Permission } from '@spirithaus/domain';

/**
 * Section 8's navigation, as data. Every section declares the permission that opens
 * it and the phase that builds it, so a screen that is not built yet says which
 * phase it belongs to instead of pretending to be empty.
 */
export interface Section {
  path: string;
  label: string;
  permission: Permission;
  phase: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  /** What the section will do. Shown on the placeholder, so the empty state is informative. */
  summary: string;
}

export const SECTIONS: readonly Section[] = [
  {
    path: '/app',
    label: 'Dashboard',
    permission: 'campaign:read',
    phase: 1,
    summary: 'Install state, sync health, provider status and what needs a human.',
  },
  {
    path: '/app/products',
    label: 'Products',
    permission: 'products:read',
    phase: 1,
    summary:
      'The synchronised catalogue, with the promotability check that runs before any campaign.',
  },
  {
    path: '/app/research',
    label: 'Research Library',
    permission: 'research:read',
    phase: 2,
    summary:
      'Sourced product facts with publisher, retrieval time and confidence, awaiting approval.',
  },
  {
    path: '/app/intelligence',
    label: 'Intelligence Hub',
    permission: 'campaign:read',
    phase: 6,
    summary: 'Observations from permitted public sources, each with its freshness and sample size.',
  },
  {
    path: '/app/trends',
    label: 'Trend Opportunities',
    permission: 'campaign:read',
    phase: 6,
    summary: 'Transparent trend signals — velocity, recency, source quality — and original angles.',
  },
  {
    path: '/app/competitors',
    label: 'Competitor Watch',
    permission: 'campaign:read',
    phase: 6,
    summary: 'Permitted public competitor activity, observed facts separated from interpretation.',
  },
  {
    path: '/app/campaigns',
    label: 'Campaigns',
    permission: 'campaign:read',
    phase: 2,
    summary: 'Every campaign, its state, its approvals and its commercial result.',
  },
  {
    path: '/app/create',
    label: 'Create',
    permission: 'campaign:create',
    phase: 2,
    summary: 'Build a campaign from a product, collection, theme, segment or brief.',
  },
  {
    path: '/app/media',
    label: 'Media Studio',
    permission: 'media:read',
    phase: 3,
    summary:
      'Protected product assets, generated environments, and per-platform safe-zone measurement.',
  },
  {
    path: '/app/calendar',
    label: 'Content Calendar',
    permission: 'campaign:read',
    phase: 4,
    summary: 'Calendar and list views across the twelve publication states.',
  },
  {
    path: '/app/approvals',
    label: 'Approvals',
    permission: 'campaign:read',
    phase: 2,
    summary: 'What is waiting on a human, what it is hashed against, and who may sign it.',
  },
  {
    path: '/app/queue',
    label: 'Publish Queue',
    permission: 'campaign:read',
    phase: 4,
    summary: 'One job per destination, with partial success and retry of failed destinations only.',
  },
  {
    path: '/app/inbox',
    label: 'Community Inbox',
    permission: 'inbox:read',
    phase: 7,
    summary:
      'Comments, mentions and messages, classified, with drafted replies that need approval.',
  },
  {
    path: '/app/segments',
    label: 'Audience Segments',
    permission: 'analytics:read',
    phase: 5,
    summary: 'Shopify segments used in aggregate, with the definition version each campaign used.',
  },
  {
    path: '/app/forecasting',
    label: 'Forecasting',
    permission: 'analytics:read',
    phase: 6,
    summary: 'Ranges with confidence and sample size. Never a guaranteed number.',
  },
  {
    path: '/app/experiments',
    label: 'Experiment Centre',
    permission: 'analytics:read',
    phase: 6,
    summary:
      'A/B tests with a stated hypothesis, guardrails and a stopping rule the AI cannot override.',
  },
  {
    path: '/app/analytics',
    label: 'Analytics',
    permission: 'analytics:read',
    phase: 5,
    summary: 'Contribution margin first, and unattributed reported as its own row.',
  },
  {
    path: '/app/brand-kit',
    label: 'Brand Kit',
    permission: 'brand:read',
    phase: 2,
    summary: 'The authoritative brand record, versioned, seeded from the live theme profile.',
  },
  {
    path: '/app/connections',
    label: 'Social Connections',
    permission: 'connections:read',
    phase: 4,
    summary: 'Accounts, scopes, token health, and what each platform will and will not permit.',
  },
  {
    path: '/app/automation',
    label: 'Automation Centre',
    permission: 'automation:manage',
    phase: 6,
    summary: 'What runs unattended — and the approval gates it may not cross.',
  },
  {
    path: '/app/governance',
    label: 'AI Governance',
    permission: 'providers:manage',
    phase: 1,
    summary: 'Model and prompt registries, provider permissions, usage and emergency disable.',
  },
  {
    path: '/app/settings',
    label: 'Settings',
    permission: 'settings:manage',
    phase: 1,
    summary: 'Scopes granted, providers, budgets, timezone and business details.',
  },
  {
    path: '/app/audit',
    label: 'Audit Log',
    permission: 'audit:read',
    phase: 1,
    summary: 'Append-only history of every state change, approval and automated action.',
  },
];

export const sectionByPath = (path: string): Section | undefined =>
  SECTIONS.find((section) => section.path === path);
