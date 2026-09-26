# Social accounts — strategy and setup runbook

SPIRITHAUS is online-only, Sydney, `spirithaus.com.au`. This folder is the single
source of truth for which social accounts exist, what they are called, and how they
reach the storefront and the search engines.

- `profiles.json` — the accounts, their handles, their status. Everything else is built from it.
- `copy-pack.md` — paste-ready name, bio and link text for each platform, inside each platform's character limit.
- `../tools/build-social-jsonld.mjs` — generates the `sameAs` snippet for the theme.

---

## What has to be done by a human, and why

The accounts cannot be created from here. Every one of these platforms requires an
SMS or email verification, a CAPTCHA, and acceptance of terms of service — and the
terms are a contract that binds the business, so they need a person with authority
to agree to them, not an agent. Automating the signup flow would itself breach the
terms on all six. This environment also has no network route to any of these
platforms, so even the availability checks below are indirect.

So: **you click through the signups.** Budget about 45 minutes for all nine. This
document is written so that it is 45 minutes of pasting, not 45 minutes of deciding.
Everything downstream of the signup — the handles, the copy, the theme wiring, the
structured data — is already done and in this folder.

---

## Stop: the name is contested

Before creating anything, understand that "Spirit Haus" is not a free name. The
exact-match handles are gone, and they are gone to businesses in the same category:

| Handle | Held by |
| --- | --- |
| `tiktok.com/@spirithaus` | an unrelated personal account |
| `x.com/SpiritHaus`, `x.com/SpiritHausInc` | Spirit Haus, a US liquor retailer |
| `pinterest.com/spirit_haus` | Spirit Haus Botanicals, Oregon |
| `instagram.com/spirit.haus`, `/thespirit_haus`, `/spirithausgallery` | three unrelated US accounts |
| `facebook.com/thespirithaus` | Spirit Haus, Amherst MA — a beverage store trading since 1972 |
| `linkedin.com/company/spirit-haus` | the same US retailer |

That last one matters most. There is an established American **liquor store** with
this name and a thirty-year web footprint. Google is already going to have trouble
telling the two of you apart, and a half-claimed set of near-miss handles makes that
worse, not better. This is the single strongest argument for the structured data at
the bottom of this document.

**These findings are indirect.** They come from search results, not from loading the
profiles — this environment cannot reach the platforms. Search indexes go stale.
Confirm each one at signup.

## The handle: `spirithausau`

One string, every platform, no variation. Reasons, in order of weight:

1. Every exact-match variant is taken, so a choice has to be made regardless.
2. A single consistent string is what lets `sameAs` consolidate the profiles into one
   entity. Mixed handles (`spirithaus_au` here, `shopspirithaus` there) fragment it.
3. The `au` disambiguates from three US entities with the same name. Given the
   collision above, that is a feature, not a compromise.
4. It matches the domain, `spirithaus.com.au`.

If `spirithausau` is gone on a platform when you get there, take the next one down
and **use that same fallback everywhere else too** — consistency beats per-platform
optimisation. The ladder is in `profiles.json`: `spirithaus.au`, `spirithausdrinks`,
`shopspirithaus`. Update `profiles.json` to whatever you actually registered.

---

## What these accounts will and will not do for ranking

Worth being straight about, because the brief was "better ranking and visibility".

**They will not** pass link equity. Every outbound link on every one of these
platforms is `nofollow`. No profile you create here is a backlink in any sense
Google counts.

**They will** do three things that matter:

1. **Reclaim the branded search page.** Today, someone searching "spirithaus" gets a
   page belonging largely to a Massachusetts bottle shop and an Oakland art gallery.
   Eight owned profiles displace them. For a brand with a name collision this is the
   biggest single win available, and it is worth more than the posting.
2. **Feed the Knowledge Panel.** `sameAs` in Organization JSON-LD is the mechanism
   that tells Google this set of profiles and this shop are one entity. That is what
   the generator in `../tools` produces.
3. **Rank inside two search engines of their own.** Pinterest and YouTube are search
   engines, not feeds. A pin or a tasting-note video has a useful life measured in
   months. An Instagram story has one measured in hours.

Note which of those three depend on posting: only the third. Claiming is cheap and
most of the value; posting is expensive and buys one of the three. Tier accordingly.

## Tiering — and a frank read on the six requested

The six URLs in the brief are Shopify Dawn's **default placeholder fields**, with
`shopify` as the example handle. They are the platforms the theme happens to have
settings boxes for. They are not a strategy, and two of them are close to worthless
for this business. Three platforms that matter are missing from the list entirely.

**Tier 1 — claim and post.**

- **Instagram** *(missing from the brief)* — the default discovery surface for AU
  liquor. If only one account gets made, it is this one.
- **Pinterest** *(on the brief)* — the best genuine SEO play on the list. Evergreen
  cocktail intent, pins index in Google, and it pairs exactly with "every bottle
  explained". Claim the domain in settings to enable Rich Pins.
