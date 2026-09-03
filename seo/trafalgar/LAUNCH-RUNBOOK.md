# Launch runbook — Local Liquor Marsfield

Everything outstanding, in the order it should be done. Each step says who does
it and roughly how long. Nothing here needs to be figured out — the wording,
values and settings are all written down already, linked from each step.

Steps 1–4 are one sitting, about an hour. Steps 5–8 are ongoing.

---

## 1 · Deploy the site · ✅ done

The site moved to its own repository, **singhajay001/localliquormarsfield**, and
Cloudflare Workers now builds and deploys it on every push to `main`. No more
zips, and `html_handling` lives in `wrangler.jsonc` rather than in a dashboard
field that resets on every upload — that field is what 404'd the homepage the
first time.

`publish.sh` runs `check.sh` first, so an expired promotion, a drifted footer or
an inconsistent address fails the build instead of going live.

**Still to check:** open the `localliquormarsfield1.singhajay001.workers.dev`
address and click through all nine pages, `/specials` especially, plus a junk
URL to confirm the 404 page. Do this before step 2.

## 2 · Point the domain at it · ✅ done 2026-09-03

`localliquormarsfield.com.au` is attached to the **localliquormarsfield1**
Worker, which builds from `singhajay001/localliquormarsfield` on every push to
`main`. Verified live: homepage, `/specials`, and `/xyz` serving the branded 404
that only exists in the new build.

The old project held only the apex — `www` was never configured, so nothing was
lost in the move.

**Two loose ends, neither urgent:**

- **`www` does not resolve.** Nobody is losing traffic over it today, but people
  do type it. Fix: DNS → CNAME `www` → `localliquormarsfield.com.au`, proxied;
  then Rules → Redirect Rules → 301 to the apex, preserving path and query. Do
  not attach `www` as a second custom domain — that serves a duplicate site on a
  second hostname.
- **Delete the old `localliquormarsfield` Worker.** It holds no domains now, so
  it serves nothing. Deleting it removes the chance of deploying to the wrong
  project later.

## 3 · Set the website on the Google Business Profile · ✅ done 2026-09-02

`https://localliquormarsfield.com.au` is now on the profile. The field had been
empty, so the Website button fell through to Instagram — people who found the
shop on Maps and wanted the hours landed on a social feed. This was the
highest-value single action in this workspace and it is done.

**It changes the risk on step 2.** The domain still resolves to the old
Cloudflare Pages project, and the profile now sends traffic there, so the
handover has a live audience. Move it at a quiet hour, and check
`localliquormarsfield.com.au/specials` first: if that 404s, the old project is
serving a build from before the specials page existed and the move is worth
doing sooner rather than later.

**Two follow-ups now that the field is set:**

- Add the same URL to the Instagram bio and any other profile that currently
  has no link.
- Watch **Insights → Website clicks** on the profile. It was structurally zero
  before today, so any number at all is new. Give it a fortnight before reading
  anything into the shape of it.

## 4 · Search Console · you · 10 min + verification wait

1. `search.google.com/search-console` → **Add property** → **Domain** (not URL
   prefix — Domain covers `www`, non-`www`, http and https in one property).
2. It gives you a DNS TXT record. Add it in Cloudflare → your domain → DNS →
   Add record → type TXT.
3. Verify.
4. **Sitemaps** → submit `sitemap.xml`.
5. **URL Inspection** → paste the homepage → **Request indexing**. Do the same
   for `/specials`.

**Done when:** the sitemap shows "Success" and 8 discovered URLs.

Then leave it alone for two weeks. Coverage and performance data take that long
to mean anything, and checking daily only invites over-reaction.

---

## 5 · The store locator — highest-value citation · you · one email

`localliquor.com.au` is your own banner's store locator, listing ~430 stores. It
carries more authority than any directory, and unlike a directory it is a
relationship you already have.

Email drafted and ready: `seo/trafalgar/citations/correction-requests.md` §5.
Send via `localliquor.com.au/contact/`, or ask your ILR state rep — they can
usually action it faster than a web form.

Two things to confirm: that the store is listed at all, and that it shows
**Shop 5A** and **0452 480 487** rather than the supermarket's details.

## 6 · Citation corrections · you · three emails

All drafted in `seo/trafalgar/citations/correction-requests.md`:

| § | Target | Ask |
|---|---|---|
| 1 | cellars.com.au | Rename "Trafalgar Cellars" → Local Liquor Marsfield, fix the `Shiop 5/1` typo |
| 2 | Pink Pages | Rename "Trafalgar Cellars Of Marsfield" → Local Liquor Marsfield |
| 3 | friendlygrocer.com.au | Merge the two duplicate pages for the supermarket |

§3 is best raised through your **Metcash account manager** rather than the
website contact form — a form request to merge two pages usually goes nowhere.

Track progress in `seo/trafalgar/citations/tracker.md`. Work top-down: the
high-authority sources are re-scraped by the low-authority ones, so fixing them
first fixes several others for free.

## 7 · Audit the supermarket profile · you · 20 min

`seo/trafalgar/gbp-supermarket-audit.md` — never been checked.

The row that matters is **categories**. If the supermarket profile carries a
liquor category, it competes with Local Liquor Marsfield for the same local pack
slot, and the older better-reviewed listing wins — which is the supermarket, the
one you are *not* trying to grow.

## 8 · Refresh the specials each catalogue · you or me · 5 min

The current promotion (P37) expires **15 September 2026**. After that,
`./check.sh` fails and refuses to call the site ready to publish — deliberately,
so a stale fortnight of prices cannot sit on the homepage unnoticed.

To refresh: send me the new catalogue PDF. I update `build/specials.json`, re-run
`build/specials.py`, and hand back a new zip.

To do it yourself: edit `build/specials.json` (prices, names, and the `from`/`to`
dates), then

```bash
cd sites/localliquormarsfield
python3 build/specials.py
./check.sh
```

Never upload while `check.sh` says NOT READY.

---

## What I cannot do from here

Remote Claude Code sessions have outbound page fetches blocked
(`EGRESS_BLOCKED`), so I cannot load `localliquor.com.au`, your Google profiles,
or the live site to verify any of the above. Web search works; fetching pages
does not.

That means steps 1–7 need you at the keyboard. If you want me to verify live
pages — check the deployed site, read the store locator, audit a competitor —
run Claude Code from a terminal on your own machine in this repository, where
those fetches work.

## What is already done

- Site built, eight pages, 55 catalogue specials, `check.sh` passing
- Schema: `LiquorStore` for the bottle shop, `GroceryStore` for the supermarket,
  two entities kept deliberately separate
- All correction emails drafted with the correct NAP
- Citation tracker with 20 sources ranked by authority
- Bottle shop GBP audited against live data; phone corrected across 47 places
