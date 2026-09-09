# SPIRITHAUS — Campaign Visual Specification

Production-ready creative direction for the SPIRITHAUS campaign: 16 commercial
advertising frames built to look like one shoot, one lighting setup, one day.

> **Status:** specification only. This repository contains the creative system
> and the locked generation specs. It does **not** contain rendered `.jpg`
> assets — those are produced by running the specs through an image generation
> model or by shooting them, then dropped into `assets/` under the exact
> filenames in the manifest.

## Contents

```
spirithaus/
├── brand/
│   ├── visual-system.md     # The single source of truth. Read first.
│   ├── style-block.md       # Shared STYLE + NEGATIVE strings
│   └── qc-checklist.md      # Accept/reject gate for every frame
├── prompts/
│   ├── hero/                # 9 hero banners  (left-third safe zone)
│   ├── tiles/               # 3 category tiles (centre-third safe zone)
│   └── lifestyle/           # 4 lifestyle frames
└── specs/
    └── asset-manifest.json  # Filenames, dimensions, safe zones, serve counts
```

## How to produce an asset

1. Open the spec for the filename you need, e.g.
   `prompts/hero/hero-whisky.jpg.md`.
2. Take the fenced **Prompt** block and append the **STYLE** string from
   `brand/style-block.md`. Aim for one continuous paragraph.
3. Take the **NEGATIVE** string from `brand/style-block.md` and append the
   asset-specific additions listed under the spec's Negative heading.
4. Render at the dimensions in `specs/asset-manifest.json` — at least 4K on
   the long edge, 8K preferred.
5. Run `brand/qc-checklist.md` against the result. Any single failure means
   regenerate, not retouch.
6. Save under the exact manifest filename.

## Why the bottles have no labels

Every bottle in this campaign is bare — clear, smoke or amber glass with wax,
foil, or a plain uninked band. This is deliberate. It keeps the imagery free of
brand, trademark, and text-rendering artefacts, it is legally reusable across
every category page, and it makes the *category* the hero rather than any single
product. Treat it as a campaign device, not a limitation.

## The three rules that hold the campaign together

1. **One directional warm key, deep shadow.** Every frame. No exceptions,
   no fill light, no bright catalogue lighting. This is the through-line.
2. **The safe zone is structural.** A hero with anything in the left third, or
   a tile with anything in the centre band, is a failed frame — it cannot be
   fixed in post without breaking the lighting logic.
3. **The product is never being consumed.** Two frames in sixteen contain a
   prepared drink, both untouched. Everything else is craft, ingredient, shelf,
   tool, or despatch.

## Safe-zone verification

Do not eyeball it. Sample the reserved region and confirm it sits at or below
15 IRE with no specular highlights:

```sh
# hero: left third must be dark and flat
magick hero-whisky.jpg -crop 33.33%x100%+0+0 -format "mean=%[fx:mean*100] max=%[fx:maxima*100]" info:

# tile: centre horizontal band must be dark and flat
magick tile-gin.jpg -crop 100%x33.33%+0+853 -format "mean=%[fx:mean*100] max=%[fx:maxima*100]" info:
```

Reject if `max` exceeds ~15.
