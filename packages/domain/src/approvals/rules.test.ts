import { describe, expect, it } from 'vitest';
import { KEY_REQUIREMENTS, canHoldKey, requiredKeysFor } from './rules.js';
import { ROLE_KEYS, ROLES } from '../rbac/roles.js';

describe('the key requirements', () => {
  it('never lets an administrator be an approval key', () => {
    for (const [kind, requirement] of Object.entries(KEY_REQUIREMENTS)) {
      expect(requirement.first, kind).not.toContain('administrator');
      expect(requirement.second, kind).not.toContain('administrator');
    }
  });

  it('only names roles that exist, and that hold the permission the key implies', () => {
    for (const [kind, requirement] of Object.entries(KEY_REQUIREMENTS)) {
      for (const role of [...requirement.first, ...requirement.second]) {
        expect(ROLE_KEYS, `${kind}: ${role}`).toContain(role);
      }
    }
    expect(ROLES.campaign_manager.permissions).toContain('campaign:approve');
    expect(ROLES.finance_approver.permissions).toContain('budget:approve');
    expect(ROLES.compliance_reviewer.permissions).toContain('compliance:review');
  });

  it('gives every requirement a reason', () => {
    for (const requirement of Object.values(KEY_REQUIREMENTS)) {
      expect(requirement.why.length).toBeGreaterThan(25);
    }
  });
});

describe('requiredKeysFor', () => {
  it('needs one key for ordinary organic publication', () => {
    const outcome = requiredKeysFor({ kind: 'ORGANIC_PUBLICATION' });
    expect(outcome.ok && outcome.keys).toBe(1);
  });

  it('needs two when the content is high risk', () => {
    const outcome = requiredKeysFor({ kind: 'ORGANIC_PUBLICATION', isHighRisk: true });
    expect(outcome.ok && outcome.keys).toBe(2);
    expect(outcome.ok && outcome.requirement.second).toContain('compliance_reviewer');
  });

  it('needs two when a compliance exception is being accepted', () => {
    const outcome = requiredKeysFor({ kind: 'ORGANIC_PUBLICATION', hasComplianceException: true });
    expect(outcome.ok && outcome.keys).toBe(2);
  });

  it('needs two for a competition', () => {
    expect(
      requiredKeysFor({ kind: 'COMPETITION' }).ok && requiredKeysFor({ kind: 'COMPETITION' }),
    ).toMatchObject({
      keys: 2,
    });
  });

  it('refuses a paid approval when no threshold is configured', () => {
    // Proceeding would mean choosing a threshold on the business's behalf.
    const outcome = requiredKeysFor({ kind: 'PAID_BUDGET', budgetAud: 500 });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toContain('threshold');
  });

  it('needs one key for paid below the threshold and two at or above it', () => {
    const below = requiredKeysFor({
      kind: 'PAID_BUDGET',
      budgetAud: 499,
      dualControlThresholdAud: 500,
    });
    const at = requiredKeysFor({
      kind: 'PAID_BUDGET',
      budgetAud: 500,
      dualControlThresholdAud: 500,
    });
    const above = requiredKeysFor({
      kind: 'PAID_BUDGET',
      budgetAud: 5000,
      dualControlThresholdAud: 500,
    });
    expect(below.ok && below.keys).toBe(1);
    expect(at.ok && at.keys).toBe(2);
    expect(above.ok && above.keys).toBe(2);
  });

  it('refuses a paid approval with no budget, or a zero one', () => {
    expect(requiredKeysFor({ kind: 'PAID_BUDGET', dualControlThresholdAud: 500 }).ok).toBe(false);
    expect(
      requiredKeysFor({ kind: 'PAID_BUDGET', budgetAud: 0, dualControlThresholdAud: 500 }).ok,
    ).toBe(false);
  });

  it('is not influenced by what the requester asked for', () => {
    // The requirement is computed from the action. There is no input that lowers it.
    const outcome = requiredKeysFor({
      kind: 'COMPETITION',
      // @ts-expect-error — deliberately passing a field the type does not have
      requiredKeys: 1,
    });
    expect(outcome.ok && outcome.keys).toBe(2);
  });
});

describe('canHoldKey', () => {
  const requirement = KEY_REQUIREMENTS.PAID_BUDGET;

  it('lets a Campaign Manager hold key 1', () => {
    expect(
      canHoldKey({
        requirement,
        keyIndex: 1,
        roles: ['campaign_manager'],
        userId: 'u1',
        alreadySignedBy: [],
      }),
    ).toEqual({ eligible: true, role: 'campaign_manager' });
  });

  it('lets a Finance Approver hold key 2', () => {
    expect(
      canHoldKey({
        requirement,
        keyIndex: 2,
        roles: ['finance_approver'],
        userId: 'u2',
        alreadySignedBy: ['u1'],
      }).eligible,
    ).toBe(true);
  });

  it('refuses the same person signing twice, however many roles they hold', () => {
    const outcome = canHoldKey({
      requirement,
      keyIndex: 2,
      roles: ['campaign_manager', 'finance_approver'],
      userId: 'u1',
      alreadySignedBy: ['u1'],
    });
    expect(outcome.eligible).toBe(false);
    if (outcome.eligible) return;
    expect(outcome.reason).toContain('two distinct people');
  });

  it('refuses a role that is not permitted for that key', () => {
    const outcome = canHoldKey({
      requirement,
      keyIndex: 2,
      roles: ['creator'],
      userId: 'u3',
      alreadySignedBy: ['u1'],
    });
    expect(outcome.eligible).toBe(false);
    if (outcome.eligible) return;
    expect(outcome.reason).toContain('finance_approver');
  });

  it('refuses a second key on a single-key approval', () => {
    const outcome = canHoldKey({
      requirement: KEY_REQUIREMENTS.ORGANIC_PUBLICATION,
      keyIndex: 2,
      roles: ['campaign_manager'],
      userId: 'u2',
      alreadySignedBy: ['u1'],
    });
    expect(outcome.eligible).toBe(false);
    if (outcome.eligible) return;
    expect(outcome.reason).toContain('no key 2');
  });

  it('refuses an administrator, even holding every other role', () => {
    const outcome = canHoldKey({
      requirement,
      keyIndex: 1,
      roles: ['administrator'],
      userId: 'admin',
      alreadySignedBy: [],
    });
    expect(outcome.eligible).toBe(false);
  });
});
