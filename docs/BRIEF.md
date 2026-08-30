# SPIRITHAUS — Build Brief

Single source of truth for the Shopify theme build. Save as `docs/BRIEF.md` in the repo root.

Everything in this file is confirmed and current. Where something is still open, it says so explicitly.

---

## 1. THE BUSINESS

**SPIRITHAUS PTY LTD** — ACN 701 853 483, ABN 97 701 853 483, registered NSW 28 August 2026. Sole director: Ajaypaul Singh.

Online bottle shop selling **spirits, wine and premium canned cocktails**. No beer. Around 380 SKUs. Sydney metro delivery at launch, expanding interstate as licensing lands.

Store: `1312wd-hk.myshopify.com` → `spirithaus.com.au`
Theme: **Dawn**, published. Plan: Basic.

**Positioning:** we cannot beat the chains on price, breadth or speed. We win on curation. 380 products, not 14,000. Every product carries a written paragraph explaining why it earned its place — that paragraph *is* the business model and must be visually prominent, not buried under specs.

**Interim legal structure:** dispatch runs through Trafalgar Supermarket & Cellars, Marsfield, which holds the liquor licence. Trafalgar is therefore the legal seller and its licence name and number must appear site-wide. This will change when SpiritHaus holds its own licence — so make those values schema-editable, never hardcoded.

---

## 2. BRAND SYSTEM

### Colours — exact, no substitutions

| Token | Hex | Use |
|---|---|---|
| `--sh-ink` | `#111110` | Header, footer, all body type |
| `--sh-white` | `#FFFFFF` | Type on ink |
| `--sh-red` | `#CF1C29` | **Once per view.** Primary CTA, sale price, accent rule |
| `--sh-bone` | `#F2EFE9` | Page background — never pure white |
| `--sh-muted` | `#6B6860` | Secondary text on bone |

Contrast verified: `#CF1C29` is 4.75:1 on bone (AA pass), 5.45:1 white-on-red. An earlier `#D8202E` failed at 4.39:1 — do not reintroduce it.

