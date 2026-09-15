# SPIRITHAUS — A4 Packaging Box Label

Print-ready despatch label for the outer carton. A4 portrait (210 × 297 mm),
single page, fonts embedded, no external dependencies at print time.

## Output

| File | Size | Use |
|---|---|---|
| `dist/spirithaus-box-label-a4-bone.pdf` | 210 × 297 mm | **Primary.** Ink on bone. Economical on toner — for A4 label stock or in-house laser |
| `dist/spirithaus-box-label-a4-ink.pdf` | 210 × 297 mm | Premium inverted variant. Bone on ink. For trade-printed adhesive stock |
| `dist/spirithaus-box-label-a4-bone-bleed.pdf` | 216 × 303 mm | Trade print. 3 mm bleed all round, trim 210 × 297 centred. No crop marks — the printer imposes their own |

Previews: `preview/*.png` (rendered at exact trim size, 2× scale).

## Build

```sh
./build.sh          # renders all three PDFs into dist/
```

Requires Chromium. Override the binary with `CHROME=/path/to/chrome ./build.sh`.
Source is `box-label-a4.html`; variants switch on a query string
(`?v=bone`, `?v=ink`, `?v=bone-bleed`, `?v=ink-bleed`).

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
