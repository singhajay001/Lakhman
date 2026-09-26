import { verifyQueryHmac } from '@spirithaus/shopify';

/**
 * What has to be true before an OAuth callback can possibly succeed, checked in order.
 *
 * The point is the diagnosis. Shopify's own failure for a missing `SHOPIFY_API_SECRET` and for
 * a tampered request look alike from the outside, and both land as a 500 with a stack trace that
 * names neither. Each check below names the one thing to change and where to change it.
 *
 * Two rules the checks obey, because this endpoint is reachable by anyone who knows the URL:
 *
 * - **Nothing echoes a secret.** Not the value, not a prefix, not its length. Configuration
 *   checks report presence only.
 * - **Detail is for developers, not the internet.** The full diagnosis is returned only outside
 *   production; in production the response says a check failed and the log carries the rest.
 *   A public endpoint that reports which environment variables are unset is reconnaissance.
 */

export type PreflightCode =
  'missing_configuration' | 'missing_parameters' | 'invalid_shop_domain' | 'signature_mismatch';

export interface PreflightFailure {
  code: PreflightCode;
  /** One sentence on what is wrong. Safe to show anywhere. */
  summary: string;
  /** What to change, and where. Withheld from the response in production. */
  remedy: string[];
}

export type PreflightResult = { ok: true } | { ok: false; failure: PreflightFailure };

/** Shopify shop domains only. Anything else is a redirect to somewhere we do not control. */
const SHOP_DOMAIN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;

const REQUIRED_VARIABLES = ['SHOPIFY_API_KEY', 'SHOPIFY_API_SECRET', 'SHOPIFY_APP_URL'] as const;

export function preflightCallback(url: URL, env: NodeJS.ProcessEnv = process.env): PreflightResult {
  const missing = REQUIRED_VARIABLES.filter((name) => {
    const value = env[name];
    return value === undefined || value.length === 0;
  });

  if (missing.length > 0) {
    return {
      ok: false,
      failure: {
        code: 'missing_configuration',
        summary: `The app is not configured to complete OAuth: ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} not set.`,
        remedy: [
          'Copy .env.example to .env and fill in the values from your Shopify Partner app.',
          'SHOPIFY_API_KEY and SHOPIFY_API_SECRET are on the app\'s Overview page in the Partner Dashboard, under "Client credentials".',
          'SHOPIFY_APP_URL is the public origin this app is served from, with no trailing slash.',
          `Add ${env.SHOPIFY_APP_URL ?? '<SHOPIFY_APP_URL>'}/auth/shopify/callback to "Allowed redirection URL(s)" in the Partner Dashboard under Configuration. It must match byte for byte, including the scheme.`,
          'Restart the server after changing .env: these are read once at startup.',
        ],
      },
    };
  }

  const shop = url.searchParams.get('shop');
  const missingParameters = ['shop', 'hmac', 'code'].filter((name) => !url.searchParams.get(name));
  if (missingParameters.length > 0) {
    return {
      ok: false,
      failure: {
        code: 'missing_parameters',
        summary: `This request is missing ${missingParameters.join(', ')}, so it is not an OAuth callback.`,
        remedy: [
          'Shopify sends shop, hmac, code, state and timestamp to this URL. Opening it directly in a browser will always fail this check.',
          'To start an install, go to /auth/shopify/login and enter the shop domain.',
        ],
      },
    };
  }

  if (!shop || !SHOP_DOMAIN.test(shop)) {
    return {
      ok: false,
      failure: {
        code: 'invalid_shop_domain',
        summary: 'The shop parameter is not a myshopify.com domain.',
        remedy: [
          'Only *.myshopify.com domains are accepted here. A custom storefront domain is not the shop domain OAuth uses.',
        ],
      },
    };
  }

  // Checked last, so a signature mismatch is never reported for a request that was malformed or
  // for an app that has no secret to check it against.
  const secret = env.SHOPIFY_API_SECRET as string;
  if (!verifyQueryHmac(url.searchParams, secret)) {
    return {
      ok: false,
      failure: {
        code: 'signature_mismatch',
        summary: 'The callback signature did not verify.',
        remedy: [
          'The usual cause is that SHOPIFY_API_SECRET belongs to a different app than the one that started this install. Check it against the Partner Dashboard entry for this exact app.',
          'It is also what a replayed or hand-edited callback URL looks like. Start the install again from /auth/shopify/login rather than reusing a URL.',
          'If the app was recently rotated, the old secret keeps verifying nothing. Update .env and restart.',
        ],
      },
    };
  }

  return { ok: true };
}

/**
 * The failure as a response body.
 *
 * `remedy` is included outside production only. In production the caller gets the summary and
 * the code; the server log keeps the rest, so an operator can still diagnose it without the
 * endpoint telling an anonymous caller which variables are unset.
 */
export function preflightBody(
  failure: PreflightFailure,
  nodeEnv = process.env.NODE_ENV,
): Record<string, unknown> {
  const production = nodeEnv === 'production';
  return {
    error: failure.code,
    message: failure.summary,
    ...(production
      ? { detail: 'Diagnostics are withheld in production. The server log has the full reason.' }
      : { remedy: failure.remedy, documentation: 'docs/adr/0012-defensive-admin-integration.md' }),
  };
}