**Red-once rule, resolved by context:**
- Collection cards: ink figure inside a red-bordered ticket
- Product page: red figure inside a red-bordered ticket (only one price per view, so the accent isn't spent)

### Type

- **Archivo** — 300, 400, 700, 900. Prefer Shopify-hosted; **verify weight 300 exists** in the font picker first. If it doesn't, use Google Fonts — the 300/900 contrast is non-negotiable.
- **Space Mono** — 400, 700. Google Fonts with preconnect and `display=swap`.

**The typographic signature** is the light-vs-black contrast from the logo: SPIRIT at 300, HAUS at 900. Carry it into headings — light weight with the emphasis word wrapped in `<strong>` at 900.

### The signature device

Prices in Space Mono inside a bordered ticket, like a printed shelf tag. The most distinctive element in the system. Product page gets the full bordered ticket; collection cards get the mono figure, lighter treatment.

### Hard rules

No rounded corners. No drop shadows. No gradients. Square, flat, high contrast. Dawn defaults to soft edges — reset them.

---

## 3. ASSETS SUPPLIED

In `assets/`:
- `spirithaus-wordmark-mono.svg` — header logo, uses `currentColor`, inherits scheme colour
- `spirithaus-mark-dark.svg` — the U mark, for square placements
- `spirithaus-favicon-512.png`
- `spirithaus-app-icon-512.png`, `spirithaus-app-icon-180.png`

**The logo:** wordmark reading SPIRITHAUS, with SPIRIT light and HAUS black. The U in HAUS is a drawn shape, not a typed letter — its bowl is a glass filled a third with red. That's the only colour in the mark. The U alone, lifted from the wordmark, is the icon.

In `docs/`:
- `spirithaus-theme.css` — **reference only.** Written against Dawn's class names from memory, before the real source was available. Take the colours, type system, price ticket and rules as *intent*. Verify every selector against actual Dawn 16.0.0 markup and discard anything that doesn't match.
- `spirithaus-store-architecture.md` — collection and tag structure, already built in admin

---

## 4. ALREADY BUILT IN ADMIN — DO NOT RECREATE

**Metafields**, namespace `custom`, all with Storefront API access:

```
custom.abv                (decimal)
custom.volume_ml          (integer)
custom.country            (single line text)
custom.region             (single line text)
custom.producer           (single line text)
custom.style              (single line text)
custom.why_we_stock_it    (multi-line text)
```

**Collections** — 24 automated, tag-driven: Spirits, Whisky, Gin, Agave, Tequila, Rum, Liqueurs & Aperitifs, Vodka, Wine, Red, White, Sparkling, Rosé, Fortified & Dessert, Cocktails, Canned Cocktails, Premium & Collabs, Low & No, Australian Made, Under $50, Gifting, New This Month, Staff Picks.

**Settings** — AUD, GST-inclusive pricing, kg, Sydney timezone, order prefix `SH-`. Shopify Payments active and **confirmed approved for alcohol**.

**Known state issue:** theme colour schemes currently use the old `#D8202E` for buttons. The owner will update these to `#CF1C29` in the admin. Don't work around it in CSS.

---

## 5. BUILD SCOPE

Five stages. **Stop for review after each.**

### Stage 1 — Stylesheet
`assets/spirithaus.css`, linked in `layout/theme.liquid` before `</head>`, loading after Dawn's CSS.

Bone body, ink header and footer, square red buttons with Dawn's shadow layer removed, mono price tickets, mono facet and badge labels, square form fields, global radius and shadow reset.

### Stage 2 — Product page
Three new block types added via `{% case block.type %}` branches plus `templates/product.json` `block_order`. Do not restructure `main-product.liquid`.

Final order:

```
media → title → price ticket → why_we_stock_it → variant picker →
quantity → buy buttons → delivery_estimate → description →
spec_table → related products
```

**Why this order:** see the price, read why it's worth it, then choose and buy. Selection controls between price and justification inverts the funnel.

- `why_we_stock_it` — red left rule, mono uppercase label, generous type
- `spec_table` — definition list from the remaining metafields, rendering only fields with values
- `delivery_estimate` — static, schema-editable line

### Stage 3 — Compliance
**Footer block**, site-wide, with schema-editable licence name and number, the NSW under-18 warning, and a photo-ID-on-delivery line.

**Age gate**, in-theme, no app:
- Overlay on rendered HTML — never blank the page. A JS gate that hides content can suppress indexing of all 380 products.
- Focus-trapped, keyboard navigable, no Escape-to-dismiss
- Cookie expiry 30 days
- "No" path goes to `drinkwise.org.au`, not a dead end
- **Do not gate** Terms, Privacy, or Responsible Service of Alcohol — those must be reachable
- Comment it as entry-level only; checkout-level verification comes from a separate app

### Stage 4 — Homepage sections
Each with proper `{% schema %}` so they're configurable in the theme editor:
- **Hero** — full-bleed image, ink overlay, light/black heading contrast, one red CTA
- **Three categories** — Spirits, Wine, Cocktails as large tiles
- **Curation statement** — the "380 not 14,000" story, type only, no image
- **Staff picks** — carousel from the `staff-picks` collection

### Stage 5 — Collection page
Branded filters, flat bordered cards without shadow, mono price. Collection description above the grid.

---

## 6. CONSTRAINTS

- **Dawn.** Additive and low-collision. New files wherever possible. Only three surgical edits to Dawn-owned files: `theme.liquid`, `main-product.liquid` case branches, `product.json` block order. Show the diff for each of those specifically — they're the merge-conflict risk.
- **No paid apps.** In-theme where possible.
- **Australian English** throughout. Prices GST-inclusive.
- **Mobile first.** Most traffic is phones. Test every section at 375px.
- **Accessibility.** Real contrast ratios, keyboard navigation, proper alt text. Don't let ink-on-bone drop below WCAG AA.
- **Performance.** No heavy JS. Dawn is fast; keep it that way.
- **No `!important`** unless specificity has been tried and genuinely fails.

---

## 7. ALCOHOL RETAIL — NON-NEGOTIABLE

This store sells alcohol in Australia. Do not build anything that:

- Encourages rapid or excessive consumption — no "get on it", no countdown timers on alcohol, no bulk-buy urgency
- Uses fake scarcity or inflated RRP strikethroughs
- Could appeal to under-18s in imagery or tone

These aren't stylistic preferences. They're ABAC and state liquor advertising requirements, and Meta's ad policy enforces them too.

**Copy tone:** plain, knowledgeable, unpretentious. "The best $45 gin in the country" — never tasting-note poetry.

---

## 8. WORKING AGREEMENT

- **Never push to the published theme.** Work against a duplicate. The owner reviews and publishes.
- Stop at the review gate after each of the five stages.
- Show the diff for each Dawn-owned file edit.
- Commit to git as you go, clear messages.
- **If something here is wrong, ambiguous, or you'd do it differently — say so before building it.** Pushback is wanted, not tolerated.
