import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { S3TestServer } from '@spirithaus/testing';
import { resetStorage, storage } from '@spirithaus/media-pipeline';
import { publishRender } from './render.js';

/**
 * A finished render has to leave the worker's disk.
 *
 * Until `publishRender` existed the handler wrote the video to `RENDER_OUTPUT_DIR` — documented in
 * the environment matrix as development-only — and then recorded a MediaAsset whose `objectKey`
 * pointed at nothing in the bucket. The bytes sat on one machine's `/tmp`, unreachable by the web
 * process or any delivery path, and the row looked like a success. That is the same cross-machine
 * defect ADR 0015 fixed for composites, left open for video.
 *
 * Exercised against a real S3 server over a socket, not a mock, for the same reason as the storage
 * adapter's own tests: the property worth proving is that the bytes are in the bucket afterwards.
 */
const BUCKET = 'spirithaus-render-test';
const FORBIDDEN = 'renders/denied.mp4';

let server: S3TestServer;
let dir: string;

const s3Env = (endpoint: string): void => {
  process.env.AWS_ACCESS_KEY_ID = 'AKIARENDEREXAMPLE';
  process.env.AWS_SECRET_ACCESS_KEY = 'rEnDeRsEcReTnEvErLoGgEd00000000000000000';
  process.env.AWS_ENDPOINT_URL_S3 = endpoint;
  process.env.AWS_REGION = 'auto';
  process.env.BUCKET_NAME = BUCKET;
};

beforeEach(async () => {
  server = new S3TestServer({ buckets: [BUCKET], forbidden: new Set([FORBIDDEN]) });
  s3Env(await server.start());
  resetStorage();
  dir = await mkdtemp(join(tmpdir(), 'render-publish-'));
});

afterEach(async () => {
  resetStorage();
  for (const name of [
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_ENDPOINT_URL_S3',
    'AWS_REGION',
    'BUCKET_NAME',
  ]) {
    delete process.env[name];
  }
  await server.stop();
});

describe('publishing a finished render', () => {
  it('puts the file in the bucket under its object key', async () => {
    const bytes = randomBytes(256 * 1024);
    const path = join(dir, 'clip.mp4');
    await writeFile(path, bytes);

    const written = await publishRender(path, 'renders/shop-1/clip.mp4');

    expect(written).toBe(bytes.byteLength);
    // Asserted against the server's own copy, not through the client that wrote it.
    expect(server.stored(BUCKET, 'renders/shop-1/clip.mp4')).toEqual(bytes);
  });

  it('preserves the bytes exactly', async () => {
    const bytes = randomBytes(1024 * 1024);
    const digest = createHash('sha256').update(bytes).digest('hex');
    const path = join(dir, 'exact.mp4');
    await writeFile(path, bytes);

    await publishRender(path, 'renders/exact.mp4');

    const back = await storage().get('renders/exact.mp4');
    expect(createHash('sha256').update(back!).digest('hex')).toBe(digest);
  });

  it('is readable by an independently constructed client — the cross-machine property', async () => {
    const bytes = randomBytes(64 * 1024);
    const path = join(dir, 'cross.mp4');
    await writeFile(path, bytes);

    await publishRender(path, 'renders/cross.mp4');

    // A fresh client, as the web process or a delivery path would build for itself.
    resetStorage();
    const read = await storage().get('renders/cross.mp4');
    expect(Buffer.from(read!)).toEqual(bytes);
  });

  it('removes the local file, so a long-lived worker does not fill its disk', async () => {
    const path = join(dir, 'temp.mp4');
    await writeFile(path, randomBytes(2048));

    await publishRender(path, 'renders/temp.mp4');

    expect(existsSync(path)).toBe(false);
  });

  it('throws when the upload is refused, and keeps the local file', async () => {
    const path = join(dir, 'denied.mp4');
    const bytes = randomBytes(4096);
    await writeFile(path, bytes);

    await expect(publishRender(path, FORBIDDEN)).rejects.toThrow();

    // The handler turns this into a FAILED job and lets BullMQ retry; deleting the output first
    // would make the retry rebuild a render that had already succeeded.
    expect(existsSync(path)).toBe(true);
    expect(await readFile(path)).toEqual(bytes);
  });

  it('throws rather than silently succeeding when the file is not there', async () => {
    await expect(publishRender(join(dir, 'missing.mp4'), 'renders/missing.mp4')).rejects.toThrow();
    expect(server.objectCount).toBe(0);
  });
});
