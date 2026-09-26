import { Writable } from 'node:stream';
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { REDACTED_PATHS } from './logger.js';

/**
 * Redaction is declared centrally because, as the logger's own comment says, a log line is written
 * by whoever is in a hurry. These tests hold that promise to the keys that actually exist in this
 * system — several of which were missing: `refreshToken` was absent while `accessToken` was
 * present, which is backwards, since a refresh token mints access tokens. The object-storage
 * credentials and the credential-bearing connection strings were absent too.
 *
 * Built against a real pino instance with the same redact configuration, writing to a buffer, so
 * this tests pino's behaviour rather than a reimplementation of it.
 */
const captured = (): { lines: string[]; log: pino.Logger } => {
  const lines: string[] = [];
  const sink = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(String(chunk));
      callback();
    },
  });
  return {
    lines,
    log: pino({ redact: { paths: [...REDACTED_PATHS], censor: '[redacted]' } }, sink),
  };
};

const SENTINEL = 'SUPER-SECRET-SENTINEL-VALUE';

describe('log redaction', () => {
  it.each([
    'accessToken',
    'refreshToken',
    'token',
    'password',
    'secret',
    'apiKey',
    'authorization',
    'secretAccessKey',
    'accessKeyId',
    'redisUrl',
    'databaseUrl',
    'connectionString',
    'signedUrl',
    'presignedUrl',
  ])('censors %s at the top level', (key) => {
    const { lines, log } = captured();
    log.info({ [key]: SENTINEL }, 'test');
    expect(lines.join('')).not.toContain(SENTINEL);
    expect(lines.join('')).toContain('[redacted]');
  });

  it.each(['accessToken', 'refreshToken', 'secretAccessKey', 'redisUrl'])(
    'censors %s one level down, where a session or config object puts it',
    (key) => {
      const { lines, log } = captured();
      log.info({ session: { [key]: SENTINEL } }, 'test');
      expect(lines.join('')).not.toContain(SENTINEL);
    },
  );

  it('censors a whole session object rather than leaking either credential', () => {
    const { lines, log } = captured();
    log.error(
      {
        session: {
          id: 'sess_1',
          shop: 'x.myshopify.com',
          accessToken: SENTINEL,
          refreshToken: SENTINEL,
        },
      },
      'could not open a stored session credential',
    );
    const out = lines.join('');
    expect(out).not.toContain(SENTINEL);
    // The non-secret context survives, which is the point of redacting rather than dropping.
    expect(out).toContain('sess_1');
    expect(out).toContain('x.myshopify.com');
  });

  it('leaves a bare url alone, because ingestion legitimately logs product image URLs', () => {
    const { lines, log } = captured();
    log.info({ url: 'https://cdn.shopify.com/s/files/1/bottle.png' }, 'ingesting');
    expect(lines.join('')).toContain('cdn.shopify.com');
  });

  it('keeps the storage fields an operator needs during an incident', () => {
    const { lines, log } = captured();
    log.info(
      {
        endpoint: 'https://fly.storage.tigris.dev',
        bucket: 'spirithaus-staging-media',
        region: 'auto',
      },
      'object storage configured',
    );
    const out = lines.join('');
    // "Which bucket did this machine write to" is the first question of a storage incident.
    expect(out).toContain('fly.storage.tigris.dev');
    expect(out).toContain('spirithaus-staging-media');
  });
});
