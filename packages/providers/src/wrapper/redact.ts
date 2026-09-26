import { err, ok, type Result } from '@spirithaus/domain';

/**
 * Section 33: customer personal data, credentials and confidential Shopify data
 * are not sent to AI providers. This is the enforcement, not the guideline — every
 * provider payload passes through it.
 *
 * It fails closed. A value whose shape it cannot inspect is refused rather than
 * forwarded, because "I did not recognise it so I sent it" is how a payload leaks.
 */
const PII_KEYS = new Set(
  [
    'email',
    'emailaddress',
    'phone',
    'phonenumber',
    'firstname',
    'lastname',
    'fullname',
    'customername',
    'address',
    'address1',
    'address2',
    'street',
    'postcode',
    'zip',
    'dateofbirth',
    'dob',
    'ip',
    'ipaddress',
    'accesstoken',
    'token',
    'apikey',
    'password',
    'secret',
    'authorization',
    'customerid',
    'cardnumber',
  ].map((k) => k.toLowerCase()),
);

export interface RedactionReport {
  removed: string[];
}

export type RedactionResult = Result<{ payload: unknown; report: RedactionReport }, string>;

export function redactForProvider(payload: unknown): RedactionResult {
  const removed: string[] = [];
  const walk = (value: unknown, path: string): Result<unknown, string> => {
    if (value === null || value === undefined) return ok(value);

    const kind = typeof value;
    if (kind === 'string' || kind === 'number' || kind === 'boolean') return ok(value);
    if (kind === 'bigint') return ok(value.toString());
    if (kind === 'function' || kind === 'symbol') {
      return err(`refusing to send a ${kind} to a provider at ${path || 'root'}`);
    }

    if (value instanceof Uint8Array) return ok(value);
    if (value instanceof Date) return ok(value.toISOString());

    if (Array.isArray(value)) {
      const out: unknown[] = [];
      for (const [index, item] of value.entries()) {
        const walked = walk(item, `${path}[${index}]`);
        if (!walked.ok) return walked;
        out.push(walked.value);
      }
      return ok(out);
    }

    // Plain objects only. A class instance may carry getters, and we cannot know
    // what they read.
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      return err(
        `refusing to send a non-plain object (${proto?.constructor?.name ?? 'unknown'}) to a provider at ${path || 'root'}`,
      );
    }

    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (PII_KEYS.has(key.toLowerCase())) {
        removed.push(path ? `${path}.${key}` : key);
        continue;
      }
      const walked = walk(item, path ? `${path}.${key}` : key);
      if (!walked.ok) return walked;
      out[key] = walked.value;
    }
    return ok(out);
  };

  const walked = walk(payload, '');
  if (!walked.ok) return err(walked.error);
  return ok({ payload: walked.value, report: { removed } });
}
