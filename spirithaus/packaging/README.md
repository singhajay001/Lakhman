# SPIRITHAUS — A4 Packaging

Two A4 portrait (210 × 297 mm) pieces for the outer carton:

- **Box label** — the functional despatch label: handling marks, 18+/ID band,
  address panel, order fields, statutory notice.
- **Box artwork** — the premium outer face. Wordmark, tagline, an oversized `U`
  bleeding off the top and right edges. No address or despatch fields.

Every PDF is single-page with fonts embedded and no external dependencies at
print time. An **editable deck** of all four designs is also provided for
PowerPoint / Google Slides.

## Editable version — Google Slides

`dist/spirithaus-box-label-artwork-A4.pptx` — four A4 slides:
label (bone), label (ink), artwork (ink), artwork (bone).

**To open in Google Slides:** upload the `.pptx` to Google Drive → right-click →
*Open with* → *Google Slides*. The page is already set to A4 portrait.

Bands, rules and every line of copy are **native editable objects**. Only the
wordmark, the three handling icons and the `U` mark are placed images — as a
logo should be. Fonts are named **Archivo** and **Space Mono**; both are in the
Google Slides font picker, so they resolve on open.

Rebuild it with `node build-deck.js` (needs `pptxgenjs`).

Why Slides and not Docs or Sheets: a label is a fixed-size layout with
positioned elements. Docs reflows and cannot hold mm-accurate placement; Sheets
is a grid, not a canvas. Slides is the only Google app with a real fixed canvas.

## Output

| File | Size | Use |
|---|---|---|
| `dist/spirithaus-box-label-a4-bone.pdf` | 210 × 297 mm | **Primary.** Ink on bone. Economical on toner — for A4 label stock or in-house laser |
| `dist/spirithaus-box-label-a4-ink.pdf` | 210 × 297 mm | Premium inverted variant. Bone on ink. For trade-printed adhesive stock |
| `dist/spirithaus-box-label-a4-bone-bleed.pdf` | 216 × 303 mm | Trade print. 3 mm bleed all round, trim 210 × 297 centred. No crop marks — the printer imposes their own |
| `dist/spirithaus-box-artwork-a4-ink.pdf` | 210 × 297 mm | **Artwork, primary.** Bone on ink |
| `dist/spirithaus-box-artwork-a4-bone.pdf` | 210 × 297 mm | Artwork, light variant |
| `dist/spirithaus-box-artwork-a4-ink-bleed.pdf` | 216 × 303 mm | Artwork, trade print with 3 mm bleed |
| `dist/spirithaus-box-label-artwork-A4.pptx` | 4 × A4 | Editable deck (see above) |

Previews: `preview/*.png` (rendered at exact trim size, 2× scale).

## Build

```sh
./build.sh          # renders all six PDFs into dist/
node build-deck.js  # rebuilds the editable .pptx
```

Requires Chromium. Override the binary with `CHROME=/path/to/chrome ./build.sh`.
Sources are `box-label-a4.html` and `box-artwork-a4.html`; variants switch on a
query string (`?v=bone`, `?v=ink`, `?v=bone-bleed`, `?v=ink-bleed`).

`assets/` holds the transparent PNG exports of the wordmark, `U` mark and
handling icons used by the deck.

`qa-render-pptx.py deck.pptx outdir/` renders a `.pptx` to PNG by reading its
packaged XML — useful for checking what actually shipped rather than what the
generator intended. (LibreOffice cannot open `.pptx` in this environment.)

## Layout

The sheet is a fixed seven-row grid that sums to exactly 297 mm, so content
cannot overflow or reflow onto a second page:

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

The address panel is deliberately the largest zone — it doubles as the clear
area for a courier's own consignment sticker.

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
