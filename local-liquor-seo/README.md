# local-liquor-seo

An internal local-search toolkit for a single independent bottle shop in Sydney.
It is not a website. It is two tools that run on a laptop and produce:

* **Part A - a Google Business Profile content engine.** Ready-to-publish posts,
  product tiles, seeded Q&A, review replies and a photo program, written to
  files you paste into the GBP dashboard. Every line is validated against NSW
  liquor advertising rules before it touches disk.
* **Part B - local rank tracking.** A geo-grid scan of the map pack around the
  store, scored (ATRP / ARP / SoLV), rendered as a heatmap, and compared against
  nearby competitors.

Everything the tools know about the business - name, address, phone, hours,
licence details, site URLs - lives in `config/business.yaml`. Nothing under
`src/` hardcodes a business fact; a test enforces that.

## Status

| Phase | Scope | State |
| --- | --- | --- |
| 1 | Repo scaffold, `business.yaml`, compliance gate + tests, CLI skeleton | **done** |
| 2 | Part A content engine (calendar, posts, products, Q&A), file output only | not started |
| 3 | Part B rank tracker (grid, providers, scoring, heatmap) | not started |
| 4 | Review replies, photo program, competitor + profile + site audits, weekly report | not started |
| 5 | Optional GBP API publisher behind `PUBLISH_MODE=api` | not started |

Unbuilt commands are registered and tell you which phase they land in rather
than failing with a stack trace.

## Quick start

```bash
uv sync                       # or: python -m venv .venv && pip install -e ".[dev]"
cp .env.example .env          # Phase 1 and 2 need no keys at all
uv run llm-seo --help
uv run llm-seo commands       # flat list of every command
uv run llm-seo config show    # resolved config + the gaps still open
uv run pytest
```

If `uv` is unavailable:

```bash
python3.11 -m venv .venv && . .venv/bin/activate
pip install -e . && pip install pytest pytest-cov
llm-seo --help
```

## The compliance gate

`src/llm_seo/compliance.py` is the only thing standing between a generator and a
regulator, so it runs before anything is written and **fails the build** on a
violation. It never silently strips or rewrites copy - a validator that quietly
edits your ads teaches you nothing about the ad you wrote.

| Rule | What it enforces |
| --- | --- |
| R1 | Licence number **and** licensee name (the name on the licence, not the trading name) in the footer of alcohol copy |
| R2 | The mandated under-18 responsible-service line on alcohol copy |
| R3 | No encouragement of rapid, excessive or irresponsible consumption |
| R4 | No special appeal to under-18s |
| R5 | No time-pressured or extreme discount framing |
| R6 | Zero-alcohol copy is exempt from R1-R2, still bound by R3-R5, and may never be sold as a way to get drunk |
| R7 | Never advertise trading outside actual opening hours; never imply Sunday liquor sales before the configured start time |
| R8 | Every link resolves to a known path on the canonical site |
| R9 | Review replies never carry the licence footer |
| R10 | Review replies never offer alcohol as compensation |
| R11 | Never advertise a service the store does not run (e.g. click-and-collect) |

Try it:

```bash
uv run llm-seo compliance check "Big night ahead? Get on it - last hour only."
uv run llm-seo compliance check --surface review_reply --kind non_alcohol \
  "Sorry about the wait - free bottle on us."
uv run llm-seo compliance footer
```

Term lists live in `config/blocklist.yaml`; the mandated wording, the footer
template and the surfaces that must carry it live under `compliance:` in
`config/business.yaml`. Matching is done on normalised text, so smart quotes,
non-breaking spaces and odd casing cannot smuggle a blocked phrase past it.

Two deliberate judgement calls, both configurable:

* **GBP Q&A answers are exempt from the licence footer** (`compliance.footer_surfaces`).
  A footer reads as spam in an answer. Add `"qanda"` to that list to tighten it.
* **An unscoped hours claim is checked against the narrowest window in the week.**
  "Open till 10pm" with no day attached reads as *every* day, so it fails even
  though it is true Thursday to Saturday. Name the days and it passes.

`config/blocklist.yaml` also has an `allow_phrases` list, which masks known-safe
phrases before scanning. Every entry there is a hole in the validator - keep it
short and justify each one.

## Repository layout

```
config/       business.yaml, keywords.yaml, competitors.yaml, blocklist.yaml
src/llm_seo/  business.py, compliance.py, cli.py, content/, rank/, audit/
data/         sqlite db, API caches, your products.csv and reviews.csv (gitignored)
out/          generated captions, CSVs, heatmaps, reports (gitignored)
tests/        pytest suite
```

## Google APIs

**Step-by-step walkthroughs live in [docs/google-access.md](docs/google-access.md)**
- finding the `place_id`, creating a Places API key, and applying for GBP API
write access. Summary below.

### Places API (New) - needed for Part B

1. In the Google Cloud console, create (or pick) a project and enable billing.
2. **APIs & Services -> Library -> enable "Places API (New)"**. The legacy
   Places API is a different SKU and this toolkit does not use it.
3. **Credentials -> Create credentials -> API key**, then restrict the key to
   the Places API (New) and, if you are on a fixed IP, to that IP.
4. Put it in `.env` as `GOOGLE_MAPS_API_KEY`.

