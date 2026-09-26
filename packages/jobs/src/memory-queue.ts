import type { EnqueueOptions, EnqueueOutcome, JobQueue, JobRecord } from './port.js';

/**
 * In-memory queue for tests and for a single-process development run. It implements
 * the same duplicate and completion rules as the BullMQ adapter, so a test that
 * passes here is testing the rule rather than the transport.
 */
export class MemoryQueue implements JobQueue {
  private readonly jobs = new Map<string, JobRecord<unknown>>();

  private key(queue: string, jobId: string): string {
    return `${queue}:${jobId}`;
  }

  async enqueue<T>(queue: string, payload: T, options: EnqueueOptions): Promise<EnqueueOutcome<T>> {
    const key = this.key(queue, options.jobId);
    const existing = this.jobs.get(key) as JobRecord<T> | undefined;

    if (existing) {
      return {
        created: false,
        reason: existing.state === 'completed' ? 'already_completed' : 'duplicate',
        job: existing,
      };
    }

    const job: JobRecord<T> = {
      id: options.jobId,
      queue,
      payload,
      state: options.runAt && options.runAt.getTime() > Date.now() ? 'delayed' : 'waiting',
      attempts: 0,
      progress: 0,
      runAt: options.runAt ?? new Date(),
    };
    this.jobs.set(key, job as JobRecord<unknown>);
    return { created: true, job };
  }

  async get<T>(queue: string, jobId: string): Promise<JobRecord<T> | null> {
    return (this.jobs.get(this.key(queue, jobId)) as JobRecord<T> | undefined) ?? null;
  }

  async cancel(queue: string, jobId: string): Promise<boolean> {
    const job = this.jobs.get(this.key(queue, jobId));
    if (!job) return false;
    if (job.state !== 'waiting' && job.state !== 'delayed') return false;
    job.state = 'cancelled';
    return true;
  }

  async setProgress(queue: string, jobId: string, pct: number): Promise<void> {
    const job = this.jobs.get(this.key(queue, jobId));
    if (job) job.progress = Math.max(0, Math.min(100, pct));
  }

  async close(): Promise<void> {
    this.jobs.clear();
  }

  // --- test affordances ---------------------------------------------------------

  /** Marks a job as it would be after a worker ran it. Test-only. */
  markState(queue: string, jobId: string, state: JobRecord['state'], error?: string): void {
    const job = this.jobs.get(this.key(queue, jobId));
    if (!job) throw new Error(`no job ${queue}:${jobId}`);
    job.state = state;
    if (error !== undefined) job.error = error;
    if (state === 'active' || state === 'failed' || state === 'completed') job.attempts += 1;
  }

  list(queue: string): JobRecord<unknown>[] {
    return [...this.jobs.values()].filter((job) => job.queue === queue);
  }
}
