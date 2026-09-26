import { err } from '@spirithaus/domain';
import { MockAdapter } from './base.js';
import { providerError } from '../../contracts/common.js';
import type { ProviderResult, VideoRenderProvider } from '../../contracts/index.js';

/**
 * The render mock, for tests and for a machine with no browser.
 *
 * The live adapter is in apps/render: Remotion is a first-party composition tool rather than a
 * vendor, so the "provider" here is our own renderer behind the same contract — which is what
 * lets the queue treat a local render and a Lambda one identically later.
 */
export class MockVideoRenderProvider extends MockAdapter implements VideoRenderProvider {
  readonly contract = 'VideoRenderProvider' as const;
  private readonly jobs = new Map<string, { pct: number; cancelled: boolean }>();

  async render(request: {
    composition: string;
    props: Record<string, unknown>;
    aspect: string;
    fps: number;
    durationFrames: number;
  }): Promise<ProviderResult<{ jobId: string }>> {
    const jobId = `mock-render-${crypto.randomUUID()}`;
    this.jobs.set(jobId, { pct: 0, cancelled: false });
    return this.success({ jobId }, { render_seconds: request.durationFrames / request.fps });
  }

  async progress(
    jobId: string,
  ): Promise<ProviderResult<{ pct: number; done: boolean; url?: string }>> {
    const job = this.jobs.get(jobId);
    if (!job)
      return err(providerError('invalid_input', `no render job ${jobId}`, { retryable: false }));
    job.pct = Math.min(100, job.pct + 25);
    // No URL, ever: nothing was rendered, and a plausible link would be the same lie as a
    // mock publisher returning a post URL.
    return this.success({ pct: job.pct, done: job.pct >= 100 });
  }

  async cancel(jobId: string): Promise<ProviderResult<{ cancelled: boolean }>> {
    const job = this.jobs.get(jobId);
    if (!job) return this.success({ cancelled: false });
    job.cancelled = true;
    return this.success({ cancelled: true });
  }
}
