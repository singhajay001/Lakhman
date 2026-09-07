# Phase 0 — Capability matrix (draft)

**Status:** draft, pending three confirmations (see *Open blockers*). No code written.
**Store:** Trafalgar Supermarket And Cellars, Shop 5 / 1 Trafalgar Place, Marsfield NSW.
Single Uber Eats store carrying grocery, liquor (customer-facing brand *Local Liquor
Marsfield*) and the açaí/desserts range.

## The constraint that shapes everything

Two answers from discovery change the architecture in the original brief:

1. **MyFoodLink holds the Uber Eats integration**, not us.
2. **MyFoodLink keeps ownership of menu writes**; this agent is read-only.

Uber Eats Marketplace API access is normally granted per store to the integration
partner operating it. A second direct integration alongside MyFoodLink is not something
we should assume is available — it needs Uber's approval and, in practice, MyFoodLink's
cooperation. **Until that is confirmed, `uber_client/` cannot authenticate and Phase 1
as specced cannot run.**

This does not kill the project. It changes the data source from "Uber API" to
"MyFoodLink exports + POS", and it changes several capabilities from *automated* to
*recommend-only*. The matrix below is written against that reality, not against the
API access we hoped for.

## Data sources, in order of preference

| Source | Covers | Availability |
|---|---|---|
| MyFoodLink order + sales exports | orders, revenue, GST, basket size, hours | **Confirmed** — already in hand for 29 Jan – 7 Sep 2026 |
| MyFoodLink catalogue export | SKU, name, category, price, image flag, published state | Expected — not yet supplied |
| POS cost file | per-SKU cost, for margin maths | **Confirmed available** |
| MyFoodLink API, if one exists | scheduled pulls instead of manual export | **Unknown — ask MyFoodLink** |
| Uber Eats Manager report downloads | impressions, menu views, conversion, ratings | Manual download; no API path |
| Uber review notification emails | new ratings and review text | Possible ingestion path — see *Reviews* below |
| Uber Marketplace API (read scopes) | everything, properly | **Blocked pending confirmation** |

## Capability matrix

### Objective 1 — Storefront accuracy

| Capability | Status | How |
|---|---|---|
| Detect drift between POS and the Uber menu | **Automated** | Diff catalogue export against POS export; alert on mismatch |
| Push price / description / image changes | **Not possible** | MyFoodLink owns writes by decision |
| Stock availability toggles | **Not possible** | MyFoodLink syncs live stock already |
| Detect phantom out-of-stocks | **Automated** | Cross-reference POS stock-on-hand against zero-sale periods; report suspects |
| Hours and holiday closures | **Recommend-only** | Agent proposes; applied in Merchant Manager or MyFoodLink |
| **Liquor licensed-window enforcement** | **Detect-only** | See the warning below — this one matters |

> **The read-only decision removes the control with licence risk attached.**
> Seven Sunday orders in the 22:00 hour already sit outside the Sun 10am–10pm window,
> four of them ~100% GST-bearing. An agent that cannot write availability cannot stop
> that. Actual enforcement has to be configured as item-level availability hours in
> MyFoodLink or Merchant Manager, once. The agent's job is then to **verify the rule is
> holding** and alert the moment an order slips through. Configure the rule first;
> build the monitor second.
>
> Note also that NSW restricts *supply*, not checkout. Checkout time is a proxy. The
> monitor should read delivery/dispatch time where the export provides it.

### Objective 2 — Growth

| Capability | Status | How |
|---|---|---|
| Slow daypart / slow day detection | **Automated** | Order history; already demonstrated |
| Promo proposals with real margin maths | **Automated** | POS cost data confirmed available |
| Creating offers on Uber Eats | **Recommend-only** | Offers are a Merchant Manager surface; no merchant API |
| Sponsored Items / ads | **Recommend-only** | Same |
| Promo result attribution | **Semi-automated** | Agent records what you applied and when, then measures against a matched baseline |
| Occasion bundles / collections | **Recommend-only** | Built in MyFoodLink or Merchant Manager |
| Off-platform asset generation (social, GBP, SMS, Meta spec) | **Automated** | No Uber dependency at all — this is the one growth module that runs end to end |

### Objective 3 — Ratings

| Capability | Status | How |
|---|---|---|
| Poll ratings and review text | **Blocked** | No API access; see options below |
| Classify reviews, draft replies | **Automated once ingested** | Anthropic API; independent of the source |
| Post replies to Uber | **Not possible** | Manual, in Merchant Manager |
| Rating-drop alert | **Depends on ingestion** | Currently 4.6 from 45 ratings |

Three ingestion options, in order of how much I like them:
1. **Uber review notification emails** parsed from a dedicated inbox the store already
   receives. Not scraping — it is mail addressed to the merchant. Needs confirmation
   that Uber sends them for this account and that they carry the review text.
2. **Manual paste** into the approval chat. Crude, works from day one, zero risk.
3. **Merchant Manager report export**, downloaded weekly by hand and dropped in a folder.

### Objective 4 — Reporting

| Capability | Status | How |
|---|---|---|
| Orders, revenue, AOV, basket size, day/hour patterns | **Automated** | MyFoodLink exports |
| True margin after commission, per SKU and category | **Automated** | POS cost data + commission rate |
| Stock-out estimated lost sales | **Automated** | Requires the catalogue export |
| Impressions, menu views, conversion | **Manual input** | Uber Eats Manager only |
| Weekly owner narrative | **Automated** | Anthropic API over the computed figures |

## What this means for the phase plan

| Original | Revised |
|---|---|
| Phase 1 — Uber API read-only | **Phase 1 — ingest MyFoodLink exports + POS cost file.** Same dashboard and weekly report, different source. Acceptance unchanged: match Merchant Manager within 1%. |
| Phase 2 — Storefront sync (writes) | **Phase 2 — drift monitor + licensed-window monitor.** No writes. Configure the liquor availability rule manually first. |
| Phase 3 — Reviews | **Phase 3 — unchanged in shape, blocked on ingestion path.** Build classification and drafting against manual input; swap the source later. |
| Phase 4 — Promo engine | **Phase 4 — unchanged.** Recommend-only was always the plan; real cost data makes the margin maths honest. |
| Phase 5 — Off-platform | **Phase 5 — unchanged, and worth pulling forward.** It has no Uber dependency, so it can ship while API questions are still open. |

## A brand-separation problem worth deciding early

The brief requires liquor marketing to carry *Local Liquor Marsfield* only, with licence
line **LIQP700301260** (Trafalgar Cellars of Marsfield), and to avoid the supermarket
name. With a single store, every one of those assets deep-links to a storefront whose
header currently reads **Friendly Grocer** and whose record reads *Trafalgar Supermarket
And Cellars*. A customer clicking a *Local Liquor Marsfield* ad lands on neither name.

That is a conversion leak before any of this is built. Resolve the storefront naming
first, or accept that liquor advertising sends customers to a shop that appears
unrelated to the ad.

## Open blockers

1. **Can we obtain Uber Marketplace API read access alongside MyFoodLink?** Ask Uber
   merchant support and MyFoodLink. If yes, several rows above upgrade. If no, the
   revised plan stands and nothing is wasted.
2. **Does MyFoodLink offer an API or scheduled export?** Decides whether ingestion is
   automated or a manual drop-folder.
3. **Do Uber review notification emails reach this account, with review text?** Decides
   whether Objective 3 can run automatically.
