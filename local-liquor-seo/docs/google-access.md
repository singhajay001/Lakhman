# Getting Google access

Two separate things, with very different effort and very different risk of
rejection:

| What | Needed for | Effort | Can Google say no? |
| --- | --- | --- | --- |
| `place_id` | All of Part B (rank scans, audits) | ~1 minute, no key | No |
| Places API key | Live rank scans | ~5 minutes, needs billing | No |
| GBP API **write** access | Only Phase 5 auto-publishing | Form + wait, weeks | **Yes** |

The toolkit is built file-first precisely because the third one can be refused.
Everything except automatic publishing works without it.

---

## 1. The `place_id`

A `ChIJ...` string identifying the listing. The Business Profile dashboard does
not display it anywhere.

### Route A - Place ID Finder (no API key, about a minute)

1. Open <https://developers.google.com/maps/documentation/places/web-service/place-id>
2. Scroll to the embedded map with a search box on it.
3. Type the shop name, pick it from the autocomplete.
4. The pin's info window shows the place ID. Copy it.

### Route B - Places API Text Search (needs `GOOGLE_MAPS_API_KEY`)

```bash
curl -s -X POST 'https://places.googleapis.com/v1/places:searchText' \
  -H 'Content-Type: application/json' \
  -H "X-Goog-Api-Key: $GOOGLE_MAPS_API_KEY" \
  -H 'X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress' \
  -d '{"textQuery": "<trading name and formatted address from config/business.yaml>"}'
```

`places[].id` is the place ID. Google prices Text Search by field mask, and an
ID-only mask is the cheapest tier, so keep the mask minimal.

### Verify it before you trust it

Paste it into a browser:

```
https://www.google.com/maps/place/?q=place_id:ChIJ...
```

That resolves to exactly one place. Confirm it lands on the shop - not the
shopping centre, not a neighbouring tenancy, not an old unclaimed duplicate.

This matters more than it looks. A wrong `place_id` does not throw an error: the
scanner will happily search all 49 grid points, find that "we" never rank, draw
a completely grey heatmap, and be measuring a business that is not yours. Same
silent-failure shape as a wrong grid centre, which is why the config
cross-checks the coordinates against the plus code.

### Then

```yaml
# config/business.yaml
google:
  place_id: "ChIJ..."
```

A place ID can change if Google merges or rebuilds a listing. If scans suddenly
go blank, re-check this first.

### Do not bother with Maps URLs

The `0x...:0x...` and `!16s/g/11...` fragments in a Google Maps URL are internal
feature IDs, not place IDs. Converting them needs the API anyway.

---

## 2. Places API key (for live rank scans)

1. <https://console.cloud.google.com> - create a project (or reuse one) and
   enable billing on it.
2. **APIs & Services -> Library -> "Places API (New)" -> Enable.** The legacy
   "Places API" is a different SKU; this toolkit does not use it.
3. **APIs & Services -> Credentials -> Create credentials -> API key.**
4. Restrict the key: **API restrictions -> Places API (New)**. Add an IP
   restriction too if you scan from a fixed address.
5. Put it in `.env` as `GOOGLE_MAPS_API_KEY`.

Cost control is in the tool, not in your memory of it: every scan prints an
estimate and stops for confirmation above `COST_CEILING_USD`, hard-stops at
`MAX_CALLS_PER_SCAN`, and logs each billable call to `data/api_usage.csv`.

---

## 3. GBP API write access

This is the one with a gate on it. It is only needed for `PUBLISH_MODE=api`
(Phase 5), where the toolkit posts to the profile for you instead of writing
captions you paste. Nothing else in Part A or Part B depends on it.

### Before you apply, make sure you qualify

Applications are rejected for mundane reasons. Check all of these first:

* The Business Profile is **verified** and has been active for **60+ days**.
* There is a **live business website** (there is - it is the canonical URL in
  `config/business.yaml`).
* You are signed in as the **Owner** of the profile, **not a Manager**.
  Manager-account submissions get rejected.
* You have a Google Cloud project and know its **project number** (the numeric
  one on the Cloud console dashboard, not the project *ID* string).

### Steps

1. **Create/choose a Cloud project** at <https://console.cloud.google.com> and
   copy the **project number** from the dashboard.
2. **Submit the access request** at
   <https://support.google.com/business/contact/api_default> and choose
   **"Application for Basic API Access"** from the drop-down. It asks for the
   project number, the Google account that owns the profile, the business
   website, and a description of what you intend to do with the API.
   Write the use case plainly: managing posts, Q&A and reviews for a single
   verified location that you own.
3. **Wait.** Days to weeks. Google may come back with questions, may approve, or
   may decline - single-location applicants are not guaranteed approval.
4. **On approval, enable the APIs** in that Cloud project's API Library. They
   generally do not appear until access is granted:
   * My Business Account Management API
   * My Business Business Information API
   * My Business Q&A API
   * Business Profile Performance API
   * Google My Business API (the v4 service - this is the one that carries
     posts, photos and reviews)
5. **Create OAuth credentials.** Configure the OAuth consent screen, then
   **Credentials -> Create credentials -> OAuth client ID -> Desktop app**. The
   scope you need is `https://www.googleapis.com/auth/business.manage`.
6. **Authorise as the profile owner** and keep the refresh token. Put the client
   id, client secret and refresh token in `.env` (`GBP_CLIENT_ID`,
   `GBP_CLIENT_SECRET`, `GBP_REFRESH_TOKEN`).
7. **Flip the config:**

   ```yaml
   google:
     api_write_access: "granted"
   ```

   The publisher refuses to run until this says `granted`, so an unapproved
   project cannot silently fail halfway through a batch of posts.

### What actually gets used

Posts are `accounts.locations.localPosts.create` on the v4 service
(`https://mybusiness.googleapis.com/v4/accounts/{account}/locations/{location}/localPosts`).
Posts, photos and reviews still live on v4; the newer Business Information API
covers profile attributes, hours and categories, not posts.

Initial quota is low. If a bulk backfill hits limits there is a separate quota
increase request; day-to-day posting at three per week will not come close.

### If you are declined

Nothing breaks. `PUBLISH_MODE=file` is the default: every generator writes a CSV
plus a folder of ready-to-paste captions. Three posts a week is about five
minutes of pasting, and you get to eyeball each one before it goes live - which
for licensed-liquor advertising is not the worst outcome.
