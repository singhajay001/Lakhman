import type { Permission } from './permissions.js';

/** The six roles of section 20. */
export const ROLE_KEYS = [
  'administrator',
  'campaign_manager',
  'creator',
  'compliance_reviewer',
  'analyst',
  'finance_approver',
] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];

export interface RoleDefinition {
  key: RoleKey;
  name: string;
  description: string;
  permissions: readonly Permission[];
}

export const ROLES: Record<RoleKey, RoleDefinition> = {
  administrator: {
    key: 'administrator',
    name: 'Administrator',
    description:
      'Integrations, security, users, global settings and emergency controls. Deliberately cannot approve a campaign or a budget: an account that can grant itself a role must not also be an approval key.',
    permissions: [
      'products:read',
      'products:sync',
      'research:read',
      'brand:read',
      'brand:edit',
      'brand:publish',
      'campaign:read',
      'media:read',
      'inbox:read',
      'analytics:read',
      'analytics:export',
      'connections:read',
      'connections:manage',
      'providers:manage',
      'users:manage',
      'settings:manage',
      'automation:manage',
      'audit:read',
      'emergency:stop',
    ],
  },
  campaign_manager: {
    key: 'campaign_manager',
    name: 'Campaign Manager',
    description:
      'Owns, approves, schedules and publishes campaigns. Cannot manage credentials or providers.',
    permissions: [
      'products:read',
      'products:sync',
      'research:read',
      'research:approve',
      'brand:read',
      'campaign:read',
      'campaign:create',
      'campaign:edit',
      'campaign:approve',
      'campaign:schedule',
      'campaign:publish',
      'media:read',
      'media:generate',
      'media:approve',
      'inbox:read',
      'inbox:draft',
      'inbox:send',
      'analytics:read',
      'analytics:export',
      'connections:read',
      'audit:read',
      'emergency:stop',
    ],
  },
  creator: {
    key: 'creator',
    name: 'Creator',
    description: 'Research, drafts and media generation. Cannot publish, approve or schedule.',
    permissions: [
      'products:read',
      'research:read',
      'research:create',
      'brand:read',
      'campaign:read',
      'campaign:create',
      'campaign:edit',
      'media:read',
      'media:generate',
      'inbox:read',
      'inbox:draft',
      'analytics:read',
    ],
  },
  compliance_reviewer: {
    key: 'compliance_reviewer',
    name: 'Compliance Reviewer',
    description:
      'Decides facts, brand and alcohol compliance. Cannot manage credentials or publish.',
    permissions: [
      'products:read',
      'research:read',
      'research:approve',
      'brand:read',
      'campaign:read',
      'media:read',
      'compliance:review',
      'inbox:read',
      'analytics:read',
      'audit:read',
      'emergency:stop',
    ],
  },
  analyst: {
    key: 'analyst',
    name: 'Analyst',
    description: 'Read-only analytics and exports.',
    permissions: [
      'products:read',
      'campaign:read',
      'media:read',
      'analytics:read',
      'analytics:export',
      'audit:read',
    ],
  },
  finance_approver: {
    key: 'finance_approver',
    name: 'Finance Approver',
    description:
      'Approves budget commitments above the configured threshold. Cannot create or edit content.',
    permissions: [
      'products:read',
      'campaign:read',
      'analytics:read',
      'budget:approve',
      'audit:read',
    ],
  },
};

export const isRoleKey = (value: string): value is RoleKey =>
  (ROLE_KEYS as readonly string[]).includes(value);
