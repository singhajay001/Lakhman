import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { S3Storage } from './s3-storage.js';
import {
  assertStorageConfigured,
  resolveStorageConfig,
  type ResolveOptions,
} from './storage-config.js';

/**
 * Object storage, behind the narrowest interface the media pipeline needs.
 *
 * The ObjectStorageProvider contract is the real seam; this is the app-side convenience over
 * it. Two implementations: S3 for anything deployed, and a local directory for a developer
 * machine. Which one is chosen is decided by `resolveStorageConfig`, once, at startup — and both
 * the web process and the worker run the same resolver against the same variables, so they
 * cannot end up on different backends by accident. That was not true before: the local store was
 * unconditional, so on a two-machine deployment the web process wrote to its own disk and the
 * worker read from a different one.
 */
export interface Storage {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  readonly local: boolean;
}

/**
 * A directory on this machine. Development and test only.
 *
 * Refused in a deployed environment by the resolver, because it is not shared: it is the exact
 * shape that makes a write succeed and the read from the other process fail.
 */
export class LocalStorage implements Storage {
  readonly local = true;
  constructor(private readonly root: string) {}

  private path(key: string): string {
    // Keys are app-generated, never user input; still resolved and checked, because a key that
    // escapes the root would write anywhere the process can.
    const full = resolve(this.root, key);
    if (!full.startsWith(resolve(this.root)))
      throw new Error(`refusing to write outside the store: ${key}`);
    return full;
  }

  async put(key: string, bytes: Uint8Array, _contentType: string): Promise<void> {
    const path = this.path(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      return new Uint8Array(await readFile(this.path(key)));
    } catch {
      return null;
    }
  }
}

/**
 * Builds a storage client from the environment, without touching the process-wide one.
 *
 * This is what makes the cross-process property testable: a test can construct two independent
 * clients against the same bucket and prove that one reads what the other wrote, which is
 * precisely what the web and worker machines do and precisely what used to be broken.
 */
export function createStorage(options: ResolveOptions): Storage {
  const resolution = resolveStorageConfig(options);
  return resolution.kind === 's3'
    ? new S3Storage(resolution.config)
    : new LocalStorage(resolution.root);
}

let instance: Storage | undefined;

/**
 * The process-wide client.
 *
 * Memoised because an S3 client owns a connection pool and rebuilding it per call would open a
 * socket per object. Throws on a bad or absent deployed configuration — the same refusal
 * `assertStorage` makes at startup, so a process that somehow got this far still cannot write
 * media to the wrong place.
 */
export function storage(): Storage {
  if (instance) return instance;
  instance = createStorage({ component: 'media-pipeline' });
  return instance;
}

/**
 * Discards the memoised client.
 *
 * For tests, and for nothing else. Two processes each have their own `storage()`; a test runs in
 * one, so this is how it crosses that boundary honestly rather than by sharing an instance.
 */
export function resetStorage(): void {
  instance = undefined;
}

/**
 * Validates storage configuration at startup and throws if it is unusable.
 *
 * Called by the web process and by the worker. A deployed process with no bucket refuses to
 * start, rather than accepting work it cannot complete and failing every composite at the point
 * the worker reads an environment plate that was written to another machine's disk.
 */
export function assertStorage(component: string): void {
  assertStorageConfigured({ component });
}
