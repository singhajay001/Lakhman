import { describe, expect, it } from 'vitest';
import { can, canAll, permissionsFor, requirePermission, type Principal } from './authorize.js';
import { ROLES, ROLE_KEYS } from './roles.js';
import { isPermission } from './permissions.js';
import { DomainError } from '../errors.js';

const principal = (...roles: Principal['roles']): Principal => ({
  userId: 'u1',
  shopId: 's1',
  roles,
});

describe('role definitions', () => {
  it('references only permissions in the catalogue', () => {
    for (const key of ROLE_KEYS) {
      for (const permission of ROLES[key].permissions) {
        expect(isPermission(permission), `${key} grants unknown ${permission}`).toBe(true);
      }
    }
  });

  it('gives every role at least one permission', () => {
    for (const key of ROLE_KEYS) expect(ROLES[key].permissions.length).toBeGreaterThan(0);
  });
});

describe('the separations section 20 requires', () => {
  it('lets a Creator draft but never publish, approve or schedule', () => {
    const creator = principal('creator');
    expect(can(creator, 'campaign:create')).toBe(true);
    expect(can(creator, 'media:generate')).toBe(true);
    expect(can(creator, 'campaign:publish')).toBe(false);
    expect(can(creator, 'campaign:approve')).toBe(false);
    expect(can(creator, 'campaign:schedule')).toBe(false);
  });

  it('keeps credentials away from a Campaign Manager and a Compliance Reviewer', () => {
    for (const role of ['campaign_manager', 'compliance_reviewer'] as const) {
      expect(can(principal(role), 'connections:manage')).toBe(false);
      expect(can(principal(role), 'providers:manage')).toBe(false);
    }
  });

  it('keeps an Analyst read-only', () => {
    const analyst = principal('analyst');
    expect(can(analyst, 'analytics:export')).toBe(true);
    for (const write of [
      'campaign:create',
      'campaign:edit',
      'campaign:publish',
      'media:generate',
      'brand:edit',
      'users:manage',
    ] as const) {
      expect(can(analyst, write), `analyst should not hold ${write}`).toBe(false);
    }
  });

  it('keeps a Finance Approver out of content', () => {
    const finance = principal('finance_approver');
    expect(can(finance, 'budget:approve')).toBe(true);
    expect(can(finance, 'campaign:create')).toBe(false);
    expect(can(finance, 'campaign:edit')).toBe(false);
  });

  it('does not let an Administrator be an approval key', () => {
    // An account that can grant itself a role must not also be able to approve.
    // docs/social-studio/08-approvals.md.
    const admin = principal('administrator');
    expect(can(admin, 'users:manage')).toBe(true);
    expect(can(admin, 'campaign:approve')).toBe(false);
    expect(can(admin, 'budget:approve')).toBe(false);
    expect(can(admin, 'campaign:publish')).toBe(false);
  });

  it('only gives compliance review to the Compliance Reviewer', () => {
    const holders = ROLE_KEYS.filter((key) =>
      (ROLES[key].permissions as readonly string[]).includes('compliance:review'),
    );
    expect(holders).toEqual(['compliance_reviewer']);
  });

  it('only gives budget approval to the Finance Approver', () => {
    const holders = ROLE_KEYS.filter((key) =>
      (ROLES[key].permissions as readonly string[]).includes('budget:approve'),
    );
    expect(holders).toEqual(['finance_approver']);
  });
});

describe('combining roles', () => {
  it('unions permissions', () => {
    const both = principal('creator', 'campaign_manager');
    expect(can(both, 'campaign:create')).toBe(true);
    expect(can(both, 'campaign:publish')).toBe(true);
  });

  it('ignores an unknown role rather than throwing', () => {
    const bogus = { userId: 'u', shopId: 's', roles: ['not_a_role'] } as unknown as Principal;
    expect(permissionsFor(bogus.roles).size).toBe(0);
    expect(can(bogus, 'products:read')).toBe(false);
  });

  it('canAll requires every permission', () => {
    const creator = principal('creator');
    expect(canAll(creator, ['campaign:create', 'media:generate'])).toBe(true);
    expect(canAll(creator, ['campaign:create', 'campaign:publish'])).toBe(false);
  });
});

describe('requirePermission', () => {
  it('names the permission it refused', () => {
    try {
      requirePermission(principal('analyst'), 'campaign:publish');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      const domainError = error as DomainError;
      expect(domainError.code).toBe('forbidden');
      expect(domainError.message).toContain('campaign:publish');
      expect(domainError.details.roles).toEqual(['analyst']);
    }
  });

  it('is silent when permitted', () => {
    expect(() =>
      requirePermission(principal('campaign_manager'), 'campaign:publish'),
    ).not.toThrow();
  });
});
