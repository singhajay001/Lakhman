import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { logger } from '@spirithaus/observability';

/**
 * Object storage, behind the narrowest interface the media pipeline needs.
 *
 * The ObjectStorageProvider contract is the real seam; this is the app-side convenience over
 * it. With no provider configured it writes to a local directory and says so — a mock that
 * returned a signed URL for a file it never stored would be the failure section 43 names, and
 * the media pipeline genuinely needs the bytes back.
 */
export interface Storage {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  readonly local: boolean;
}

class LocalStorage implements Storage {
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

let instance: Storage | undefined;

export function storage(): Storage {
  if (instance) return instance;
  const root = process.env.MEDIA_STORE_DIR ?? '/tmp/spirithaus-media';
  logger.warn(
    { root },
    'No object storage provider is configured; media is written to a local directory and will not survive this machine.',
  );
  instance = new LocalStorage(root);
  return instance;
}
