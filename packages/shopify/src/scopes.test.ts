import { describe, expect, it } from 'vitest';
import {
  MANDATORY_SCOPES,
  NEVER_REQUESTED,
  OPTIONAL_SCOPES,
  mandatoryScopeList,
  missingMandatoryScopes,
  optionalScopeList,
} from './scopes.js';

describe('scope declarations', () => {
  it('gives every scope a reason and a feature', () => {
    for (const requirement of [...MANDATORY_SCOPES, ...OPTIONAL_SCOPES]) {
      expect(requirement.reason.length, requirement.scope).toBeGreaterThan(30);
      expect(requirement.feature.length, requirement.scope).toBeGreaterThan(3);
    }
  });

  it('never requests a write scope on merchant data', () => {
    const requested = [...mandatoryScopeList(), ...optionalScopeList()];
    for (const scope of requested) {
      expect(
        scope.startsWith('write_') === false ||
          ['write_pixels', 'write_marketing_events', 'write_discounts'].includes(scope),
        `unexpected write scope: ${scope}`,
      ).toBe(true);
    }
    for (const excluded of NEVER_REQUESTED) {
      expect(requested, excluded.scope).not.toContain(excluded.scope);
    }
  });

  it('does not list a scope as both mandatory and optional', () => {
    const overlap = mandatoryScopeList().filter((scope) => optionalScopeList().includes(scope));
    expect(overlap).toEqual([]);
  });

  it('flags the scope that needs Shopify’s own approval', () => {
    const flagged = OPTIONAL_SCOPES.filter((s) => s.needsShopifyApproval).map((s) => s.scope);
    expect(flagged).toEqual(['read_all_orders']);
  });

  it('keeps attribution in the mandatory set, since the MVP requires it', () => {
    expect(mandatoryScopeList()).toEqual(
      expect.arrayContaining(['write_pixels', 'read_customer_events', 'read_orders']),
    );
  });
});

describe('missingMandatoryScopes', () => {
  it('is empty when everything was granted', () => {
    expect(missingMandatoryScopes(mandatoryScopeList())).toEqual([]);
  });

  it('names what Shopify withheld', () => {
    const granted = mandatoryScopeList().filter((scope) => scope !== 'read_orders');
    expect(missingMandatoryScopes(granted)).toEqual(['read_orders']);
  });

  it('ignores extra granted scopes', () => {
    expect(missingMandatoryScopes([...mandatoryScopeList(), 'read_themes'])).toEqual([]);
  });
});
