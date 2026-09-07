# Uber Eats storefront agent

Reads the Uber Eats channel for **Trafalgar Supermarket And Cellars** (Marsfield NSW),
reports on it, and flags liquor orders that fall outside licensed hours.

**This agent never writes to Uber Eats.** MyFoodLink holds the Uber Eats integration
and owns every write to the menu, prices and stock. A second writer would fight it —
stock flapping, price races, items disappearing. So this is a read-and-alert system.
Where an action needs a write, the agent produces a recommendation and a human applies
it in Uber Eats Manager or MyFoodLink.

See [`docs/phase0-capability-matrix.md`](docs/phase0-capability-matrix.md) for what is
automated, what is recommend-only, and what is not possible under that constraint.

## Status

**Phase 1 complete.** Ingest, metrics, dashboard, weekly report, Telegram, licensed-hours
monitor. Phases 2–5 are specified but not built.

## Setup

```bash
cp .env.example .env          # fill in what you have; all of it is optional
make dev                      # install deps, create the database
```

Drop the MyFoodLink exports into `data/inbox/`. Filenames must contain `order` or
`sales` — that is how they are told apart:

```
data/inbox/
  trafalgargrocery-orders-Q3-2026.csv
  myfoodlink-trafalgargrocery-sales-2026.csv
```

```bash
make ingest                   # load them (idempotent - safe to re-run)
make report                   # print the weekly report
make serve                    # dashboard at http://localhost:8000
```

## Commands

| Command | Does |
|---|---|
| `make dev` | Install dependencies and create the database |
| `make ingest` | Load every export in the inbox |
| `make report` | Print the weekly report to stdout |
| `make report-send` | Print it and send it to Telegram |
| `make serve` | Run the dashboard on port 8000 |
| `make test` | Run the suite with coverage |
| `make deploy` | Build the Docker image |

## Endpoints

| Route | Returns |
|---|---|
| `/` | Dashboard — headline tiles, orders by hour, licensed-hours exceptions |
| `/report?days=7` | The weekly report as Markdown |
| `/api/snapshot?days=7` | Headline figures as JSON |
| `/api/compliance?days=28` | Orders outside the licensed window |
| `/health` | Liveness, plus the latest ingested order date |

## Configuration

Every secret comes from the environment — see `.env.example`. Nothing is defaulted to a
real value, and `.env` is gitignored.

**Feature flags.** No feature can be un-switchable: `ENABLE_SCHEDULER`,
`ENABLE_TELEGRAM` and `ENABLE_LLM_NARRATIVE` each turn one off without a code change.
With no `ANTHROPIC_API_KEY` the report still renders — just without the narrative.

### The commission arithmetic

`UBER_COMMISSION_RATE` drives every margin figure. Commission is charged on the
**marked-up** price, so holding your in-store dollar margin needs an uplift of
`rate / (1 - rate)`, not `rate`:

| Commission | Uplift needed |
|---:|---:|
| 15% | 17.6% |
| 25% | 33.3% |
| 30% | **42.9%** |
| 35% | 53.8% |

Matching a 30% uplift to a 30% commission nets $9.10 on a $10 in-store item. Confirm
the real rate against the merchant agreement before trusting any margin number here.

### Liquor licensed hours

Licence `LIQP700301260` (Trafalgar Cellars of Marsfield). Windows are configured in
`agent/config.py` — Mon–Sat 05:00–24:00, Sun 10:00–22:00.

Two things keep the check honest:

- **The export reports an hour bucket, not a timestamp.** Evening hours arrive
  individually but daytime checkouts appear only on even hours, which looks like
  two-hour bucketing. A bucket that only partly overlaps the window returns
  `STRADDLES`, not a breach.
- **NSW restricts supply, not checkout.** Checkout time is a proxy. Nothing here
  asserts a breach — it says which dockets to go and read.

The agent **cannot enforce** these hours, because it cannot write. Configure item-level
liquor availability hours in MyFoodLink or Uber Eats Manager; this monitor then tells
you whether the rule is holding.

## Approving actions

Phase 1 takes no actions that need approval — it only reads and reports. Every external
mutation, when later phases have one, is written to `actions_log` with before/after
state and who approved it. The approval channel is Telegram.

## Runbooks

### The Anthropic API is unavailable

Nothing breaks. `agent.llm.client.generate` returns `None` on a connection error, an API
error, or a refusal, and the weekly report renders without its narrative. To silence it
deliberately, set `ENABLE_LLM_NARRATIVE=false`. Check `/health` and the logs; no data is
lost, and the next report picks the narrative back up.

### Telegram is failing

`send_message` returns `False` rather than raising, and the alert is still recorded in
the `alerts` table with `delivered = false`. Confirm `TELEGRAM_BOT_TOKEN` and
`TELEGRAM_CHAT_ID`, then re-run `make report-send`. If the token is compromised, revoke
it with @BotFather and set the new one — nothing in the codebase holds it.

### Bad data got ingested

Ingestion is idempotent and keyed on order number, so re-running over corrected exports
updates rows in place:

```bash
rm data/inbox/*.csv                 # clear the bad export
cp <corrected exports> data/inbox/
make ingest                         # rows are updated, not duplicated
```

To start clean, delete `data/agent.db` and run `make ingest` again — the exports are the
source of truth, so nothing is lost by rebuilding.

### Wrong prices are live on Uber Eats

**Not this agent.** It has no write path to the storefront. Prices reach Uber Eats
through MyFoodLink from the POS, so the fix is in the POS or MyFoodLink's Uber module.
Once corrected, re-export and `make ingest` so the reporting catches up.

### An order shows outside licensed hours

1. Read `/api/compliance` or the licensed-hours section of the weekly report.
2. Pull the actual docket for that order number — the report deliberately does not
   assert a breach, because checkout time is a proxy for supply time.
3. If liquor really was supplied outside the window, fix the availability rule in
   MyFoodLink or Uber Eats Manager, then confirm the next report is clean.

## Tests

```bash
make test
```

66 tests. The modules that carry risk — licensed hours, ingest, metrics, the LLM
wrapper, reporting — sit at 98% coverage. The dashboard, CLI and scheduler are
thin wiring and are covered by smoke checks rather than unit tests.

## Layout

```
agent/
  config.py            settings and licensed-hours windows
  models.py            schema (Phase 1 populates orders and actions_log)
  ingest/myfoodlink.py export parsing, idempotent load
  analytics/
    metrics.py         headline figures, bands, commission arithmetic
    compliance.py      licensed-hours checking
  llm/client.py        Anthropic wrapper, degrades to None on any failure
  reporting/weekly.py  the owner report
  notify/telegram.py   alerts and the approval channel
  api.py               dashboard and JSON endpoints
  cli.py               make targets call this
  scheduler.py         hourly ingest, Monday report
prompts/               prompt text, not string literals
docs/                  Phase 0 capability matrix
```