### Finding the `place_id`

The GBP dashboard does not show it. Three routes, easiest first.

**1. Place ID Finder - no API key, about a minute.** Open
<https://developers.google.com/maps/documentation/places/web-service/place-id>,
type the business name into the search box on the embedded map, pick it from the
autocomplete. The pin's info window shows a `ChIJ...` string - that is the place
ID. Paste it into `google.place_id` in `config/business.yaml`.

**2. Verify whatever you got.** Open this in a browser:

```
https://www.google.com/maps/place/?q=place_id:ChIJ...
```

It resolves to exactly one place. If it lands on the shopping centre, a
neighbouring tenancy or an old duplicate listing rather than the shop, the ID is
wrong - that mistake would make every rank scan measure someone else's business
and still look completely normal.

**3. Places API Text Search - needs `GOOGLE_MAPS_API_KEY`.** Useful if you want
it scripted:

```bash
curl -s -X POST 'https://places.googleapis.com/v1/places:searchText'   -H 'Content-Type: application/json'   -H "X-Goog-Api-Key: $GOOGLE_MAPS_API_KEY"   -H 'X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress'   -d '{"textQuery": "<trading name and formatted address from config/business.yaml>"}'
```

`places[].id` is the place ID. Google prices Text Search by field mask and an
ID-only mask is the cheapest tier, so keep the mask minimal - and confirm the
returned `displayName` and `formattedAddress` match `business.yaml` before you
trust the result.

**Do not** try to dig it out of a Google Maps URL. The hex `0x...:0x...` and
`!16s/g/11...` fragments in there are internal feature IDs, not place IDs, and
converting them needs the API anyway.

Two things worth knowing: a place ID can change if Google merges or rebuilds a
listing, so re-check it if scans suddenly go blank; and the ID must be the
listing you actually own in GBP, not a duplicate.

### Google Business Profile APIs - only for Phase 5 publishing

Read access to your own profile and write access to posts are separate things.
`accounts.locations.localPosts` is gated: you request quota through Google's
Business Profile API access form, tied to your Cloud project number, and
approval takes weeks and is sometimes refused for single-location businesses.

So the default output path is **files, not API calls** (`PUBLISH_MODE=file`).
Every generator writes a CSV plus a folder of captions you paste manually. The
API publisher is an optional adapter and refuses to run unless
`google.api_write_access: granted` is set in `config/business.yaml`.

To request it: enable "My Business Account Management API" and "My Business
Business Information API" in your Cloud project, submit the Business Profile
APIs access request form for that project number, then create an OAuth client
(Desktop) and put the client id/secret plus a refresh token in `.env`. The OAuth
walkthrough is written up in Phase 5.

### Expected monthly API cost

The call arithmetic is fixed; the price per call is not, so check Google's
current pricing page before you commit. A weekly scan at the default settings:

```
7 x 7 grid                    =    49 points
49 points x 22 keywords       = 1,078 requests per scan
1,078 x 4.3 scans per month   = 4,635 requests per month
```

Google's Places API (New) bills per SKU with a monthly free allowance per SKU;
a search-shaped call sits in the dearer tier. Sanity-check the two ends:

* If the monthly volume lands inside the free allowance, cost is zero.
* If it is billed at the Pro search rate (order of a few cents per call), 4,635
  calls is roughly US$100-150/month.

A paid SERP provider is priced per search - at roughly US$15 per 1,000 searches,
the same volume is about US$70/month.

Three levers if that is too much: drop to a 5 x 5 grid (25 points, -49%), scan
fortnightly, or split the keyword set so the 8 keywords you actually care about
run weekly and the rest run monthly. The scanner prints a cost estimate and
stops for confirmation above `COST_CEILING_USD`, hard-caps at
`MAX_CALLS_PER_SCAN`, and logs every billable call to `data/api_usage.csv`.

### Swapping rank providers

`src/llm_seo/rank/providers.py` (Phase 3) defines a `RankProvider` interface -
`search(keyword, lat, lng) -> list[LocalResult]`. Implementations: `PlacesApiProvider`,
`SerpApiProvider`, and `FixtureProvider` for tests and `--dry-run`. Pick one with
`RANK_PROVIDER=places|serpapi|fixture` in `.env`; nothing else changes.

Neither provider scrapes google.com or maps.google.com.

## Tests

```bash
uv run pytest
uv run pytest --cov=llm_seo --cov-report=term-missing
```

`compliance.py` is at 100% line coverage; `grid.py` and `scoring.py` get the
same treatment when Phase 3 lands.

## Conventions

* Business facts come from `config/business.yaml` and nowhere else. A test walks
  the tree and fails if the phone number, street address, site host or licence
  number appears in any file outside `config/`.
* The store's coordinates are cross-checked against its Google plus code
  (`src/llm_seo/plus_code.py`). If the two disagree by more than
  `geo_plus_code_tolerance_m`, the config is rejected - a swapped lat/lng or a
  dropped minus sign would otherwise centre the whole rank grid on the wrong
  suburb and every scan would look plausible and be wrong.
* Secrets come from `.env` (via `python-dotenv`). `.env.example` is committed;
  `.env` never is.
* Every API-calling module gets `--dry-run` and a cached-response mode so the
  tool can be developed without burning quota.
