import { Queue, type JobsOptions } from 'bullmq';
import IORedis, { type Redis } from 'ioredis';
import type { EnqueueOptions, EnqueueOutcome, JobQueue, JobRecord, JobState } from './port.js';

export interface BullMqQueueOptions {
  redisUrl: string;
  prefix?: string;
  /** Injected in tests. */
  connection?: Redis;
}

/**
 * The durable adapter. Scheduled publication must not depend on an open browser
 * (section 36), which is the whole reason the delayed job lives in Redis rather than
 * in a setTimeout.
 */
export class BullMqQueue implements JobQueue {
  private readonly connection: Redis;
  private readonly queues = new Map<string, Queue>();
  private readonly prefix: string;

  constructor(options: BullMqQueueOptions) {
    this.connection =
      options.connection ??
      new IORedis(options.redisUrl, {
        // BullMQ requires this; without it a blocking command can be retried and
        // a job processed twice.
        maxRetriesPerRequest: null,
      });
    this.prefix = options.prefix ?? 'spirithaus';
  }

  private queue(name: string): Queue {
    const existing = this.queues.get(name);
    if (existing) return existing;
    const created = new Queue(name, { connection: this.connection, prefix: this.prefix });
    this.queues.set(name, created);
    return created;
  }

  async enqueue<T>(name: string, payload: T, options: EnqueueOptions): Promise<EnqueueOutcome<T>> {
    const queue = this.queue(name);
    const existing = await queue.getJob(options.jobId);
    if (existing) {
      const state = await this.stateOf(name, options.jobId);
      const job = await this.toRecord<T>(name, options.jobId);
      if (!job) throw new Error(`job ${name}:${options.jobId} vanished mid-read`);
      return {
        created: false,
        reason: state === 'completed' ? 'already_completed' : 'duplicate',
        job,
      };
    }

    const delay = options.runAt ? Math.max(0, options.runAt.getTime() - Date.now()) : 0;
    const jobOptions: JobsOptions = {
      jobId: options.jobId,
      delay,
      attempts: options.maxAttempts ?? 3,
      backoff: { type: 'exponential', delay: options.backoffMs ?? 1000 },
      // Keep a window of terminal jobs so a duplicate enqueue can still see that the
      // work already succeeded.
      removeOnComplete: { age: 7 * 24 * 3600, count: 5000 },
      removeOnFail: { age: 30 * 24 * 3600 },
    };

    await queue.add(name, payload, jobOptions);
    const job = await this.toRecord<T>(name, options.jobId);
    if (!job) throw new Error(`job ${name}:${options.jobId} was not stored`);
    return { created: true, job };
  }

  async get<T>(name: string, jobId: string): Promise<JobRecord<T> | null> {
    return this.toRecord<T>(name, jobId);
  }

  async cancel(name: string, jobId: string): Promise<boolean> {
    const job = await this.queue(name).getJob(jobId);
    if (!job) return false;
    const state = await job.getState();
    if (state !== 'waiting' && state !== 'delayed' && state !== 'prioritized') return false;
    await job.remove();
    return true;
  }

  async setProgress(name: string, jobId: string, pct: number): Promise<void> {
    const job = await this.queue(name).getJob(jobId);
    await job?.updateProgress(Math.max(0, Math.min(100, pct)));
  }

  async close(): Promise<void> {
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
    this.queues.clear();
    await this.connection.quit();
  }

  private async stateOf(name: string, jobId: string): Promise<JobState> {
    const job = await this.queue(name).getJob(jobId);
    if (!job) return 'cancelled';
    return mapState(await job.getState());
  }

  private async toRecord<T>(name: string, jobId: string): Promise<JobRecord<T> | null> {
    const job = await this.queue(name).getJob(jobId);
    if (!job) return null;
    const progress = typeof job.progress === 'number' ? job.progress : 0;
    return {
      id: jobId,
      queue: name,
      payload: job.data as T,
      state: mapState(await job.getState()),
      attempts: job.attemptsMade,
      progress,
      runAt: new Date(job.timestamp + (job.opts.delay ?? 0)),
      error: job.failedReason ?? undefined,
      result: job.returnvalue ?? undefined,
    };
  }
}

function mapState(state: string): JobState {
  switch (state) {
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'active':
      return 'active';
    case 'delayed':
      return 'delayed';
    case 'waiting':
    case 'waiting-children':
    case 'prioritized':
      return 'waiting';
    default:
      return 'waiting';
  }
}
