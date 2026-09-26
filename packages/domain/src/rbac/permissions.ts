/**
 * The permission catalogue. Closed by design: a feature that needs a new
 * permission adds it here, which makes the addition reviewable, rather than
 * inventing a string at a call site.
 */
export const PERMISSIONS = [
  'products:read',
  'products:sync',

  'research:read',
  'research:create',
  'research:approve',

  'brand:read',
  'brand:edit',
  'brand:publish',

  'campaign:read',
  'campaign:create',
  'campaign:edit',
  'campaign:approve',
  'campaign:schedule',
  'campaign:publish',

  'media:read',
  'media:generate',
  'media:approve',

  'compliance:review',

  'inbox:read',
  'inbox:draft',
  'inbox:send',

  'analytics:read',
  'analytics:export',

  'connections:read',
  'connections:manage',
  'providers:manage',

  'budget:approve',

  'users:manage',
  'settings:manage',
  'automation:manage',
  'audit:read',
  'emergency:stop',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const isPermission = (value: string): value is Permission =>
  (PERMISSIONS as readonly string[]).includes(value);
