# SPIRITHAUS — A4 Packaging

Two pieces for the outer carton, each in **portrait (210 × 297 mm)** and
**landscape (297 × 210 mm)**:

- **Box label** — the functional despatch label: handling marks, 18+/ID band,
  address panel, order fields, statutory notice.
- **Box artwork** — the premium outer face. Wordmark, tagline, an oversized `U`
  bleeding off the top and right edges. No address or despatch fields.

Landscape is not a rotation — the portrait piece stacks seven bands down the
page, which does not work at 297 × 210. The landscape label is re-laid-out:
header, handling and 18+ bands run full width, then the body splits into a
large address panel on the left and the order fields on the right, with the
return address, statutory notice and licence block sharing a three-column
footer.

Every PDF is single-page with fonts embedded and no external dependencies at
print time. **Editable decks** are provided for PowerPoint / Google Slides in
both orientations.

## Editable version — Google Slides

- `dist/spirithaus-box-label-artwork-A4.pptx` — portrait
- `dist/spirithaus-box-label-artwork-A4-landscape.pptx` — landscape

Four slides each: label (bone), label (ink), artwork (ink), artwork (bone).

**To open in Google Slides:** upload the `.pptx` to Google Drive → right-click →
*Open with* → *Google Slides*. Page size is already set (A4 portrait or A4
landscape to match the file).

Bands, rules and every line of copy are **native editable objects**. Only the
wordmark, the three handling icons and the `U` mark are placed images — as a
logo should be. Fonts are named **Archivo** and **Space Mono**; both are in the
Google Slides font picker, so they resolve on open.

`node build-deck.js` rebuilds both decks (needs `pptxgenjs`).

Why Slides and not Docs or Sheets: a label is a fixed-size layout with
positioned elements. Docs reflows and cannot hold mm-accurate placement; Sheets
is a grid, not a canvas. Slides is the only Google app with a real fixed canvas.

## Print quality — pick the right variant

| Variant | Toner load | Use |
|---|---|---|
| **white** | **~2–4%** | **Office laser / inkjet.** No flood fills anywhere |
| bone | ~36–45% | Trade print, or a laser you trust |
| ink | ~57% | Trade-printed adhesive stock only |

Measured as mean toner load across a whole A4 label — how much of the sheet
the printer has to cover.

The dark bands look good from a real press and poor from an office laser: a
large solid area is where toner starves, streaks and bands, and where cheap
paper cockles. The **white** variant is not a recoloured version of the dark
one — the header, footer and 18+ band are rebuilt to carry their weight with
rules and type instead of solid fills, and the faint `U` watermark is dropped
entirely, because a light screen is the other thing a cheap laser renders as
visible dots.

Use `white` for anything printed in-house. Keep `bone` / `ink` for trade print.

## Output

| File | Size | Use |
|---|---|---|
| `dist/spirithaus-box-label-a4-white.pdf` | 210 × 297 mm | **Primary for in-house printing.** No flood fills |
| `dist/spirithaus-box-label-a4L-white.pdf` | 297 × 210 mm | Landscape, same treatment |
| `dist/spirithaus-box-label-a4-bone.pdf` | 210 × 297 mm | Ink on bone — trade print |
| `dist/spirithaus-box-label-a4-ink.pdf` | 210 × 297 mm | Premium inverted variant. Bone on ink. For trade-printed adhesive stock |
| `dist/spirithaus-box-label-a4-bone-bleed.pdf` | 216 × 303 mm | Trade print. 3 mm bleed all round, trim 210 × 297 centred. No crop marks — the printer imposes their own |
| `dist/spirithaus-box-artwork-a4-ink.pdf` | 210 × 297 mm | **Artwork, primary.** Bone on ink |
| `dist/spirithaus-box-artwork-a4-bone.pdf` | 210 × 297 mm | Artwork, light variant |
| `dist/spirithaus-box-artwork-a4-ink-bleed.pdf` | 216 × 303 mm | Artwork, trade print with 3 mm bleed |
| `dist/spirithaus-box-label-a4L-bone.pdf` | 297 × 210 mm | **Landscape label, primary.** Ink on bone |
| `dist/spirithaus-box-label-a4L-ink.pdf` | 297 × 210 mm | Landscape label, inverted |
| `dist/spirithaus-box-label-a4L-bone-bleed.pdf` | 303 × 216 mm | Landscape label, trade print |
| `dist/spirithaus-box-artwork-a4L-ink.pdf` | 297 × 210 mm | **Landscape artwork, primary.** Bone on ink |
| `dist/spirithaus-box-artwork-a4L-bone.pdf` | 297 × 210 mm | Landscape artwork, light |
| `dist/spirithaus-box-artwork-a4L-ink-bleed.pdf` | 303 × 216 mm | Landscape artwork, trade print |
| `dist/spirithaus-box-label-artwork-A4.pptx` | 4 × A4 portrait | Editable deck (see above) |
| `dist/spirithaus-box-label-artwork-A4-landscape.pptx` | 4 × A4 landscape | Editable deck (see above) |

Previews: `preview/*.png` (rendered at exact trim size, 2× scale).

