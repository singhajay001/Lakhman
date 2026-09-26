import { estimate, type CostEstimate, type RateCard, type Usage } from '@spirithaus/observability';
import { ok } from '@spirithaus/domain';
import type {
  Capability,
  ConfigResult,
  HealthResult,
  ProviderContract,
  ProviderResult,
} from '../../contracts/common.js';

/**
 * Mocks are a supported configuration, not a test double. `PROVIDER_*=mock` runs in
 * development and in CI, and everything a mock returns is flagged `mock: true` so the
 * UI can say "not published" rather than showing a plausible success — the failure
 * section 43 prohibits.
 */
export abstract class MockAdapter {
  readonly id = 'mock';
  readonly isMock = true;
  abstract readonly contract: ProviderContract;

  validateConfig(): ConfigResult {
    return { valid: true };
  }

  async health(): Promise<HealthResult> {
    return { healthy: true, latencyMs: 0 };
  }

  async capabilities(): Promise<Capability[]> {
    return [
      {
        id: `mock:${this.contract}`,
        available: true,
        // A mock has verified nothing. Section 4.
        verified: false,
        reason: 'Development mock. No live provider has been contacted.',
      },
    ];
  }

  estimateCost(_request: unknown, rateCard: RateCard | null): CostEstimate {
    return estimate(this.mockUsage(), rateCard);
  }

  protected mockUsage(): Usage {
    return { requests: 1 };
  }

  protected success<T>(value: T, usage: Usage = this.mockUsage()): ProviderResult<T> {
    return ok({ value, usage, mock: true, providerRequestId: `mock-${crypto.randomUUID()}` });
  }
}
