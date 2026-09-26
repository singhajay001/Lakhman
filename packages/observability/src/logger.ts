import pino from 'pino';

export type LogContext = Record<string, unknown>;

/**
 * Structured JSON logs (section 37). Redaction is declared here rather than left to
 * call sites: section 33 requires secrets out of logs, and a log line is written by
 * whoever is in a hurry.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'accessToken',
      '*.accessToken',
      'token',
      '*.token',
      'authorization',
      '*.authorization',
      'apiKey',
      '*.apiKey',
      'password',
      '*.password',
      'req.headers.authorization',
      'req.headers.cookie',
      'email',
      '*.email',
    ],
    censor: '[redacted]',
  },
  formatters: { level: (label) => ({ level: label }) },
});

export function childLogger(context: LogContext) {
  return logger.child(context);
}
