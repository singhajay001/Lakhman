import { err } from '@spirithaus/domain';
import { MockAdapter } from './base.js';
import { providerError } from '../../contracts/common.js';
import type { ProviderResult, VoiceProvider } from '../../contracts/index.js';

/**
 * A voice mock that returns real word-level alignment.
 *
 * The alignment is what the caption track is driven by, so a mock that omitted it would make
 * the render path untestable — and an evenly-split estimate is explicitly *not* alignment: it
 * drifts audibly within a sentence, which is why the contract asks for the real thing.
 *
 * Section 17: cloning is disabled. Not "unimplemented" — refused, with the reason.
 */
export class MockVoiceProvider extends MockAdapter implements VoiceProvider {
  readonly contract = 'VoiceProvider' as const;

  override async capabilities() {
    return [
      {
        id: 'voice:synthesise',
        available: true,
        verified: false,
        reason:
          'Development mock. Produces silence with plausible word timings; no audio is synthesised.',
      },
      {
        id: 'voice:clone',
        available: false,
        verified: false,
        reason:
          'Voice cloning is disabled. It requires a verified owner, documented consent, recorded permitted uses and an expiry (section 17), and no provider is configured to perform it.',
      },
    ];
  }

  async speak(request: { text: string; voiceId: string }): Promise<
    ProviderResult<{
      audio: Uint8Array;
      contentType: string;
      alignment?: { word: string; startMs: number; endMs: number }[];
    }>
  > {
    const words = request.text.split(/\s+/).filter(Boolean);

    // Timings that vary with word length rather than a flat split, so a caption track driven
    // by them behaves like one driven by real alignment.
    let cursor = 120;
    const alignment = words.map((word) => {
      const duration = 90 + word.length * 42 + (/[.,;:!?]$/.test(word) ? 180 : 0);
      const entry = { word, startMs: cursor, endMs: cursor + duration };
      cursor = entry.endMs + 30;
      return entry;
    });

    return this.success(
      {
        // Silence, honestly: a mock that returned a tone would be mistaken for a voice.
        audio: new Uint8Array(0),
        contentType: 'audio/mpeg',
        alignment,
      },
      { characters: request.text.length },
    );
  }

  async cloneVoice(): Promise<ProviderResult<{ voiceId: string }>> {
    return err(
      providerError(
        'policy',
        'Voice cloning is disabled. Enabling it needs the verified voice owner, documented consent, recorded permitted uses and an expiry, and an administrator to turn it on for a provider that permits cloning.',
        { retryable: false },
      ),
    );
  }
}
