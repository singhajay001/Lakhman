import pino from 'pino';

export type LogContext = Record<string, unknown>;

/**
 * What never reaches a log line.
 *
 * Declared here rather than left to call sites: section 33 requires secrets out of logs, and a log
 * line is written by whoever is in a hurry. Exported so the tests assert against the configuration
 * the logger actually uses rather than a copy of it that can drift.
 */
export const REDACTED_PATHS = [
  'accessToken',
  '*.accessToken',
  // A refresh token mints access tokens, so it is the more valuable of the pair. It was
  // missing from this list while `accessToken` was present, which is the wrong way round.
  'refreshToken',
  '*.refreshToken',
  'token',
  '*.token',
  'authorization',
  '*.authorization',
  'apiKey',
  '*.apiKey',
  'password',
  '*.password',
  'secret',
  '*.secret',
  // Object storage (ADR 0015). The adapter is careful never to log these and `StorageError`
  // excludes the signed request — but this list exists precisely because, as below, a log
  // line is written by whoever is in a hurry.
  'secretAccessKey',
  '*.secretAccessKey',
  'accessKeyId',
  '*.accessKeyId',
  // Connection strings carry their credentials inline: REDIS_URL is `rediss://user:pass@host`
  // and DATABASE_URL is the same shape. Named keys only — a bare `url` would redact the
  // product-image URLs that ingestion legitimately logs.
  'redisUrl',
  '*.redisUrl',
  'databaseUrl',
  '*.databaseUrl',
  'connectionString',
  '*.connectionString',
  'signedUrl',
  '*.signedUrl',
  'presignedUrl',
  '*.presignedUrl',
  'req.headers.authorization',
  'req.headers.cookie',
  'email',
  '*.email',
] as const;

/** Structured JSON logs (section 37). */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: { paths: [...REDACTED_PATHS], censor: '[redacted]' },
  formatters: { level: (label) => ({ level: label }) },
});

export function childLogger(context: LogContext) {
  return logger.child(context);
}