## Filled labels for a real order

Order data lives in `orders/<slug>.json`; the generator fills the label and
produces a packing manifest:

```sh
python3 build-order.py orders/samreen-karan-engagement.json
```

Writes into `dist/orders/`:

| File | What |
|---|---|
| `<slug>-labels-white.pdf` | **One landscape page per carton, no flood fills — print this one in-house** |
| `<slug>-labels-bone.pdf` | Same, ink on bone (trade print) |
| `<slug>-labels-ink.pdf` | Same, inverted |
| `<slug>-manifest-white.pdf` | A4 portrait packing manifest, press-light |
| `<slug>-manifest-bone.pdf` | Same, ink bands |

The filled label replaces the blank address rules with the customer block and
an itemised **contents** list, and pre-fills the carton counter (`3 / 11`) and
the unit count. Items with no quantity render as `—` / "Qty to confirm" rather
than being guessed, and the manifest counts how many such lines exist and warns
in red.

To add an order, copy an existing JSON and edit it. Set `"qty": null` where a
quantity is genuinely unknown.

## Build

```sh
./build.sh          # renders all six PDFs into dist/
node build-deck.js  # rebuilds the editable .pptx
```

Requires Chromium. Override the binary with `CHROME=/path/to/chrome ./build.sh`.
Sources are `box-label-a4.html`, `box-artwork-a4.html` and their
`-landscape` counterparts; variants switch on a query string
(`?v=bone`, `?v=ink`, `?v=bone-bleed`, `?v=ink-bleed`).

`assets/` holds the transparent PNG exports of the wordmark, `U` mark and
handling icons used by the deck.

`qa-render-pptx.py deck.pptx outdir/` renders a `.pptx` to PNG by reading its
packaged XML — useful for checking what actually shipped rather than what the
generator intended. (LibreOffice cannot open `.pptx` in this environment.)

## Layout

### Portrait

A fixed seven-row grid summing to exactly 297 mm, so content cannot overflow or
reflow onto a second page:

```
 50mm  header band — wordmark, tagline, carton _ of _
 26mm  handling — FRAGILE · THIS WAY UP · KEEP DRY
 18mm  age/ID band (SPIRITHAUS red)
 91mm  DELIVER TO — five ruled writing lines
 30mm  order no. · despatch date · items · packed by
 44mm  return-to-sender + watermark U
 38mm  statutory notice + licence / ABN / consignment
```

In the bleed build the header grows to 53 mm and the footer to 41 mm, so the
two bands absorb the 3 mm top and bottom bleed and the trim area stays 297 mm.

### Landscape

A five-row grid summing to exactly 210 mm:

```
 42mm  header band — wordmark, tagline, carton _ of _
 24mm  handling — FRAGILE · THIS WAY UP · KEEP DRY
 16mm  age/ID band (SPIRITHAUS red)
 90mm  body — address panel (167mm) | order fields (78mm)
 38mm  footer — return address | statutory notice | licence
```

The bleed build grows the header to 45 mm and the footer to 41 mm, keeping the
trim area at 210 mm.

In both orientations the address panel is deliberately the largest zone — it
doubles as the clear area for a courier's own consignment sticker.

## Fill these in before printing

Placeholders in square brackets in `box-label-a4.html`:

- `[STREET ADDRESS]`, `[POSTCODE]`, `[PHONE]`, `[EMAIL]` — return address
- Licence No. / ABN / Consignment — left as ruled fields for overprint or
  handwriting. Hard-code the licence number and ABN if they are fixed.

## Typography

Set in **Archivo** (300/800) and **Space Mono** (400/700), embedded and
subsetted into every PDF. These stand in for the real SPIRITHAUS faces — the
wordmark is reconstructed in HTML so the file renders standalone.

**To use the real artwork instead**, replace the `.wordmark` block in the
header with the supplied SVG:

```html
<img src="spirithaus-wordmark-white.svg" style="height:13.6mm">   <!-- bone variant -->
<img src="spirithaus-wordmark-ink.svg"   style="height:13.6mm">   <!-- ink variant -->
```

The red liquid-fill `U` is also available on its own as
`../brand/assets/mark-u.svg` — pure geometry, no font needed. Its fill level
was measured off the supplied 512 px app icon: red begins 26% down the inner
bowl curve.

## Colour

`#111110` ink · `#F2EFE9` bone · `#CF1C29` SPIRITHAUS red.

PDFs are RGB. If your printer requires CMYK, convert on their end — the red
is the colour to watch, so ask for a proof rather than trusting a conversion.

## Compliance — read before printing

The footer carries a NSW `Liquor Act 2007` notice and the label reserves
prominent space for the 18+/ID requirement.

**This wording is a starting point, not legal advice.** It has not been
verified against the current Act, and requirements for licence-number display,
delivery ID checks, and unattended delivery change. Before this goes to print,
have your liquor licensing advisor confirm:

- the exact statutory warning wording required for your licence type
- whether the licence number must appear on despatch packaging, and how
- current NSW rules on ID checking and unattended alcohol delivery

Adjust the `.foot .legal` block in `box-label-a4.html` to whatever they specify.
