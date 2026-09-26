# Spirithaus — image queue

**Date:** 2026-09-26. Spirithaus only.
**Worksheet:** `seo/spirithaus/worksheets/image-queue-2026-09-26.csv` — 394 rows.

One queue covering both the drafts already in the store and the products from
the ALM top-sellers list, ordered so that stopping at any point still leaves
you in a good place.

## The order, and why

| Priority | Count | What | Why here |
|---|---:|---|---|
| **P1** | 49 | To add — ALM **top 3** in segment | Proven national volume. These sell. |
| **P2** | 154 | Every existing draft | Already costed and priced. One image each and they go live. |
| **P3** | 77 | To add — ALM top 4–8 | |
| **P4** | 114 | To add — ALM top 9–12 | |

**P1 before P2** because ALM rank is the only real volume signal in any of
this, and a top-3 seller earns faster than a fine wine nobody is searching
for yet. **P2 before P3** because those 154 are fully built apart from the
image — no cost to find, no price to set, nothing to create.

If you only get through P1 and P2, that is 203 images and it converts 154
drafts into live pages plus the 49 fastest-moving lines in the country.

## Only the image is yours

All 154 drafts also lack body copy and SEO fields, but those are mine to
write, not yours to supply. I will do them so that the moment an image lands
the product can be published. **Filename 02, the back label, is optional** —
useful for the standard-drinks and ABV panel, but never a blocker.

## Filenames are exact

Save to the filename in the sheet, character for character. They are
pre-computed in the store's existing convention, and they are what the upload
matches on.

Names were cleaned from ALM's abbreviations first, since `JAMESON IRISH WSKY
700ML` is not something you can search an image against:

| ALM | Sheet |
|---|---|
| `JAMESON IRISH WSKY 700ML` | Jameson Irish Whisky 700mL |
| `JIM BEAM WHITE LBL BRBN 37% 1L` | Jim Beam White Label Bourbon 37% 1L |
| `CAPT MORGAN SPICED GOLD 1L` | Captain Morgan Spiced Gold 1L |
| `BUNDY UP&COLA 4.6% CUBE 375ML` | Bundaberg Up and Cola 4.6% Cube 375mL |
| `BACARDI CARTA BLANCA N 1L` | Bacardi Carta Blanca 1L |

**Five filename collisions were found and fixed.** Two different products were
resolving to the same filename — `bacardi-carta-blanca-1l-01.jpg`,
`bombay-sapphire-gin-700ml-01.jpg`, `patron-silver-700ml-01.jpg` and two more.
Saving both would have lost one silently. The later of each pair now carries
its ALM item code in the filename. The sheet is asserted to contain no
duplicates.

## One thing to ignore in the Price column

**Four multipack lines have a blank price** — Bundaberg Up and Cola cube, Jack
Daniel's & Cola 10-pack and two others. Their ALM cost is per carton or cube,
not per can, so the 25% retail calculation would have been wrong by an order
of magnitude. Blanked rather than shown wrong; I will price them by hand when
the products are created. The image is still worth taking.
