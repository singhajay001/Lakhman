import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { logger } from '@spirithaus/observability';
import type { S3StorageConfig } from './storage-config.js';
import type { Storage } from './storage.js';

/**
 * Object storage over the S3 API, which is how Tigris is reached on Fly.
 *
 * Holds the same two-method contract as the local store, including the part that matters most:
 * `get` returns null for an object that is not there, and throws for everything else. Collapsing
 * a permission error into "missing" is how a misconfigured bucket becomes a composite that
 * refuses with the wrong reason — and the composite handler treats a missing environment plate as
 * a terminal refusal rather than a retryable fault, so that mistake would be recorded as the
 * pipeline working correctly.
 */

/**
 * A storage failure, with the SDK's error kept out of it.
 *
 * SDK errors carry `$metadata`, the signed request and sometimes the full URL including query
 * parameters. None of that belongs in a log or in a job row's error column, both of which are
 * read by people who should not be handed request-signing material. Only the error name, an
 * HTTP status and the key survive.
 */
export class StorageError extends Error {
  override readonly name = 'StorageError';
  override readonly cause: { kind: string; status: number | undefined };

  constructor(operation: string, key: string, kind: string, status: number | undefined) {
    super(
      `object storage ${operation} failed for ${key}: ${kind}${status === undefined ? '' : ` (HTTP ${status})`}`,
    );
    this.cause = { kind, status };
  }
}

/**
 * The only two codes that mean "this object is not here": `NoSuchKey` from GetObject and
 * `NotFound` from HeadObject.
 *
 * Matched on the code and never on the status, because `NoSuchBucket` is a 404 too. Treating any
 * 404 as absence — which an earlier version of this file did, until a test caught it — turns a
 * wrong bucket name into "the object does not exist", and the composite handler records that as a
 * terminal refusal. The bucket would be misconfigured and the job row would blame the artwork.
 *
 * A 404 whose code is neither of these is therefore a failure rather than absence. That is the
 * conservative direction: an unrecognised error stops the job instead of silently emptying the
 * store.
 */
const MISSING = new Set(['NoSuchKey', 'NotFound']);

interface SdkErrorShape {
  name?: unknown;
  $metadata?: { httpStatusCode?: unknown };
}

function describe(error: unknown): { kind: string; status: number | undefined } {
  const shaped = error as SdkErrorShape;
  const kind = typeof shaped?.name === 'string' && shaped.name ? shaped.name : 'UnknownError';
  const raw = shaped?.$metadata?.httpStatusCode;
  return { kind, status: typeof raw === 'number' ? raw : undefined };
}

export class S3Storage implements Storage {
  readonly local = false;
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: S3StorageConfig) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      // Path-style, because the endpoint is a fixed host rather than a zone the SDK can
      // build a bucket subdomain under. Asserted in a test against a server that only
      // answers path-style requests.
      forcePathStyle: config.forcePathStyle,
      // Supplied explicitly rather than left to the default provider chain. The chain would
      // reach for instance metadata and shared credential files, which on a misconfigured
      // machine turns a missing variable into a slow timeout against a link-local address.
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      // Bounded. The pipeline is already behind a queue with its own retry and backoff, so a
      // client that retried at length would stack two retry policies and hold a worker slot.
      maxAttempts: 3,
    });
  }

  /** Where this instance writes. Not a secret, and the property a cross-process test asserts on. */
  get target(): { endpoint: string; bucket: string; region: string } {
    return { endpoint: this.config.endpoint, bucket: this.bucket, region: this.config.region };
  }

  async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          // Passed through as given. Wrapping it in a Buffer would copy a master that can be
          // several megabytes, for nothing: the SDK accepts a Uint8Array body directly.
          Body: bytes,
          ContentType: contentType,
          ContentLength: bytes.byteLength,
          // No ACL. Buckets stay private, and an object-level public-read grant would make a
          // protected product master world-readable regardless of the bucket's own policy.
        }),
      );
    } catch (error) {
      const { kind, status } = describe(error);
      logger.error({ bucket: this.bucket, key, kind, status }, 'object storage put failed');
      throw new StorageError('put', key, kind, status);
    }
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!response.Body) return null;
      // One allocation, sized from the response. Reading into a string first — or concatenating
      // chunks — would both copy and, for a string, corrupt the bytes.
      return await response.Body.transformToByteArray();
    } catch (error) {
      const { kind, status } = describe(error);

      // Absent is a legitimate answer and the local store gives it too.
      if (MISSING.has(kind)) return null;

      // Everything else is a real failure and must not masquerade as absence. A 403 here means
      // the credentials or the bucket policy are wrong, and the caller needs to know that
      // rather than be told the object does not exist.
      logger.error({ bucket: this.bucket, key, kind, status }, 'object storage get failed');
      throw new StorageError('get', key, kind, status);
    }
  }

  /** Releases the underlying sockets. Tests construct clients per case; processes do not. */
  destroy(): void {
    this.client.destroy();
  }
}
