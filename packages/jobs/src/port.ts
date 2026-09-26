/**
 * The queue port. BullMQ is behind it so that an AWS deployment costs one adapter
 * rather than a rewrite of the publishing layer (docs/social-studio/02-architecture.md).
 */
export type JobState = 'waiting' | 'delayed' | 'active' | 'completed' | 'failed' | 'cancelled';

export interface JobRecord<T = unknown> {
  id: string;
  queue: string;
  payload: T;
  state: JobState;
  attempts: number;
  progress: number;
  runAt: Date;
  error?: string;
  result?: unknown;
}

export interface EnqueueOptions {
  /**
   * The job's identity. Enqueueing the same id twice is a no-op that returns the
   * existing job — which is what makes "never republish a successful job during
   * retries" structural rather than a check someone must remember.
   */
  jobId: string;
  runAt?: Date;
  maxAttempts?: number;
  /** Milliseconds; the adapter applies exponential backoff from it. */
  backoffMs?: number;
}

export type EnqueueOutcome<T> =
  | { created: true; job: JobRecord<T> }
  | { created: false; reason: 'duplicate' | 'already_completed'; job: JobRecord<T> };

export interface JobQueue {
  enqueue<T>(queue: string, payload: T, options: EnqueueOptions): Promise<EnqueueOutcome<T>>;
  get<T>(queue: string, jobId: string): Promise<JobRecord<T> | null>;
  /** Cancels a job that has not been dispatched. Returns false once it is active or finished. */
  cancel(queue: string, jobId: string): Promise<boolean>;
  setProgress(queue: string, jobId: string, pct: number): Promise<void>;
  close(): Promise<void>;
}
