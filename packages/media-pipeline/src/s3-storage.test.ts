import { createHash, randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { S3TestServer } from '@spirithaus/testing';
import { S3Storage, StorageError } from './s3-storage.js';
import { createStorage, type Storage } from './storage.js';
import type { S3StorageConfig } from './storage-config.js';

/**
 * The storage adapter against a real S3 server over a real socket.
 *
 * The SDK is not mocked. That is the point: the property that was broken in production is not
 * "does put() get called", it is "does a client built in one process read what a client built in
 * another process wrote to the same bucket". Only the wire can answer that, so these tests use an
 * HTTP server that answers path-style S3 requests and nothing else.
 */
const BUCKET = 'spirithaus-test-media';
const FORBIDDEN = 'protected/denied.png';

let server: S3TestServer;
let endpoint: string;

const configFor = (bucket = BUCKET): S3StorageConfig => ({
  accessKeyId: 'AKIAEXAMPLEEXAMPLE',
  secretAccessKey: 'gG6ceSeCrEtVaLuEnEvErLoGgEd0000000000000',
  endpoint,
  region: 'auto',
  bucket,
  forcePathStyle: true,
});

/** A fresh client every time, never shared. Each one is a stand-in for a separate process. */
const client = (bucket = BUCKET): S3Storage => new S3Storage(configFor(bucket));

beforeEach(async () => {
  server = new S3TestServer({ buckets: [BUCKET], forbidden: new Set([FORBIDDEN]) });
  endpoint = await server.start();
});

afterEach(async () => {
  await server.stop();
});

describe('two independently constructed clients', () => {
  it('one reads what the other wrote — the web/worker property', async () => {
    const web = client();
    const worker = client();
    const bytes = randomBytes(64 * 1024);

    await web.put('environments/abc123.png', bytes, 'image/png');
    const read = await worker.get('environments/abc123.png');

    expect(read).not.toBeNull();
    expect(Buffer.from(read!)).toEqual(bytes);
  });

  it('preserve the bytes exactly, by digest', async () => {
    // 3MB of incompressible data, so any re-encoding, truncation or string round-trip shows up.
    const bytes = randomBytes(3 * 1024 * 1024);
    const digest = createHash('sha256').update(bytes).digest('hex');

    await client().put('masters/big.png', bytes, 'image/png');
    const read = await client().get('masters/big.png');

    expect(createHash('sha256').update(read!).digest('hex')).toBe(digest);
    expect(read!.byteLength).toBe(bytes.byteLength);
  });

  it('resolve to the same logical bucket and endpoint', () => {
    expect(client().target).toEqual(client().target);
    expect(client().target).toEqual({ endpoint, bucket: BUCKET, region: 'auto' });
  });

  it('are not sharing an in-process cache: the bytes really went over the wire', async () => {
    const bytes = randomBytes(1024);
    await client().put('proof/on-the-wire.png', bytes, 'image/png');

    // Asserted against the server's own copy, not through the adapter that wrote it.
    expect(server.stored(BUCKET, 'proof/on-the-wire.png')).toEqual(bytes);
  });
});

describe('addressing', () => {
  it('is path-style, proven by the request the server received', async () => {
    await client().put('environments/x.png', randomBytes(8), 'image/png');

    const put = server.requests.find((r) => r.method === 'PUT');
    expect(put).toBeDefined();
    // `/<bucket>/<key>`, not `<bucket>.<host>/<key>`. The SDK appends its own `?x-id=PutObject`
    // marker, which is not part of the addressing.
    expect(put!.path.split('?')[0]).toBe(`/${BUCKET}/environments/x.png`);
    expect(put!.host).not.toContain(`${BUCKET}.`);
  });

  it('signs its requests', async () => {
    await client().put('environments/y.png', randomBytes(8), 'image/png');
    expect(server.requests.find((r) => r.method === 'PUT')?.authScheme).toBe('AWS4-HMAC-SHA256');
  });

  it('keeps nested keys intact rather than flattening them', async () => {
    await client().put('a/b/c/d.png', randomBytes(8), 'image/png');
    expect(server.stored(BUCKET, 'a/b/c/d.png')).toBeDefined();
  });
});

describe('a missing object', () => {
  it('reads as null, matching the local store', async () => {
    expect(await client().get('environments/never-written.png')).toBeNull();
  });

  it('is null rather than an empty buffer, so a caller can tell the difference', async () => {
    const read = await client().get('nothing/here.png');
    expect(read).toBeNull();
    expect(read).not.toEqual(new Uint8Array());
  });
});

describe('a real failure', () => {
  /**
   * The distinction this file exists to defend. The composite handler treats a missing environment
   * plate as a terminal refusal — it does not retry, and it records the job FAILED with "missing
   * from storage". If a 403 collapsed into null, a wrong bucket policy would be recorded as the
   * pipeline working correctly, and nobody would look at the credentials.
   */
  it('is not reported as a missing object when access is denied', async () => {
    await expect(client().get(FORBIDDEN)).rejects.toThrow(StorageError);
  });

  it('carries the status but not the request', async () => {
    try {
      await client().get(FORBIDDEN);
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(StorageError);
      const failure = error as StorageError;
      expect(failure.cause.status).toBe(403);
      expect(failure.cause.kind).toBe('AccessDenied');
    }
  });

  it('surfaces a missing bucket rather than treating it as an empty one', async () => {
    await expect(client('no-such-bucket').get('anything.png')).rejects.toThrow(StorageError);
  });

  it('surfaces a refused write', async () => {
    await expect(client().put(FORBIDDEN, randomBytes(8), 'image/png')).rejects.toThrow(
      StorageError,
    );
  });

  it('reports a network failure rather than absence when the endpoint is not listening', async () => {
    await server.stop();
    await expect(client().get('environments/x.png')).rejects.toThrow(StorageError);
    // Restarted so afterEach's stop() has something to close.
    server = new S3TestServer({ buckets: [BUCKET] });
    endpoint = await server.start();
  });
});

describe('replacement', () => {
  it('overwrites a key, matching the local store', async () => {
    const first = randomBytes(256);
    const second = randomBytes(512);

    await client().put('masters/replaced.png', first, 'image/png');
    await client().put('masters/replaced.png', second, 'image/png');

    const read = await client().get('masters/replaced.png');
    expect(Buffer.from(read!)).toEqual(second);
    expect(read!.byteLength).toBe(512);
  });

  /**
   * Environment plates are keyed by the digest of their bytes, so the same environment reuses the
   * same key and a re-request overwrites it with identical content. That is what makes a repeated
   * composite request idempotent rather than accumulating near-duplicates.
   */
  it('leaves one object when the same digest is written twice', async () => {
    const bytes = randomBytes(1024);
    const key = `environments/${createHash('sha256').update(bytes).digest('hex').slice(0, 16)}.png`;

    await client().put(key, bytes, 'image/png');
    await client().put(key, bytes, 'image/png');

    expect(server.objectCount).toBe(1);
    expect(server.stored(BUCKET, key)).toEqual(bytes);
  });

  it('gives a different key to different bytes', async () => {
    const a = randomBytes(1024);
    const b = randomBytes(1024);
    const keyOf = (bytes: Buffer) =>
      `environments/${createHash('sha256').update(bytes).digest('hex').slice(0, 16)}.png`;

    await client().put(keyOf(a), a, 'image/png');
    await client().put(keyOf(b), b, 'image/png');

    expect(server.objectCount).toBe(2);
  });
});

describe('credentials', () => {
  const SECRET = 'gG6ceSeCrEtVaLuEnEvErLoGgEd0000000000000';

  it('never appear in a thrown error, for any operation that can fail', async () => {
    // Thunks rather than promises: three rejections started at once would be flagged unhandled
    // before the loop reached them.
    const attempts: (() => Promise<unknown>)[] = [
      () => client().get(FORBIDDEN),
      () => client().put(FORBIDDEN, randomBytes(8), 'image/png'),
      () => client('no-such-bucket').get('x.png'),
    ];

    for (const attempt of attempts) {
      const message = await attempt().then(
        () => '',
        (error: unknown) => `${(error as Error).name}: ${(error as Error).message}`,
      );
      expect(message).not.toBe('');
      expect(message).not.toContain(SECRET);
      expect(message).not.toContain('AKIAEXAMPLEEXAMPLE');
      // A presigned or signed URL would carry these; the wrapped error carries neither.
      expect(message).not.toContain('X-Amz-Signature');
      expect(message).not.toContain('X-Amz-Credential');
      expect(message).not.toMatch(/Authorization/i);
    }
  });

  it('are not reachable from the error object either', async () => {
    try {
      await client().get(FORBIDDEN);
    } catch (error) {
      const serialised = JSON.stringify({
        name: (error as Error).name,
        message: (error as Error).message,
        cause: (error as StorageError).cause,
      });
      expect(serialised).not.toContain(SECRET);
    }
  });
});

describe('the resolver and the adapter together', () => {
  it('build a working client from Fly-shaped variables', async () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: 'production',
      AWS_ACCESS_KEY_ID: 'AKIAEXAMPLEEXAMPLE',
      AWS_SECRET_ACCESS_KEY: 'gG6ceSeCrEtVaLuEnEvErLoGgEd0000000000000',
      AWS_ENDPOINT_URL_S3: endpoint,
      AWS_REGION: 'auto',
      BUCKET_NAME: BUCKET,
    };

    // Two resolutions of the same environment, as the web process and the worker each do once.
    const web: Storage = createStorage({ env, component: 'web' });
    const worker: Storage = createStorage({ env, component: 'worker' });

    expect(web.local).toBe(false);
    expect(worker.local).toBe(false);

    const bytes = randomBytes(2048);
    await web.put('environments/shared.png', bytes, 'image/png');
    expect(Buffer.from((await worker.get('environments/shared.png'))!)).toEqual(bytes);
  });
});
