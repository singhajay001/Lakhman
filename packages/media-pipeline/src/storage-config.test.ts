import { describe, expect, it } from 'vitest';
import { LocalStorage, createStorage } from './storage.js';
import { S3Storage } from './s3-storage.js';
import {
  DEFAULT_LOCAL_ROOT,
  DEFAULT_REGION,
  StorageConfigError,
  resolveStorageConfig,
} from './storage-config.js';

/**
 * The storage decision, which is a security and correctness boundary rather than a preference.
 *
 * Two failures are being guarded against. The first is the one that shipped: a deployed process
 * silently using a local directory, so the web machine's writes are invisible to the worker's
 * reads and every composite fails at the point of use. The second is a half-set configuration,
 * where quietly falling back to local storage would hide a typo in a bucket name until exactly
 * the same failure.
 */
const KEY = 'AKIAEXAMPLEEXAMPLE';
const SECRET = 'gG6ceSeCrEtVaLuEnEvErLoGgEd0000000000000';

const full = (extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => ({
  AWS_ACCESS_KEY_ID: KEY,
  AWS_SECRET_ACCESS_KEY: SECRET,
  AWS_ENDPOINT_URL_S3: 'https://fly.storage.tigris.dev',
  BUCKET_NAME: 'spirithaus-staging-media',
  ...extra,
});

const resolve = (env: NodeJS.ProcessEnv) => resolveStorageConfig({ env, component: 'test' });

describe('a complete S3 configuration', () => {
  it('selects S3, with the endpoint and bucket Fly injects', () => {
    const resolution = resolve(full({ NODE_ENV: 'production' }));

    expect(resolution.kind).toBe('s3');
    if (resolution.kind !== 's3') throw new Error('unreachable');
    expect(resolution.config.endpoint).toBe('https://fly.storage.tigris.dev');
    expect(resolution.config.bucket).toBe('spirithaus-staging-media');
    expect(resolution.config.accessKeyId).toBe(KEY);
  });

  it('addresses buckets path-style, because the endpoint is a fixed host', () => {
    const resolution = resolve(full());
    if (resolution.kind !== 's3') throw new Error('expected s3');
    expect(resolution.config.forcePathStyle).toBe(true);
  });

  it('defaults the region to auto, which is what Tigris uses', () => {
    const resolution = resolve(full());
    if (resolution.kind !== 's3') throw new Error('expected s3');
    expect(resolution.config.region).toBe(DEFAULT_REGION);
  });

  it('honours an explicit region', () => {
    const resolution = resolve(full({ AWS_REGION: 'auto' }));
    if (resolution.kind !== 's3') throw new Error('expected s3');
    expect(resolution.config.region).toBe('auto');
  });

  it('builds an S3Storage', () => {
    const client = createStorage({ env: full({ NODE_ENV: 'production' }), component: 'test' });
    expect(client).toBeInstanceOf(S3Storage);
    expect(client.local).toBe(false);
  });

  it('refuses an endpoint that is not a URL, rather than failing later as a network error', () => {
    expect(() => resolve(full({ AWS_ENDPOINT_URL_S3: 'fly.storage.tigris.dev' }))).toThrow(
      StorageConfigError,
    );
  });
});

describe('no S3 configuration at all', () => {
  it.each(['development', 'test'])('uses local storage in NODE_ENV=%s', (nodeEnv) => {
    const resolution = resolve({ NODE_ENV: nodeEnv });
    expect(resolution.kind).toBe('local');
    if (resolution.kind !== 'local') throw new Error('unreachable');
    expect(resolution.root).toBe(DEFAULT_LOCAL_ROOT);
  });

  it('honours MEDIA_STORE_DIR in development', () => {
    const resolution = resolve({ NODE_ENV: 'development', MEDIA_STORE_DIR: '/tmp/elsewhere' });
    if (resolution.kind !== 'local') throw new Error('expected local');
    expect(resolution.root).toBe('/tmp/elsewhere');
  });

  it('builds a LocalStorage', () => {
    const client = createStorage({ env: { NODE_ENV: 'development' }, component: 'test' });
    expect(client).toBeInstanceOf(LocalStorage);
    expect(client.local).toBe(true);
  });

  // The whole point. Staging sets NODE_ENV=production, so this is the staging case too.
  it.each(['production', 'staging'])('refuses to run in NODE_ENV=%s', (nodeEnv) => {
    expect(() => resolve({ NODE_ENV: nodeEnv })).toThrow(StorageConfigError);
  });

  it('says why a deployed environment cannot use a local directory', () => {
    try {
      resolve({ NODE_ENV: 'production' });
      throw new Error('should have refused');
    } catch (error) {
      expect((error as Error).message).toMatch(/separate machines|not shared storage/i);
      expect((error as Error).message).toContain('BUCKET_NAME');
    }
  });

  it('treats an unset NODE_ENV as development, not as deployed', () => {
    expect(resolve({}).kind).toBe('local');
  });
});

describe('a partial S3 configuration', () => {
  it.each([
    ['AWS_ACCESS_KEY_ID'],
    ['AWS_SECRET_ACCESS_KEY'],
    ['AWS_ENDPOINT_URL_S3'],
    ['BUCKET_NAME'],
  ])('fails closed when %s is missing, even in development', (missing) => {
    const env = full({ NODE_ENV: 'development' });
    delete env[missing];
    expect(() => resolve(env)).toThrow(StorageConfigError);
  });

  it('names what is missing', () => {
    const env = full();
    delete env.BUCKET_NAME;
    expect(() => resolve(env)).toThrow(/BUCKET_NAME/);
  });

  it('treats an empty string as absent, because a blank secret is not a configuration', () => {
    expect(() => resolve(full({ BUCKET_NAME: '   ' }))).toThrow(StorageConfigError);
  });

  /**
   * AWS_REGION is set incidentally by all sorts of tooling, so it is not read as a statement of
   * intent. Were it counted, an unrelated machine with AWS_REGION in its environment would refuse
   * to start for a bucket nobody asked for.
   */
  it('does not treat AWS_REGION alone as an attempt to configure S3', () => {
    expect(resolve({ NODE_ENV: 'development', AWS_REGION: 'ap-southeast-2' }).kind).toBe('local');
  });

  /**
   * Ambient AWS credentials are not a statement of intent, and this is not hypothetical: the
   * container this was written in exports `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` for
   * unrelated reasons. An earlier version of this resolver counted them, and every pre-existing
   * integration test refused to start over a bucket nobody had configured.
   */
  it('ignores ambient AWS credentials when no bucket or endpoint is named', () => {
    const resolution = resolve({
      NODE_ENV: 'development',
      AWS_ACCESS_KEY_ID: KEY,
      AWS_SECRET_ACCESS_KEY: SECRET,
      AWS_REGION: 'ap-southeast-2',
    });
    expect(resolution.kind).toBe('local');
  });

  it('still refuses ambient credentials with no bucket in a deployed environment', () => {
    // Nothing to fall back to, so this is the deployed refusal rather than a partial one.
    expect(() =>
      resolve({ NODE_ENV: 'production', AWS_ACCESS_KEY_ID: KEY, AWS_SECRET_ACCESS_KEY: SECRET }),
    ).toThrow(StorageConfigError);
  });

  it.each(['AWS_ENDPOINT_URL_S3', 'BUCKET_NAME'])(
    'treats %s as a selection, so credentials become mandatory',
    (selector) => {
      expect(() => resolve({ NODE_ENV: 'development', [selector]: 'something' })).toThrow(
        /partially configured/,
      );
    },
  );
});

describe('refusals', () => {
  const secrets = [KEY, SECRET];

  it('never quote a credential', () => {
    const broken: NodeJS.ProcessEnv[] = [
      { ...full(), BUCKET_NAME: '' },
      { ...full(), AWS_ENDPOINT_URL_S3: 'not-a-url' },
      { NODE_ENV: 'production' },
      { NODE_ENV: 'production', AWS_ACCESS_KEY_ID: KEY },
    ];

    for (const env of broken) {
      let message = '';
      try {
        resolve(env);
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).not.toBe('');
      for (const secret of secrets) {
        expect(message).not.toContain(secret);
      }
    }
  });

  it('are a named error type, so a caller can tell configuration from a network fault', () => {
    try {
      resolve({ NODE_ENV: 'production' });
    } catch (error) {
      expect(error).toBeInstanceOf(StorageConfigError);
      expect((error as Error).name).toBe('StorageConfigError');
    }
  });
});
