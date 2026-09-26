# Copy pack — paste-ready profile text

Every field below is inside its platform's character limit, counted, with the count
shown. Voice follows the storefront: plain, specific, no hype — the hero says *"We
cannot beat the chains on price or breadth, so we do not try. Every bottle here
earned its place, and we tell you why."* Keep that register.

**Licence details are real and already in place below.** SPIRITHAUS holds **NSW
Packaged Liquor Licence No. LIQP700301260**, held by Trafalgar Cellars of Marsfield;
the seller of record is SPIRITHAUS PTY LTD, ABN 97 701 853 483. These were taken
from the storefront's own policy pages, which all carry the same number — not
transcribed from anywhere else. The long and short forms are in `profiles.json`
under `brand.licence`.

Run `node ../tools/check-copy-pack.mjs` after any edit here: it re-measures every
field against its platform limit and fails if a bio has grown past one. A bio that
overruns gets truncated by the platform, and the licence number is last in the
line — so it is the first thing to disappear.

Handle on every platform: **`spirithausau`** (fallback ladder in `profiles.json`).

---

## Instagram — Tier 1

**Name** (28 / 30) — this field is searchable, so it carries the category word:

```
SPIRITHAUS | Spirits, Sydney
```

**Bio** (137 / 150):

```
Online spirits shop, Sydney.
Every bottle chosen. Every one explained.
Tasting notes, not marketing. 18+
NSW Liquor Licence LIQP700301260
```

**Link:** `https://www.spirithaus.com.au`
**Category:** Wine, Beer & Spirits Store · **Age restriction:** 18+, Australia

---

## Pinterest — Tier 1

**Display name:**

```
SPIRITHAUS — Spirits, Wine & Cocktails
```

**About** (354 / 500):

```
An online spirits shop in Sydney for people who want to know what they are
buying. We cannot beat the chains on price or breadth, so we do not try —
every bottle we stock earned its place, and we tell you why.

Tasting notes, cocktail method, and what a bottle is actually for.
Australia-wide delivery. 18+ only.
NSW Packaged Liquor Licence LIQP700301260
```

**Website:** `https://www.spirithaus.com.au` — then **claim the domain** under
Settings → Claimed accounts. Rich Pins do not work until you do.

**Starter boards** — build these as evergreen search surfaces, not a feed:

| Board | Why |
| --- | --- |
| Cocktails, three ingredients or fewer | Highest-intent evergreen search on Pinterest |
| What to buy: whisky | Maps to a category page |
| What to buy: gin | Maps to a category page |
| Bottle explained | The house differentiator, in pin form |
| Home bar, small kitchen | Non-product reach |

---

## YouTube — Tier 1

**Channel name:** `SPIRITHAUS` · **Handle:** `@spirithausau`

**Description** (623 / 1000):

```
SPIRITHAUS is an online spirits shop based in Sydney, delivering Australia-wide.

We cannot beat the chains on price or breadth, so we do not try. Every bottle we
stock earned its place, and this channel is where we explain why — tasting notes,
what a bottle is actually for, and how to use it.

No sponsored reviews. No bottles we do not sell.

Shop: https://www.spirithaus.com.au
18+ only. Please drink responsibly.
NSW Packaged Liquor Licence LIQP700301260, held by Trafalgar Cellars of Marsfield.
It is against the law to sell or supply alcohol to, or to obtain alcohol on behalf of, a person under the age of 18 years.
```

Set **per-video age restriction** on anything showing a pour.

---

## TikTok — Tier 2

**Name** (10 / 30): `SPIRITHAUS`

**Bio** (70 / 80):

```
Sydney spirits shop. Every bottle explained.
18+ NSW Lic LIQP700301260
```

**Link:** `https://www.spirithaus.com.au`

Business account. Alcohol is prohibited in TikTok paid ads and on TikTok Shop —
organic only, age-gated.

---

## X — Tier 2

**Name** (10 / 50): `SPIRITHAUS`

**Bio** (142 / 160):

```
Spirits, wine and cocktails, online from Sydney. Every bottle here earned its place, and we tell you why. 18+ NSW Liquor Licence LIQP700301260
```

**Location:** Sydney, Australia · **Link:** `https://www.spirithaus.com.au`

Mark the account as containing alcohol-related content under Privacy and safety.

---

## Facebook — Tier 2

**Page name:** `SPIRITHAUS` · **Username:** `@spirithausau`
**Category:** Wine, Beer & Spirits Store

**Short description** (182 / 255):

```
Online spirits, wine and cocktails from Sydney. Every bottle chosen, every one explained. 18+ only. NSW Packaged Liquor Licence LIQP700301260, held by Trafalgar Cellars of Marsfield.
```

Page settings → Age restrictions → **18+, Australia**. Create this before the
Instagram account so Instagram can attach to it.

---

## Snapchat — Tier 3, name claim only

**Display name:** `SPIRITHAUS` · **Bio** (67 / 80):

```
SPIRITHAUS — online spirits shop, Sydney.
18+ NSW Lic LIQP700301260
```

Public Profile, age gate 18+. Then leave it alone.

---

## Tumblr — Tier 3, name claim only

**Blog title:** `SPIRITHAUS` · **URL:** `spirithausau.tumblr.com`

**Description:**

```
Online spirits shop, Sydney. Every bottle chosen. Every one explained.
spirithaus.com.au — 18+ only.
NSW Packaged Liquor Licence LIQP700301260.
```

---

## Vimeo — Tier 3, name claim only

**Name:** `SPIRITHAUS` · **URL:** `vimeo.com/spirithausau`

**Bio:**

```
Online spirits shop, Sydney. Every bottle chosen. Every one explained.
spirithaus.com.au — 18+ only.
NSW Packaged Liquor Licence LIQP700301260.
```

Free tier. Do not build a video library here; that is YouTube's job.

---

## Profile images

Do not commission anything new. The brand already has what it needs:

- **Avatar** — the wordmark on ink `#111110`, exported square. It must stay legible
  at 32 px; at that size a full lockup will not, so use the monogram if the wordmark
  fails the test.
- **Cover / banner** — take a frame from `../calibration/hero/`. Those are already
  shot to the ABAC constraints and to the brand's low-key direction, and they have a
  quiet bottom half by construction, which is exactly where every platform puts its
  overlay furniture. `hero-whisky-shelf-a.png` and `hero-gin-botanicals.png` are the
  safest crops.
- **Palette** — ink `#111110`, bone `#F2EFE9`, red `#CF1C29`. No fourth colour.
- **Type** — Archivo for display, Space Mono for the uppercase kicker.

Anything generated new for social goes through `../image-prompt-pack.md`, which
already carries the ABAC rules as hard constraints. Scenes only — never a packshot,
for the reason given at the top of that file.
