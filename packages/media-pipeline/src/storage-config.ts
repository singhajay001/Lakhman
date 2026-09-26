import { logger } from '@spirithaus/observability';

/**
 * Which object store this process is allowed to use, decided once at startup.
 *
 * The rule is the same one session encryption uses: anything that is not plainly a developer's
 * machine must have real object storage, or the process does not start. The failure this prevents
 * is specific and was real until this file existed — `storage()` fell back to a local directory
 * unconditionally, so on Fly the web machine wrote an environment plate to its own `/tmp` and the
 * worker machine looked for it in a different `/tmp` and found nothing. Every composite failed,
 * and it failed at the point of use rather than at startup.
 *
 * A local fallback in a deployed environment is worse than no storage at all: it looks like it
 * works, writes succeed, and only the read from the other machine fails.
 */

/** Refused configuration. Never carries a key, a secret or a signed request. */
export class StorageConfigError extends Error {
  override readonly name = 'StorageConfigError';
}

export interface S3StorageConfig {
  accessKeyId: string;
  secretAccessKey: string;
  /** Full URL, e.g. https://fly.storage.tigris.dev */
  endpoint: string;
  /** Tigris uses `auto`; so does every other S3-compatible store that routes for you. */
  region: string;
  bucket: string;
  /**
   * Path-style addressing (`<endpoint>/<bucket>/<key>`) rather than virtual-host style
   * (`<bucket>.<endpoint>/<key>`). Required for a custom endpoint: the SDK's default would
   * resolve a hostname that does not exist, and the failure arrives as DNS rather than as
   * configuration.
   */
  forcePathStyle: boolean;
}

export type StorageResolution =
  { kind: 's3'; config: S3StorageConfig } | { kind: 'local'; root: string };

/** `NODE_ENV` values that are a developer's machine or a test run, and nothing else. */
const UNDEPLOYED = new Set(['development', 'test']);

/**
 * The variables that say *which* object store this deployment uses. Their presence is what is
 * read as "use S3", and Fly's Tigris integration sets both.
 *
 * The distinction between these and the credentials below is not cosmetic, and getting it wrong
 * cost a round of red tests. `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and `AWS_REGION` are
 * **ambient** on a great many machines — CI runners, developer laptops, any container whose image
 * ships an AWS profile. Treating a credential as a statement of intent means an unrelated machine
 * that happens to export one refuses to start over a bucket nobody configured. A bucket name and a
 * custom endpoint are never ambient: nothing sets those by accident.
 */
const SELECTORS = ['AWS_ENDPOINT_URL_S3', 'BUCKET_NAME'] as const;

/** Needed once a store has been selected, but never a signal on their own. */
const CREDENTIALS = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'] as const;

const REQUIRED = [...SELECTORS, ...CREDENTIALS] as const;

export const DEFAULT_REGION = 'auto';
export const DEFAULT_LOCAL_ROOT = '/tmp/spirithaus-media';

export interface ResolveOptions {
  env?: NodeJS.ProcessEnv;
  /** Named for the log line, so a refusal says which process refused. */
  component: string;
}

/**
 * Decides between S3 and local storage, or refuses.
 *
 * Three outcomes, and no fourth:
 *
 * - A store is selected and fully configured → S3.
 * - No store selected, undeployed → local, with a warning.
 * - Anything else → `StorageConfigError`. That covers a half-set configuration in any
 *   environment, and no configuration at all in a deployed one.
 *
 * A store counts as *selected* when either selector is set. Ambient AWS credentials alone never
 * select one, so a machine that exports them for unrelated reasons is unaffected.
 */
export function resolveStorageConfig(options: ResolveOptions): StorageResolution {
  const env = options.env ?? process.env;
  const nodeEnv = env.NODE_ENV ?? 'development';
  const deployed = !UNDEPLOYED.has(nodeEnv);
  const set = (name: string): boolean => (env[name] ?? '').trim() !== '';

  const selected = SELECTORS.some(set);

  // Half a configuration is never a fallback. Someone named a bucket on purpose, and quietly
  // writing to /tmp instead would hide the typo until a read from another machine.
  if (selected) {
    const missing = REQUIRED.filter((name) => !set(name));
    if (missing.length > 0) {
      throw new StorageConfigError(
        `Object storage is partially configured: ${SELECTORS.filter(set).join(' and ')} names a bucket, but ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} not set. Set all of ${REQUIRED.join(', ')}, or none of them.`,
      );
    }
  }

  if (!selected) {
    if (deployed) {
      throw new StorageConfigError(
        `Object storage is not configured and NODE_ENV=${nodeEnv}. A deployed deployment runs the web and worker processes on separate machines with separate filesystems, so a local directory is not shared storage — the worker would not find what the web process wrote. Set ${REQUIRED.join(', ')}.`,
      );
    }

    const root = (env.MEDIA_STORE_DIR ?? '').trim() || DEFAULT_LOCAL_ROOT;
    logger.warn(
      { component: options.component, nodeEnv, root },
      'no object storage is configured; media is written to a local directory and will not survive this machine or be visible to another process. Development and test only.',
    );
    return { kind: 'local', root };
  }

  const endpoint = (env.AWS_ENDPOINT_URL_S3 ?? '').trim();
  // Checked here rather than at first use: an endpoint that is not a URL fails inside the SDK
  // with a message about the request, which reads as a network fault rather than a typo.
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('not http(s)');
    }
  } catch {
    throw new StorageConfigError(
      `AWS_ENDPOINT_URL_S3 is not a valid http(s) URL. Fly's Tigris integration sets it to https://fly.storage.tigris.dev.`,
    );
  }

  const config: S3StorageConfig = {
    accessKeyId: (env.AWS_ACCESS_KEY_ID ?? '').trim(),
    secretAccessKey: (env.AWS_SECRET_ACCESS_KEY ?? '').trim(),
    endpoint,
    region: (env.AWS_REGION ?? '').trim() || DEFAULT_REGION,
    bucket: (env.BUCKET_NAME ?? '').trim(),
    forcePathStyle: true,
  };

  // The bucket and endpoint are not secrets and are worth having in the log: "which bucket did
  // this machine write to" is the first question of any storage incident. The credentials are
  // never logged, here or anywhere.
  logger.info(
    {
      component: options.component,
      endpoint: config.endpoint,
      bucket: config.bucket,
      region: config.region,
    },
    'object storage configured',
  );

  return { kind: 's3', config };
}

/**
 * Validates configuration and throws, without building a client.
 *
 * Called at startup by every process that reads or writes media, so a missing bucket stops the
 * process rather than surfacing on the first composite.
 */
export function assertStorageConfigured(options: ResolveOptions): StorageResolution {
  try {
    return resolveStorageConfig(options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ component: options.component }, `refusing to start: ${message}`);
    throw error;
  }
}
