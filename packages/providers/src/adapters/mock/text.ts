import { MockAdapter } from './base.js';
import type {
  ProviderResult,
  TextGenerationProvider,
  TextGenerationRequest,
} from '../../contracts/index.js';

export class MockTextGenerationProvider extends MockAdapter implements TextGenerationProvider {
  readonly contract = 'TextGenerationProvider' as const;

  async generate(
    request: TextGenerationRequest,
  ): Promise<ProviderResult<{ text: string; model: string }>> {
    // Deterministic and obviously synthetic. A mock that produced plausible
    // marketing copy would end up in a review queue and be approved by accident.
    const text = [
      '[MOCK OUTPUT — no model was called]',
      `prompt: ${request.prompt.slice(0, 120)}`,
      request.untrustedContext?.length
        ? `untrusted context blocks: ${request.untrustedContext.length}`
        : 'untrusted context blocks: 0',
    ].join('\n');

    return this.success(
      { text, model: request.model ?? 'mock-1' },
      {
        input_tokens: Math.ceil((request.system.length + request.prompt.length) / 4),
        output_tokens: Math.ceil(text.length / 4),
      },
    );
  }
}
