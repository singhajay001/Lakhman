import { err } from '@spirithaus/domain';
import { MockAdapter } from './base.js';
import {
  providerError,
  type ProviderContract,
  type ProviderResult,
} from '../../contracts/common.js';

/**
 * For contracts with no provider chosen for the initial release — trend
 * intelligence, avatar video, generative video. Section 3 requires honest
 * capability reporting, so these report unavailable with a reason rather than
 * returning empty results that read as "nothing is trending".
 */
export class UnconfiguredProvider extends MockAdapter {
  override readonly isMock = true;

  constructor(
    readonly contract: ProviderContract,
    private readonly why: string,
  ) {
    super();
  }

  override async capabilities() {
    return [
      { id: `unconfigured:${this.contract}`, available: false, verified: false, reason: this.why },
    ];
  }

  override validateConfig() {
    return { valid: false as const, missing: ['adapter'], message: this.why };
  }

  override async health() {
    return { healthy: false as const, message: this.why, class: 'unavailable' as const };
  }

  call<T>(): ProviderResult<T> {
    return err(providerError('unavailable', this.why, { retryable: false }));
  }
}
