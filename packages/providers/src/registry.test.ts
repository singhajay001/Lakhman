import { describe, expect, it } from 'vitest';
import {
  DEFERRED_CONTRACTS,
  publishingAdapter,
  readSelections,
  resolveAdapter,
  SELECTION_ENV_VAR,
  SOCIAL_PLATFORMS,
} from './registry.js';
import { PROVIDER_CONTRACTS } from './contracts/common.js';
import { MockSocialPublishingProvider, UnconfiguredProvider } from './adapters/mock/index.js';

describe('the contract list', () => {
  it('covers the sixteen contracts of section 6', () => {
    expect(PROVIDER_CONTRACTS).toHaveLength(16);
  });

  it('gives every contract a selection variable', () => {
    for (const contract of PROVIDER_CONTRACTS) {
      expect(SELECTION_ENV_VAR[contract], contract).toMatch(/^PROVIDER_[A-Z_]+$/);
    }
  });

  it('uses a distinct variable per contract', () => {
    const vars = Object.values(SELECTION_ENV_VAR);
    expect(new Set(vars).size).toBe(vars.length);
  });
});

describe('readSelections', () => {
  it('defaults every contract to mock', () => {
    const selections = readSelections({});
    expect(selections).toHaveLength(16);
    expect(selections.every((s) => s.adapterId === 'mock')).toBe(true);
    expect(selections.every((s) => s.configured === false)).toBe(true);
  });

  it('marks a named adapter as configured', () => {
    const selections = readSelections({ PROVIDER_TEXT: 'anthropic' });
    const text = selections.find((s) => s.contract === 'TextGenerationProvider');
    expect(text?.adapterId).toBe('anthropic');
    expect(text?.configured).toBe(true);
  });

  it('treats an explicit mock as not configured, and blank as absent', () => {
    const selections = readSelections({ PROVIDER_TEXT: 'mock', PROVIDER_VOICE: '  ' });
    expect(selections.find((s) => s.contract === 'TextGenerationProvider')?.configured).toBe(false);
    expect(selections.find((s) => s.contract === 'VoiceProvider')?.adapterId).toBe('mock');
  });
});

describe('resolveAdapter', () => {
  it('never returns undefined — every contract resolves to something explainable', () => {
    for (const contract of PROVIDER_CONTRACTS) {
      const adapter = resolveAdapter(contract, 'mock');
      expect(adapter, contract).toBeDefined();
      expect(adapter.contract).toBe(contract);
    }
  });

  it('reports a deferred contract as unavailable with a reason', async () => {
    for (const contract of Object.keys(DEFERRED_CONTRACTS) as (keyof typeof DEFERRED_CONTRACTS)[]) {
      const adapter = resolveAdapter(contract, 'mock');
      expect(adapter, contract).toBeInstanceOf(UnconfiguredProvider);
      const capabilities = await adapter.capabilities();
      expect(capabilities[0]?.available, contract).toBe(false);
      expect(capabilities[0]?.reason?.length ?? 0).toBeGreaterThan(20);
    }
  });

  it('refuses a named adapter it does not implement, rather than falling back to a mock', async () => {
    const adapter = resolveAdapter('TextGenerationProvider', 'anthropic');
    expect(adapter).toBeInstanceOf(UnconfiguredProvider);
    const health = await adapter.health();
    expect(health.healthy).toBe(false);
    expect(adapter.validateConfig().valid).toBe(false);
  });

  it('marks every mock capability unverified', async () => {
    for (const contract of PROVIDER_CONTRACTS) {
      for (const capability of await resolveAdapter(contract, 'mock').capabilities()) {
        expect(capability.verified, `${contract}:${capability.id}`).toBe(false);
      }
    }
  });
});

describe('the mock publisher', () => {
  it('covers the six platforms of section 1', () => {
    expect([...SOCIAL_PLATFORMS].sort()).toEqual(
      ['facebook', 'instagram', 'pinterest', 'tiktok', 'x', 'youtube'].sort(),
    );
  });

  it('never claims a publication succeeded', async () => {
    for (const platform of SOCIAL_PLATFORMS) {
      const adapter = publishingAdapter(platform, 'mock');
      expect(adapter).toBeInstanceOf(MockSocialPublishingProvider);
      const result = await (adapter as MockSocialPublishingProvider).publish({
        platform,
        accountId: 'acct',
        idempotencyKey: 'key-1',
        body: 'copy',
        mediaUrls: [],
      });
      expect(result.ok, platform).toBe(true);
      if (!result.ok) continue;
      // Section 21: never simulate publication success.
      expect(result.value.value.published, platform).toBe(false);
      expect(result.value.value.state, platform).toBe('not_published');
      expect(result.value.value.externalId, platform).toBeUndefined();
      expect(result.value.value.publicUrl, platform).toBeUndefined();
      expect(result.value.mock, platform).toBe(true);
    }
  });

  it('keeps reporting not published when polled', async () => {
    const adapter = publishingAdapter('tiktok', 'mock') as MockSocialPublishingProvider;
    const result = await adapter.pollStatus('mock-job-1');
    if (!result.ok) throw new Error('expected ok');
    expect(result.value.value.published).toBe(false);
    expect(result.value.value.state).toBe('not_published');
  });

  it('refuses when a live adapter is named but absent', async () => {
    const adapter = publishingAdapter('instagram', 'meta');
    expect(adapter).toBeInstanceOf(UnconfiguredProvider);
    expect((await adapter.capabilities())[0]?.available).toBe(false);
  });
});
