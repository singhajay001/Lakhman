# Shopify Partner and development store runbook

Exact steps, using this repository's actual configuration. **No step below has been performed** —
OAuth has never run, no session has ever been stored, and nobody has seen the embedded dashboard.
Expect findings.

## 1. Create a development store

Partner Dashboard → Stores → Add store → **Development store**. Use a store created for this
purpose. Do not point staging at the live shop: production customer and order data is outside the
current authorisation.

## 2. Configure the app

Partner Dashboard → Apps → your app → Configuration.

| Setting | Value | Why it matters |
| --- | --- | --- |
| App URL | `<SHOPIFY_APP_URL>` | The origin the app is served from, no trailing slash. |
| Allowed redirection URL | `<SHOPIFY_APP_URL>/auth/shopify/callback` | **Byte for byte, scheme included.** A mismatch fails the install at the last step, and the error names nothing. |
| Embedded app | Enabled | React Router apps from `@shopify/shopify-app-react-router` are embedded by default; `isEmbeddedApp` is rejected as an option. |

The callback path comes from `authPathPrefix: '/auth/shopify'` in
`apps/social-studio/app/shopify.server.ts`. That one setting also derives the login,
session-token and exit-iframe paths, so they move as a set — do not change it in one place.

### Scopes

Mandatory, requested at install (`packages/shopify/src/scopes.ts` records the reason for each):

| Scope | Feature that stops without it |
| --- | --- |
| `read_products` | Product truth — the mirror every campaign is built from |
| `read_inventory` | Stock safety and contribution margin |
| `read_orders` | Revenue-first attribution |
| `write_pixels` | First-party attribution |
| `read_customer_events` | First-party attribution |
| `read_marketing_events` | Reading existing Shopify marketing activities, so campaigns are not duplicated |
| `write_marketing_events` | Recording campaigns as marketing activities |

Optional, request only with the feature:

| Scope | Feature |
| --- | --- |
| `read_customers` | Audience segments |
| `read_all_orders` | Attribution and forecasting beyond 60 days |
| `write_discounts` | Offer-code attribution |
| `read_files` | Reusing Shopify-hosted media |
| `read_publications` | Preflight sales-channel check |

**No write access to merchant data is requested** — no `write_products`, `write_inventory`,
`write_orders`, `write_customers`, `write_themes`. Product data is truth, not output. The Settings
screen lists every scope with its reason and the ones deliberately refused; that screen is the
answer if a review asks.

### Webhooks

Registered by the app. Endpoints:

| Topic | Endpoint |
| --- | --- |
| `app/uninstalled`, `shop/update` | `<SHOPIFY_APP_URL>/webhooks/app` |
| `products/create`, `products/update`, `products/delete`, `collections/update` | `<SHOPIFY_APP_URL>/webhooks/catalogue` |
| `inventory_levels/update` | `<SHOPIFY_APP_URL>/webhooks/inventory` |
| `customers/data_request`, `customers/redact`, `shop/redact` | `<SHOPIFY_APP_URL>/webhooks/privacy` |

The three privacy topics are mandatory for any public app.

## 3. Install

Open `<SHOPIFY_APP_URL>/auth/shopify/login`, enter the development store domain, approve the
scopes.

### What should happen

1. Redirect to Shopify's consent screen listing the seven mandatory scopes.
2. Redirect back to `/auth/shopify/callback` with `shop`, `hmac`, `code`, `state`, `timestamp`.
3. The route's preflight checks configuration, parameters, shop domain and signature **in that
   order**, so a signature mismatch is never reported for a request that was malformed.
4. The library exchanges the code and stores the session.
5. Redirect into the embedded app inside Shopify Admin.

### Confirm the session persisted

```sql
SELECT id, shop, "isOnline", scope, expires FROM session WHERE shop = '<store>.myshopify.com';
```

Expect **two** rows: an online session (expires within a day, carries the staff identity) and an
offline session (no expiry, what the worker runs as). One row means something is wrong — the
worker needs the offline one.

Never `SELECT accessToken`, and never paste a row into a ticket. See
[`session-security.md`](session-security.md).

## 4. Verify the embedded dashboard

Shopify Admin → Apps → your app.

**Nobody has ever seen these screens.** App Bridge loads from `cdn.shopify.com`, which the
development environment refused, so every `/app/*` route has been exercised only by its loader and
its tests. Budget real time here.

What you are looking at is **Shopify Polaris inside Shopify Admin's own frame** — the app uses
Polaris 13 with React 18, and there is no custom theme. If something looks unstyled, Polaris CSS
did not load rather than a theme being wrong.

Check: the frame renders without a full-page reload loop; navigation between sections keeps the
session; the Settings screen lists scopes; the Media Studio loads with no assets and says so.

## 5. Uninstall and reinstall

Uninstall from Shopify Admin → Apps. The `app/uninstalled` webhook deletes every session for the
shop, marks the shop uninstalled and disables provider configuration, inside an audited handler.
Confirm:

```sql
SELECT count(*) FROM session WHERE shop = '<store>.myshopify.com';   -- expect 0
SELECT domain, "uninstalledAt" FROM shop WHERE domain = '<store>.myshopify.com';
```

Audit history and campaign records stay — section 31: the record of what was published is not a
credential and is not deleted.

Reinstalling issues fresh tokens. It does not restore the old ones.

## 6. Common failures

| Symptom | Cause |
| --- | --- |
| `signature_mismatch` | `SHOPIFY_API_SECRET` belongs to a different app than the install started from. Also what a replayed or hand-edited callback looks like. |
| `missing_configuration` | An environment variable is unset; the response names which, outside production. |
| `invalid_shop_domain` | The `shop` parameter is not `*.myshopify.com`. A custom storefront domain is not the shop domain. |
| `token_exchange_failed` | Well-formed, correctly signed, exchange did not complete. Check the redirect URI matches exactly and that the host can reach `*.myshopify.com`. |
| `missing_parameters` | Someone opened the callback URL in a browser. Not an error. |
| App frame blank | App Bridge could not load from `cdn.shopify.com`. |
| Sync sits `UNREACHABLE` | No offline session, or the Admin host is refused. Not a failure — nothing was attempted. |

## 7. Evidence to capture, redacted

For each step: what was attempted, expected result, actual result, and the evidence — with these
rules:

- **Never** capture `accessToken`, `state`, or a full callback URL (it carries `code` and `hmac`).
- Do capture: the Shopify API version, the `x-request-id` of any Admin call, the granted scopes,
  rate-limit information from the response, and log lines with their redaction intact.
- Screenshots of the embedded dashboard are fine; crop the browser URL bar during OAuth.
- Record the timestamp so a log line can be found later.
