# Configuration

Everything the app reads, what breaks without it, and the settings outside the repository that
have to agree with it.

## Environment variables

`.env.example` is the canonical list and carries a comment per variable. This table says which
ones are load-bearing and what happens when they are wrong.

### Refused at startup

The app will not start without these, deliberately: a missing credential should be a startup
failure, not a 500 halfway through an OAuth callback.

| Variable | Notes |
| --- | --- |
| `SHOPIFY_API_KEY` | Partner Dashboard → your app → Overview → Client credentials. |
| `SHOPIFY_API_SECRET` | Same place. Never committed, never logged, never echoed by an error page — not even its length. |
| `SHOPIFY_APP_URL` | The public origin the app is served from, no trailing slash. Shopify builds the redirect URI from it, so it must match the Partner Dashboard exactly, scheme included. |
| `DATABASE_URL` | Read at module load by the Prisma client. A worker or script without it throws on import, before any handler runs. |

### Needed in any real deployment

| Variable | Default | What happens without it |
| --- | --- | --- |
| `REDIS_URL` | — | The app falls back to an in-memory queue **and says so**; the worker refuses to start at all, because a worker with no queue would look healthy while doing nothing. In staging this means scheduled work silently does not happen unless Redis is configured. |
| `SHOPIFY_API_VERSION` | `2025-07` | Pinned on purpose. An unpinned client changes behaviour without a deploy. |
| `NODE_ENV` | `development` | `production` withholds developer diagnostics from the OAuth callback's error responses. Set it. |
| `LOG_LEVEL` | `info` | `silent` in tests. Leave at `info` or `warn` in staging; the diagnostics this system relies on are logged, not displayed. |
| `MEDIA_STORE_DIR` | `/tmp/spirithaus-media` | Where composites and masters are written when no object storage provider is configured. The local store **warns that it will not survive the machine**. Configure real storage before anything worth keeping is generated. |
| `SEED_SHOP_DOMAIN` | `spirithaus-dev.myshopify.com` | Development seed only. Do not set it in production. |
| `COMPOSITE_CONCURRENCY` | `2` | Composites per worker. Image work is CPU-bound and sharp already uses several threads per operation, so this is a starting point, not a measurement. |
| `RENDER_CONCURRENCY` | `1` | Video renders per worker. Each drives a headless browser through every frame; two at once make both slower and neither cancellable in reasonable time. Scale by adding workers. |
| `ASSET_LICENCE_HOLDER` / `ASSET_LICENCE_TERMS` | — | Required by `sync:shopify-assets`, with no default. A supplier's packshot carried in a retailer's catalogue is not automatically licensed for marketing use, so the rights basis is asserted by whoever runs the ingestion. |

### Providers

Sixteen contracts, one variable each (`PROVIDER_TEXT`, `PROVIDER_PUBLISHING`, …). `mock` or unset
is a **supported configuration, not a test double**: a mocked provider transmits nothing, and a
mocked publisher returns `published: false` with no external id and no public URL. A named
adapter this build does not implement is refused with an explanation rather than falling back to
a mock silently.

Leave every one of them at `mock` in staging until the corresponding provider has been
separately authorised. Enabling one is a configuration change, not a code change — which is
precisely why it needs a decision behind it.

There is deliberately **no** variable for an Admin access token. Offline tokens are issued by
OAuth and stored in the `Session` table; nothing reads one from the environment, and putting a
live credential in a file would achieve nothing except exposure.

### Behind an egress proxy

| Variable | Notes |
| --- | --- |
| `NODE_USE_ENV_PROXY` | **Set to `1` if `https_proxy` is set.** Node reads this once at startup to install its proxy-aware dispatcher; nothing in the application can switch it on afterwards. Without it, `fetch` ignores `https_proxy` entirely and goes direct — which, behind a filtering gateway, produces a `403` that looks exactly like Shopify rejecting the access token. The app now detects this combination and names it in the diagnostic, but the fix is this variable. |
| `https_proxy` / `HTTPS_PROXY` | Standard. Credentials in the URL are redacted before anything is logged. |
| `REMOTION_BROWSER_EXECUTABLE` | Path to a Chromium headless shell. Without it Remotion downloads its own on first render, which needs egress to Remotion's CDN. In a locked-down network, bake a shell into the image and point this at it. |

## Egress the app needs

The network policy matters more here than in most applications, because two of this system's
defined failure states exist to describe being blocked.

| Host | Needed for | Consequence if refused |
| --- | --- | --- |
| `*.myshopify.com` | Admin GraphQL: product sync, OAuth token exchange | Syncs record `UNREACHABLE` rather than failing; Admin calls return `network_blocked`, non-retryable, with a diagnostic naming the host. OAuth cannot complete at all. |
| `cdn.shopify.com` | Product imagery for the protected-asset pipeline | `sync:shopify-assets` cannot download masters. |
| The shop's storefront origin | `SOURCE=storefront` asset ingestion only | Not needed when the Admin source is reachable. |
| Remotion's CDN | Downloading a headless shell on first render | Renders fail unless `REMOTION_BROWSER_EXECUTABLE` points at a baked-in shell. |
| Provider APIs | Only the providers you have enabled | Not applicable while everything is `mock`. |

A blocked host is never reported as an authentication failure. If a diagnostic says the token was
rejected, the token was rejected.

## Shopify Partner Dashboard

These live outside the repository and must agree with it.

| Setting | Value |
| --- | --- |
| App URL | `SHOPIFY_APP_URL` |
| Allowed redirection URL | `<SHOPIFY_APP_URL>/auth/shopify/callback` — **byte for byte, scheme included** |
| Embedded | Yes. React Router apps from this library are embedded by default. |

The callback path is derived from `authPathPrefix` in `app/shopify.server.ts`. It also derives
the login, session-token and exit-iframe paths, so they move as a set or not at all. A mismatch
here is the most common cause of an install that fails at the last step.

### Scopes

Requested (mandatory): `read_products`, `read_inventory`, `read_orders`, `write_pixels`,
`read_customer_events`, `read_marketing_events`, `write_marketing_events`.

Optional, requested only where the corresponding feature is wanted: `read_customers`,
`read_all_orders`, `write_discounts`, `read_files`, `read_publications`.

**The app asks for no write access to merchant data** — no `write_products`, `write_inventory`,
`write_orders`, `write_customers`, `write_themes`. Product data is truth, not output. The
Settings screen lists every scope with its reason and the ones deliberately refused; if a review
asks why a scope is requested, that screen is the answer.

### Webhooks

`app/uninstalled`, `shop/update`, `products/create`, `products/update`, `products/delete`,
`inventory_levels/update`, `collections/update`, plus the three Shopify requires of every public
app: `customers/data_request`, `customers/redact`, `shop/redact`.

Endpoints are `<SHOPIFY_APP_URL>/webhooks/app`, `/webhooks/catalogue`, `/webhooks/inventory` and
`/webhooks/privacy`. HMAC is verified first-party before a body is parsed, and a duplicate
delivery is recognised by `(shop, topic, event id)` and skipped.
