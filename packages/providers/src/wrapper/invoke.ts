import { err, ok } from '@spirithaus/domain';
import { childLogger, type Usage } from '@spirithaus/observability';
import { providerError, type ProviderError, type ProviderResult } from '../contracts/common.js';

export interface InvokeOptions {
  contract: string;
  adapterId: string;
  operation: string;
  timeoutMs: number;
  maxAttempts: number;
  /** Multiplied by 2^(attempt-1); jitter is applied on top. */
  baseDelayMs: number;
  /** Injected in tests so backoff does not spend real seconds. */
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  onUsage?: (record: UsageRecordDraft) => void;
}

export interface UsageRecordDraft {
  contract: string;
  adapterId: string;
  operation: string;
  usage: Usage;
  providerRequestId?: string;
  latencyMs: number;
  outcome: 'SUCCEEDED' | 'FAILED';
  errorClass?: string;
  attempts: number;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Timeouts, retries, error classification and usage logging live here rather than in
 * each adapter, so a new adapter cannot forget them. Sixteen contracts is sixteen
 * chances to forget.
 */
export async function invokeProvider<T>(
  options: InvokeOptions,
  call: () => Promise<ProviderResult<T>>,
): Promise<ProviderResult<T>> {
  const log = childLogger({
    contract: options.contract,
    adapter: options.adapterId,
    operation: options.operation,
  });
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? (() => Date.now());
  const startedAt = now();

  let lastError: ProviderError = providerError('unavailable', 'provider was never called');
  let attemptsMade = 0;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    attemptsMade = attempt;
    let result: ProviderResult<T>;
    try {
      result = await withTimeout(call(), options.timeoutMs, options.operation);
    } catch (thrown) {
      // An adapter that throws is an adapter with a bug; it still must not take the
      // process with it.
      result = err(
        providerError('transient', thrown instanceof Error ? thrown.message : String(thrown), {
          retryable: true,
        }),
      );
    }

    if (result.ok) {
      options.onUsage?.({
        contract: options.contract,
        adapterId: options.adapterId,
        operation: options.operation,
        usage: result.value.usage,
        providerRequestId: result.value.providerRequestId,
        latencyMs: now() - startedAt,
        outcome: 'SUCCEEDED',
        attempts: attempt,
      });
      return result;
    }

    lastError = result.error;
    const isLast = attempt === options.maxAttempts;
    if (!result.error.retryable || isLast) break;

    const delay = result.error.retryAfterMs ?? backoff(options.baseDelayMs, attempt);
    log.warn({ attempt, errorClass: result.error.class, delay }, 'provider call failed, retrying');
    await sleep(delay);
  }

  options.onUsage?.({
    contract: options.contract,
    adapterId: options.adapterId,
    operation: options.operation,
    usage: {},
    providerRequestId: lastError.providerRequestId,
    latencyMs: now() - startedAt,
    outcome: 'FAILED',
    errorClass: lastError.class,
    attempts: attemptsMade,
  });

  return err(lastError);
}

function backoff(base: number, attempt: number): number {
  const exponential = base * 2 ** (attempt - 1);
  // Full jitter. Several workers failing against the same rate limit should not
  // retry in lockstep.
  return Math.round(exponential * (0.5 + Math.random() * 0.5));
}

async function withTimeout<T>(
  promise: Promise<ProviderResult<T>>,
  timeoutMs: number,
  operation: string,
): Promise<ProviderResult<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<ProviderResult<T>>((resolve) => {
        timer = setTimeout(
          () =>
            resolve(
              err(
                providerError('timeout', `${operation} exceeded ${timeoutMs}ms`, {
                  retryable: true,
                }),
              ),
            ),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Maps an HTTP status onto an error class, for adapters that speak HTTP. */
export function classifyHttpStatus(status: number): ProviderError['class'] {
  if (status === 401 || status === 403) return 'auth';
  if (status === 402) return 'quota';
  if (status === 408) return 'timeout';
  if (status === 422 || status === 400) return 'invalid_input';
  if (status === 429) return 'rate_limit';
  if (status === 451) return 'policy';
  if (status >= 500) return 'transient';
  return 'unavailable';
}

export { ok, err };
