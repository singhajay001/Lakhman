import type { LoaderFunctionArgs } from 'react-router';
import { childLogger } from '@spirithaus/observability';
import { authenticate } from '../shopify.server.js';
import { preflightBody, preflightCallback } from '../lib/oauth-preflight.server.js';

/**
 * The OAuth callback, `<SHOPIFY_APP_URL>/auth/shopify/callback`.
 *
 * The library does the exchange. What this route adds is a diagnosis when the exchange cannot
 * happen, because the two most common reasons — a secret that belongs to a different app, and a
 * redirect URL that was never registered — both surface as an opaque 500 with a stack trace that
 * names neither.
 *
 * The preflight runs first and in order, so a signature mismatch is never reported for a request
 * that was malformed or for an app that has no secret to check against. Nothing it returns
 * echoes a secret, and the detailed remedy is withheld in production: an endpoint that tells an
 * anonymous caller which environment variables are unset is reconnaissance, however useful it is
 * on a developer's machine.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const log = childLogger({ part: 'oauth-callback' });
  const url = new URL(request.url);

  const preflight = preflightCallback(url);
  if (!preflight.ok) {
    const { failure } = preflight;
    // Logged in full regardless of environment, so an operator can diagnose a production
    // failure that the response deliberately does not describe.
    log.warn(
      { code: failure.code, shop: url.searchParams.get('shop'), remedy: failure.remedy },
      `OAuth callback rejected before the token exchange: ${failure.summary}`,
    );

    return new Response(JSON.stringify(preflightBody(failure), null, 2), {
      // 400 for a request this app will never accept; 500 for one it cannot answer because it
      // is not configured. The difference matters to whoever is holding the pager.
      status: failure.code === 'missing_configuration' ? 500 : 400,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }

  try {
    // Throws a redirect on success, which is the response.
    await authenticate.admin(request);
    return null;
  } catch (thrown) {
    // A Response is the library's way of returning: a redirect into the Admin, or its own error.
    // Passing it through is correct; swallowing it would break the install.
    if (thrown instanceof Response) throw thrown;

    const message = thrown instanceof Error ? thrown.message : String(thrown);
    log.error(
      { shop: url.searchParams.get('shop'), error: message },
      'the token exchange failed after preflight passed',
    );

    return new Response(
      JSON.stringify(
        {
          error: 'token_exchange_failed',
          message:
            'The callback was well formed and correctly signed, but the token exchange did not complete.',
          ...(process.env.NODE_ENV === 'production'
            ? {
                detail:
                  'Diagnostics are withheld in production. The server log has the full reason.',
              }
            : {
                detail: message,
                remedy: [
                  `Check that this exact URL is registered under "Allowed redirection URL(s)" in the Partner Dashboard: ${process.env.SHOPIFY_APP_URL ?? '<SHOPIFY_APP_URL>'}/auth/shopify/callback`,
                  'Confirm the app can reach *.myshopify.com. Where the network refuses that host, the exchange cannot complete from here at all, and the failure is the egress policy rather than the app.',
                  'Confirm the requested scopes match the app configuration; a scope the app is not approved for fails the exchange.',
                ],
              }),
        },
        null,
        2,
      ),
      { status: 502, headers: { 'content-type': 'application/json; charset=utf-8' } },
    );
  }
}
