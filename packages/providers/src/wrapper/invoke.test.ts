import { describe, expect, it, vi } from 'vitest';
import { err, ok } from '@spirithaus/domain';
import { classifyHttpStatus, invokeProvider, type UsageRecordDraft } from './invoke.js';
import { providerError, type ProviderResult } from '../contracts/common.js';

const options = (over: Partial<Parameters<typeof invokeProvider>[0]> = {}) => ({
  contract: 'TextGenerationProvider',
  adapterId: 'test',
  operation: 'generate',
  timeoutMs: 50,
  maxAttempts: 3,
  baseDelayMs: 1,
  sleep: async () => {},
  ...over,
});

const success = (): ProviderResult<string> =>
  ok({ value: 'x', usage: { requests: 1 }, mock: false });

describe('invokeProvider', () => {
  it('returns a success without retrying', async () => {
    const call = vi.fn(async () => success());
    const result = await invokeProvider(options(), call);
    expect(result.ok).toBe(true);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('retries a retryable failure up to maxAttempts', async () => {
    const call = vi.fn(async () => err(providerError('transient', 'boom')));
    const result = await invokeProvider(options(), call);
    expect(result.ok).toBe(false);
    expect(call).toHaveBeenCalledTimes(3);
  });

  it('does not retry a non-retryable failure', async () => {
    const call = vi.fn(async () => err(providerError('invalid_input', 'bad request')));
    const result = await invokeProvider(options(), call);
    expect(result.ok).toBe(false);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('does not retry an auth failure — a wrong key stays wrong', async () => {
    const call = vi.fn(async () => err(providerError('auth', 'invalid key')));
    await invokeProvider(options(), call);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('succeeds on a later attempt', async () => {
    let attempts = 0;
    const call = vi.fn(async () => {
      attempts += 1;
      return attempts < 3 ? err(providerError('rate_limit', 'slow down')) : success();
    });
    const result = await invokeProvider(options(), call);
    expect(result.ok).toBe(true);
    expect(call).toHaveBeenCalledTimes(3);
  });

  it('honours retryAfterMs over the backoff curve', async () => {
    const slept: number[] = [];
    const call = vi.fn(async () =>
      err(providerError('rate_limit', 'slow down', { retryAfterMs: 1234 })),
    );
    await invokeProvider(
      options({ sleep: async (ms: number) => void slept.push(ms), maxAttempts: 2 }),
      call,
    );
    expect(slept).toEqual([1234]);
  });

  it('times out a hanging call and classifies it as a timeout', async () => {
    const call = vi.fn(
      () => new Promise<ProviderResult<string>>(() => {}), // never settles
    );
    const result = await invokeProvider(options({ timeoutMs: 5, maxAttempts: 1 }), call);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.class).toBe('timeout');
  });

  it('converts a thrown adapter error into a result rather than propagating', async () => {
    const call = vi.fn(async () => {
      throw new Error('adapter bug');
    });
    const result = await invokeProvider(options({ maxAttempts: 1 }), call);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe('adapter bug');
  });

  it('records usage on success, with the attempt count', async () => {
    const records: UsageRecordDraft[] = [];
    await invokeProvider(options({ onUsage: (r: UsageRecordDraft) => records.push(r) }), async () =>
      success(),
    );
    expect(records).toHaveLength(1);
    expect(records[0]?.outcome).toBe('SUCCEEDED');
    expect(records[0]?.attempts).toBe(1);
    expect(records[0]?.usage).toEqual({ requests: 1 });
  });

  it('records usage on failure, with the error class and the real attempt count', async () => {
    const records: UsageRecordDraft[] = [];
    await invokeProvider(
      options({ onUsage: (r: UsageRecordDraft) => records.push(r), maxAttempts: 2 }),
      async () => err(providerError('transient', 'boom')),
    );
    expect(records[0]?.outcome).toBe('FAILED');
    expect(records[0]?.errorClass).toBe('transient');
    expect(records[0]?.attempts).toBe(2);
  });
});

describe('classifyHttpStatus', () => {
  it.each([
    [401, 'auth'],
    [403, 'auth'],
    [402, 'quota'],
    [400, 'invalid_input'],
    [422, 'invalid_input'],
    [429, 'rate_limit'],
    [451, 'policy'],
    [500, 'transient'],
    [503, 'transient'],
    [418, 'unavailable'],
  ])('maps %i to %s', (status, expected) => {
    expect(classifyHttpStatus(status as number)).toBe(expected);
  });
});
