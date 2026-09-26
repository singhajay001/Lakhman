import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Webhook verification (sections 7 and 33). Verified against the *raw* body, before
 * it is parsed: JSON.parse then re-stringify does not round-trip byte-for-byte, and a
 * signature checked against a re-serialised body is a signature that can be forged
 * around.
 *
 * Constant-time comparison, so a wrong signature does not leak how wrong it was.
 */
export function verifyWebhookHmac(
  rawBody: string | Uint8Array,
  headerValue: string | null | undefined,
  secret: string,
): boolean {
  if (!headerValue || secret.length === 0) return false;

  const expected = createHmac('sha256', secret)
    .update(typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : Buffer.from(rawBody))
    .digest();

  let provided: Buffer;
  try {
    provided = Buffer.from(headerValue, 'base64');
  } catch {
    return false;
  }

  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

/**
 * OAuth and App Proxy requests sign a query string instead: the hmac parameter is
 * removed, the rest sorted, and the result signed with hex output.
 */
export function verifyQueryHmac(query: URLSearchParams, secret: string): boolean {
  const provided = query.get('hmac');
  if (!provided || secret.length === 0) return false;

  const pairs: string[] = [];
  for (const [key, value] of [...query.entries()].sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  )) {
    if (key === 'hmac' || key === 'signature') continue;
    pairs.push(`${key}=${value}`);
  }

  const expected = createHmac('sha256', secret).update(pairs.join('&'), 'utf8').digest('hex');
  const providedBuffer = Buffer.from(provided, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}
