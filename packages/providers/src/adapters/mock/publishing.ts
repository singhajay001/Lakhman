import { MockAdapter } from './base.js';
import type {
  ProviderResult,
  PublishOutcome,
  PublishRequest,
  SocialPlatform,
  SocialPublishingProvider,
} from '../../contracts/index.js';

/**
 * The most important mock in the codebase, because it is the one that must resist
 * the temptation to look like it worked. Section 21: never simulate publication
 * success. `published` is false and `state` is `not_published`, so the queue records
 * a real outcome and the UI renders the truth.
 */
export class MockSocialPublishingProvider extends MockAdapter implements SocialPublishingProvider {
  readonly contract = 'SocialPublishingProvider' as const;

  constructor(readonly platform: SocialPlatform) {
    super();
  }

  override async capabilities() {
    return [
      {
        id: `publish:${this.platform}`,
        available: true,
        verified: false,
        reason:
          'Development mock. No account is connected, nothing is transmitted, and nothing is published.',
      },
    ];
  }

  async publish(request: PublishRequest): Promise<ProviderResult<PublishOutcome>> {
    return this.success<PublishOutcome>({
      published: false,
      state: 'not_published',
      providerJobId: `mock-job-${request.idempotencyKey}`,
    });
  }

  async pollStatus(providerJobId: string): Promise<ProviderResult<PublishOutcome>> {
    return this.success<PublishOutcome>({
      published: false,
      state: 'not_published',
      providerJobId,
    });
  }
}
