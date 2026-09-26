# 7 — First-party attribution

§26. The design goal is a number a business can act on, with its uncertainty attached.

## The identity chain

Every published post carries an identity that survives the journey to a confirmed order:

| Field | Where it lives |
| --- | --- |
| campaign id, creative id, variant id | `sh_c` parameter on the destination URL |
| platform post id | recorded on `PlatformPost` at publish, joined by `sh_c` |
| product ids, audience segment id, approval version id | on the campaign record, not in the URL |
| `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` | the URL, per §26 |
| offer code | optional, `Discount` created via `write_discounts` |
| attribution window | campaign setting, recorded per touch |

One short opaque parameter (`sh_c`) rather than six long ones: it survives platform link
handling better, it does not leak the campaign structure into a public URL, and the UTMs
remain present and conventional alongside it so Shopify's own reporting and GA4 still work.

**UTMs are client-side data, and the design says so.** §26 is explicit that UTMs must not be
described as server-side. They are captured by the Web Pixel from the landing URL and sent to
our event endpoint; what is server-side is the *recording and the join*, not the parameter.

## Ingestion

A Shopify Web Pixel extension (`write_pixels`, `read_customer_events`) subscribes to
`page_viewed`, `product_viewed`, `search_submitted`, `product_added_to_cart`,
`checkout_started`, `checkout_completed`. Each event posts to our endpoint with a
client-generated `eventId` (unique index, §03) so a retry cannot double-count.

The join keys, in order of reliability: order id → checkout token → cart token → pixel client
id. `MarketingIdentity` is the pseudonymous chain — no name, email or address is copied.
Orders arrive independently through the `orders/create`, `orders/updated`,
`refunds/create` and `orders/cancelled` webhooks, so a confirmed order is confirmed by
Shopify, never inferred from a client event.

## Contribution margin, computed ex-GST

§26 ranks contribution margin first, so the definition needs to be explicit and Australian:

```
net revenue      = gross line revenue
                 − discounts
                 − refunds and cancellations
                 − GST (÷ 1.1 on AUD prices, which are GST-inclusive)
contribution     = net revenue
                 − COGS (inventoryItem.unitCost × quantity)
                 − variable fulfilment (configured per order or per kg)
                 − attributed paid media spend
```

Shopify's displayed AUD prices include 10% GST. A margin computed on gross prices overstates
every figure by about 9%, uniformly, which makes it look plausible — the worst kind of wrong.

COGS depends on `inventoryItem.unitCost` being populated. If it is not (blocking question 7),
margin falls back to a per-collection default rate set by a Finance Approver and **every
resulting figure is labelled estimated**, at the field level, not in a footnote.

Excise and WET are not modelled: for a retailer they are already inside the purchase cost
that `unitCost` represents. Double-counting them would understate margin.

## Reporting the same outcome several ways

§26 requires first-click, last-click, assisted, platform-reported, offer-code, view-through
where valid, modelled and unattributed reported **separately**. One table, one column per
model, never a single blended number:

| | orders | net revenue | contribution |
| --- | --- | --- | --- |
| Last click | | | |
| First click | | | |
| Assisted (any touch in window) | | | |
| Offer code | | | |
| Platform-reported | | | |
| View-through (where the platform supplies it and it is valid) | | | |
| Modelled | | | |
| Unattributed | | | |

Each row shows its attribution window, data completeness, and sample size. **Unattributed is
a row, not a residual to be quietly distributed** — it is usually the largest one and hiding
it is how attribution reports become fiction.

Platform-reported sits in the same table as our own measurement precisely so the discrepancy
is visible. It will be large. That is information about the platform, not an error to
reconcile away.

No causal language anywhere in the UI. A campaign is "associated with" orders in its window.
§26's last line and §43's.

## The metric ranking, and how vanity metrics are held down

§26's order is enforced in code, not in a dashboard layout: contribution margin, net revenue,
confirmed orders, conversion rate, new-customer acquisition, CAC, AOV, add-to-cart, checkout,
qualified sessions, saves, shares, engagement, impressions, likes. `CommercialMetric` carries
a fixed `rank` per metric; a campaign with a documented awareness objective and an approval
recording it may re-rank, and nothing else can. There is no setting to promote likes.

Down-weighting works as §26 describes, with the exception it also requires: creative that
earns engagement without commercial outcome loses commercial score but keeps a **separate
awareness score**, so content that assists a later conversion is not scored as a failure.
Both scores show sample size and window, and neither is presented as a forecast.

## What this cannot know

- **Cross-device journeys.** A phone impression and a desktop purchase do not join. Reported
  as a known gap, not modelled into confidence.
- **View-through on most platforms.** Only counted where the platform supplies it and its
  definition is recorded. Otherwise absent, not estimated.
- **Dark social.** A link pasted into a message loses its parameters and lands in
  unattributed.
- **Order windows before install.** With `read_orders` alone, 60 days
  ([04](04-platforms-and-scopes.md)).