- **YouTube** *(missing from the brief)* — "every bottle explained" is a
  video-explainer business. Long-tail search on bottle names is durable and nobody
  in AU independent retail is doing it well.

**Tier 2 — claim, post lightly.**

- **TikTok** *(on the brief)* — real reach, but alcohol is heavily constrained: no
  paid alcohol advertising, alcohol is prohibited on TikTok Shop, and organic content
  must be age-gated. Worth it only with a genuine commitment to the format.
- **X** *(on the brief)* — thin commercial value for AU retail in 2026. Cheap to
  hold for service replies and stock announcements. Do not build a content plan here.
- **Facebook** *(missing from the brief)* — needed mainly as the parent of the
  Instagram business account and for Meta catalogue and ads later.

**Tier 3 — claim the name, never post.**

- **Snapchat** *(on the brief)* — an ad platform. There is no organic discovery here
  for a bottle shop. Claim it so nobody else has it.
- **Tumblr** *(on the brief)* — negligible AU liquor audience. One minute, defensive.
- **Vimeo** *(on the brief)* — not a social network; it is paid video hosting with a
  capped free tier. YouTube does this job better and free. Claim the name only.

Tier 3 exists entirely for point 1 above — owning the branded search page — and for
keeping the name away from a squatter while the collision is unresolved. Do not let
anyone schedule content to them.

---

## Compliance — settle this before the first post

This brand already treats the **ABAC Responsible Alcohol Marketing Code** as a hard
constraint; the image prompt pack in `../image-prompt-pack.md` is built around it.
ABAC applies to social media, so the same rules bind every account here:

- Turn on each platform's age-restriction control. The per-platform setting is
  recorded in `profiles.json` under `ageGate`.
- Any paid promotion is targeted 25+, not 18+.
- No content that could appeal to minors, no depiction of consumption, nothing
  implying alcohol delivers success, courage or social acceptance.
- The negative-prompt rules in the image pack apply to social creative unchanged.

**Liquor licence number.** NSW liquor licensees are generally required to display
licence details in advertising, and the bios in `copy-pack.md` carry a
`<LICENCE NUMBER>` placeholder for it. I do not have the number and cannot look it
up. **Fill it in before publishing any bio, and confirm the exact wording your
licence conditions require** — this is the one item here where getting it wrong has
a regulatory consequence rather than a marketing one. `profiles.json` has
`brand.licenceNumber` set to `null` for the same reason.

---

## The runbook

Do it in this order. The order matters — Facebook before Instagram, because the
Instagram business account wants a Page to attach to.

1. **Decide the licence-number wording.** Everything downstream pastes it.
2. **Set up a shared brand inbox** if `sales@spirithaus.com.au` is a person's inbox.
   Nine accounts tied to one employee's mailbox is a real continuity risk. A
   dedicated `social@` alias with recovery access for two people is the fix.
3. **Facebook Page** → then **Instagram business account**, linked to it.
4. **Pinterest business account.** Then Settings → Claimed accounts → claim
   `www.spirithaus.com.au`. This is the step that turns on Rich Pins; do not skip it.
5. **YouTube channel**, handle `@spirithausau`.
6. **TikTok business account**, then **X**.
7. **Snapchat**, **Tumblr**, **Vimeo** — name claims, five minutes total.
8. For each one, as you create it: paste from `copy-pack.md`, set the age gate, and
   **update that account's `status` to `"live"` in `profiles.json`**. Record the real
   handle if you had to take a fallback.
9. Enable two-factor on all nine. Nine accounts is nine attack surfaces.

### Then wire it into the storefront

**a. The theme's social fields.** Online Store → Themes → Customise → Theme settings
→ Social media. Replace each `shopify` placeholder with the real URL from
`profiles.json`. The matching setting key is on each account as `themeSetting`.

**b. The structured data.** This is the part that actually does SEO work.

```sh
node ../tools/build-social-jsonld.mjs
```

It writes `../theme/snippets/spirithaus-social-jsonld.liquid`, then include it once
in the `<head>` of `layout/theme.liquid`:

```liquid
{% render 'spirithaus-social-jsonld' %}
```

The generator only emits accounts marked `"live"`. That is deliberate: a `sameAs`
entry pointing at a profile that does not exist yet points Google at a 404, and given
the name collision above, a near-miss URL risks associating the shop with the US
Spirit Haus instead. Run it again each time you flip a status — it is cheap and
idempotent.

Note that theme writes are blocked over the Admin API on this store — the same
constraint documented in `../theme/README.md` — so both (a) and (b) are manual edits
in the theme editor.

**c. Verify.** Once live, run the storefront through Google's Rich Results Test and
confirm the Organization block parses and every `sameAs` URL resolves.

---

## Open items — these need you

| Item | Why it is blocked |
| --- | --- |
| Liquor licence number and required wording | Not in the repo; regulatory, so it must not be guessed |
| Confirm `spirithausau` is free on each platform | No network route to the platforms from here; search data is stale |
| Whether a `social@` alias exists | Account ownership decision |
| Who owns posting, and at what cadence | Tier 1 is three accounts; unstaffed, it should be one |
