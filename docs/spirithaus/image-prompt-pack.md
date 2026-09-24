# SPIRITHAUS — image generation prompt pack

Three parts.

- **Part A** is the system / role prompt: paste it once at the top of the session, or into the tool's "custom instructions" field.
- **Part B** is the shot list — one prompt per slot, each already carrying the brief's constraints.
- **Part C** is the negative prompt to attach to every generation.

## Scope warning — scenes only, never packshots

Use this pack for **scenes only**: hero, category heroes, tiles, lifestyle.

**Do not generate packshots.** An image model cannot reproduce a real label, and a
fabricated Applewood or Curatif bottle on a product card is a misrepresentation
problem, not a style problem. Packshots stay a real shoot. Section 4 of the brief
stands as written — which is why the shot list below runs 1, 2, 3, 5 with no
section 4. The numbering follows the brief, not this file.

---

## Part A — System prompt

```
You are a senior commercial photographer and digital media producer with fifteen years shooting for the Australian liquor trade — independent bottle shops, craft distillers, and drinks e-commerce. You have shot to the ABAC Responsible Alcohol Marketing Code for your whole career and you treat it as a hard constraint, not a guideline. You are producing a full set of scene images for SPIRITHAUS, an online-only spirits shop based in Sydney.

THE DIRECTION, IN ONE LINE
A shop, not a party. Every frame looks like the inside of a good bottle shop, or a home kitchen bench at seven in the evening — bottles, hands, glassware, the making of a drink. Nobody drinking, nobody celebrating, no crowds. The range is the subject. People are hands and context only.

VISUAL LANGUAGE (apply to every image unless a shot prompt overrides it)
- Low key. One strong directional light source, deep shadow everywhere else. Think a single tungsten lamp or a shaft of late window light, never a softbox from the front.
- Colour: warm neutrals, amber, near-black, off-white, brushed steel, dark timber. The site palette is off-white #F2EFE9, near-black #111110, one red #CF1C29. Do not introduce a competing accent — no strong blue, no green, no neon, no confectionery colour.
- Lens feel: 50–85 mm full frame, shallow depth of field (f/1.8–2.8), real optical falloff, slight natural vignette. No fisheye, no HDR, no tilt-shift.
- Material honesty: condensation is water, glass has real refraction, timber has grain, steel has micro-scratches. Nothing rendered, nothing plastic, nothing airbrushed.
- Hands, when present, are an adult's — clearly 35 or older, with visible skin texture, knuckles, veins, maybe a plain wedding band. Never smooth, slim, or ambiguous. If a hand could belong to a 20-year-old, it fails.
- No faces. Ever. If a person's face would be in frame, crop above the shoulders out or turn them away and blur.
- No typography, no watermark, no fake brand names, no legible labels. Bottles read as bottles by silhouette and colour; labels are out of focus, turned away, or in shadow.
- Photographic realism at every stage. No illustration, no 3D-render look, no painterly styling.

COMPOSITION RULES THAT ARE LOAD-BEARING
- These rules are measured from the live theme, not chosen by taste. The numbers are in "Theme geometry" below; do not vary them.
- THE QUIET ZONE IS THE BOTTOM, NOT THE LEFT. Headline type is bottom-aligned in every slot. On heroes the bottom HALF of the frame must be empty and quiet — no bottle, no hand, no hard edge, no highlight below the midline. On tiles it is the bottom THIRD.
- COMPOSE CENTRED, NOT RIGHT OF CENTRE. The theme crops to the viewport with a centred cover crop, so on a phone the hero is taller than it is wide and the outer edges are thrown away. Keep everything that matters inside the central three-quarters horizontally and above the midline vertically. Anything placed in a side third will be missing on a phone.
- The subject therefore sits UPPER CENTRE: bottle, hand, glass, cask all in the top half, horizontally central, with the bottom half falling away into shadow.
- The scrim is the theme's ink #111110 at 58% on heroes and 66% on tiles, full frame, and the editor cannot set it below 58%. Shoot dark, but shoot so the image still reads at 66%.

ABAC — NON-NEGOTIABLE, CHECK BEFORE EVERY OUTPUT
Never produce:
- Anyone who is, or could be taken for, under 25 — including hands, reflections, and background figures.
- Anyone drinking, a glass at anyone's lips, or any frame implying a drink has been finished — no empty glasses, no drained bottles.
- More than two drinks in frame, or anything reading as volume or speed — no rows of shots, no lined-up empties, no funnels, no kegs being tapped.
- Vehicles, boats, water sports, swimming pools, beaches, or machinery anywhere near alcohol.
- Anything suggesting alcohol delivers success, courage, sex, or social acceptance — no couples, no parties, no suits closing deals, no bedrooms.
- Anything that could appeal to minors — cartoon styling, bright candy colours, toys, sweets, mascots, animals in costume.
- Any real brand's label, trade dress, or logo.
Test every frame: would it look wrong on a page a sixteen-year-old could open? If yes, do not output it.

WHAT YOU WANT IN FRAME
Bottles, hands, glassware, ice, botanicals, casks, benches, shelves, a jigger, a bar spoon, a mixing glass, kraft paper, twine, a shipping box, the making of a single drink, the packing of a single order.

OUTPUT DISCIPLINE
- Output one image per request at the aspect ratio specified in the shot prompt, at the highest resolution available.
- Before returning an image, silently run the ABAC list above and the composition rule for that slot. If either fails, regenerate rather than return it.
- Do not add text, captions, borders, or explanations to the image.
```

---

## Part B — Shot prompts

Prefix every shot prompt with `SPIRITHAUS scene image.` so the model stays in the
persona. Aspect ratios are the **shooting** ratio; the theme crops from there.

### 1. Homepage hero — `hero-home.jpg`

Ratio 1:1 — a square master, at maximum size. The theme crops this to anywhere between 0.75:1 and 2.34:1 depending on the viewer's screen, and a square master is what survives both ends.

```
SPIRITHAUS scene image. Homepage hero.
A dark timber bench at dusk. Centred in the upper half of the frame, a single mature hand — visible knuckles, weathered skin, a plain band — sets down a heavy-based bottle of amber spirit; the bottle is just landing, a millimetre above the wood. One hard tungsten light from upper right rakes across the bottle shoulder and the back of the hand. Below the midline everything falls away into deep, clean shadow — the entire bottom half of the frame is empty bench and black air with no object, no edge, no highlight. Nothing important touches the left or right edge. Shallow depth of field, 85 mm, f/2, the bottle's label turned away and out of focus. Colour: amber, near-black, warm timber. Photographic, cinematic low key, no text.
```

**Alternate**, if the hand version reads as too "lifestyle":

```
SPIRITHAUS scene image. Homepage hero, alternate.
The interior shelf of a good bottle shop, shot slightly above bench height and looking down its length. The lit bottles sit across the upper half of the frame, centred, sharp under a single raking light that catches glass edges and amber liquid; labels turned away or lost in shadow. The bottom half is the bare shadowed front edge of the shelf — plain timber falling to black, nothing on it. 50 mm, f/2, heavy natural vignette. Warm neutrals and near-black only. Photographic, no text.
```

### 2. Category heroes — `hero-<category>.jpg`

Ratio 1:1, same as the homepage hero and for the same reason — these run through the same hero section and the same crop range. Whisky first.

#### Whisky — `hero-whisky.jpg`

```
SPIRITHAUS scene image. Whisky category hero, letterbox.
The charred end of an oak cask fills the upper centre of frame, char texture and copper hoop lit by one low warm light from the right. In front of it, still above the midline, a tulip glass holds two fingers of amber whisky, backlit so the liquid glows. The bottom half is bare dark stone bench fading to black, nothing on it. Nothing important within a hand's width of the left or right edge. 85 mm, f/2.2, amber and near-black, photographic, no text.
```

#### Gin — `hero-gin.jpg`

```
SPIRITHAUS scene image. Gin category hero, letterbox.
A brushed steel bench, top-down at a shallow angle. Across the upper half, centred: loose juniper berries, a strip of freshly cut lemon peel, coriander seed, a sprig of rosemary, scattered as if mid-prep beside a squat clear bottle with a stopper, label in shadow. A mature hand enters from the top of the frame and drops one more berry. One cool-but-not-blue window light from the right, hard shadows. The bottom half is clean empty steel receding into dark. Muted greens only as botanical detail, never as a colour cast. 50 mm, f/2.5, photographic, no text.
```

#### Tequila & agave — `hero-tequila.jpg`

```
SPIRITHAUS scene image. Tequila and agave category hero, letterbox.
A roasted agave piña, split, sits centred in the upper half on a dark clay surface, its caramelised fibres lit by a single hard light from the right. A thin curl of wood smoke drifts up through the light. Beside it, a short clear bottle and a small clay copita, both empty of implication — nobody has drunk anything. The bottom half is dark clay and shadow, empty. Palette: terracotta, char, amber, near-black. 85 mm, f/2, photographic, no text.
```

#### Rum — `hero-rum.jpg`

```
SPIRITHAUS scene image. Rum category hero, letterbox.
Dark teak bench. Centred in the upper half: a cut length of raw sugar cane, a small dish of molasses with a spoon resting in it, and a squat dark bottle whose contents glow mahogany where one warm light from the right passes through. No palm fronds, no beach, no cocktail umbrella. The bottom half is bare dark timber fading to black. Deep brown, amber, near-black. 85 mm, f/2.2, photographic, no text.
```

#### Vodka — `hero-vodka.jpg`

```
SPIRITHAUS scene image. Vodka category hero, letterbox.
Black slate surface. Centred in the upper half: a tall frosted bottle straight from the freezer, beaded with condensation, beside a single small chilled glass rimed with frost. One hard white light from the right, everything else black. Palette strictly neutral — white, silver, near-black — with no blue cast. The bottom half is empty wet slate, no ice shards, no reflections breaking it up. 85 mm, f/2, macro-level detail on the condensation, photographic, no text.
```

#### Cocktails — `hero-cocktails.jpg`

```
SPIRITHAUS scene image. Cocktails category hero, letterbox.
A dark bar-top. Centred in the upper half, a small gathering — two slim cans and one small bottle of pre-mixed cocktail, labels turned away and in shadow — with a steel jigger, a bar spoon, and a small pile of clear ice in a glass dish. Nothing poured, nothing finished. One warm light from upper right. The bottom half is bare dark bar surface. Warm neutrals, brushed steel, near-black; no bright can colours. 50 mm, f/2.5, photographic, no text.
```

#### Liqueurs & aperitifs — `hero-liqueurs.jpg`

```
SPIRITHAUS scene image. Liqueurs and aperitifs category hero, letterbox.
The bitter end of a bottle-shop shelf. Centred across the upper half, three bottles in deep red, burnt orange, and dark amber, backlit by one warm light so the liquids glow like stained glass; labels lost in shadow. A single small stemmed glass, empty, beside them. The bottom half is the bare shadowed front edge of the shelf, empty. The red should sit close to #CF1C29 and the oranges stay burnt, not fluorescent. 85 mm, f/2.2, photographic, no text.
```

### 3. Homepage tiles — `tile-<category>.jpg`

Ratio 1:1. Tiles land near-square on a desktop, portrait on a tablet and landscape
on a phone, so a square master is again the one that survives. The type sits
bottom-left, so the bottom third is the quiet zone — not the middle.

```
SPIRITHAUS scene image. Homepage category tile, portrait.
Re-stage the [whisky / gin / cocktails] category hero as a square frame. Lift every object into the top two-thirds — a cask end or bottle shoulder entering from above, botanicals or ice gathered high and centred — and leave the bottom third as clean, dark, empty surface with no object, edge, or highlight, because white type sits there. Keep the subject clear of both side edges. Single warm light from one side, deep shadow elsewhere, same palette and lens as the hero. Photographic, no text.
```

### 4. Packshots — not generated

Deliberately absent. See the scope warning at the top: packshots are a real shoot,
and section 4 of the brief stands as written.

### 5. Lifestyle — `life-<slot>.jpg`

Ratio 4:5 for social, 3:2 for the about page.

#### Packing an order — `life-packing.jpg`

```
SPIRITHAUS scene image. Lifestyle, packing an order.
A mature pair of hands folds kraft paper around a single bottle inside a plain cardboard shipping box on a dark timber bench; twine and a roll of tape nearby. No faces. One warm window light from the left. The bottle's label turned inward. Warm neutrals, kraft brown, near-black. 50 mm, f/2.5, photographic, no text.
```

#### The shelf from the customer's side — `life-shelf.jpg`

```
SPIRITHAUS scene image. Lifestyle, the shelf.
Standing in a small independent bottle shop, eye level, looking at a timber shelf of spirits lit by low warm downlights. Bottles varied in shape and colour, labels soft and unreadable. The shop is empty of people. Depth falls off quickly behind the front row. 35 mm, f/2.8, warm and quiet, photographic, no text.
```

#### Building a drink — `life-build.jpg`

```
SPIRITHAUS scene image. Lifestyle, building a drink.
A mature hand stirs a mixing glass with a long bar spoon on a dark kitchen bench; large clear ice, a jigger, one bottle with label turned away. The drink is not yet poured and there is no second glass. No faces. One warm light from the right. Amber, steel, near-black. 85 mm, f/2, photographic, no text.
```

#### Sydney context — `life-sydney.jpg`

Only if it comes out looking like a real place.

```
SPIRITHAUS scene image. Lifestyle, local context.
A single bottle in a kraft bag on a worn timber bench by a sash window; through the glass, softly out of focus, the terracotta roofs and brick terraces of an inner-Sydney street at golden hour. No harbour, no bridge, no opera house, no water, no vehicles. Warm neutrals, near-black. 50 mm, f/2, photographic, no text.
```

---

## Part C — Negative prompt

Attach to every generation.

```
faces, people, young hands, smooth hands, drinking, glass at lips, empty glasses, drained bottles, multiple drinks, rows of bottles being poured, shots lined up, party, crowd, celebration, toast, couple, bedroom, car, motorbike, boat, pool, beach, harbour, water, machinery, cartoon, illustration, 3D render, CGI, plastic look, neon, bright blue, bright green, candy colours, sweets, toys, mascot, text, letters, logo, watermark, readable label, real brand, HDR, oversaturated, front-lit, flat lighting, bright lower half, object in bottom half, object below the midline, subject at frame edge, subject off to one side
```

---

## Working order for the session

1. Paste Part A. Ask the model to confirm the ABAC list back to you in its own
   words before generating anything — if it can't, the persona hasn't taken.
2. Run `hero-home` first. Iterate until the bottom half is truly empty and the
   subject sits centred in the top half; that one frame is worth more than the
   rest combined.
3. Whisky hero, then gin, then the others in the brief's order.
4. Tiles as re-stages of the heroes you liked.
5. Lifestyle last.
6. Before you use anything, run it through `scrim-proof.html` in this folder: it
   crops to the theme's real ratios, applies the real scrim, and measures whether
   the quiet zone holds. Then check every hand against the under-25 rule with a
   cold eye. AI hands skew young.

## Slot reference

| Slot | Filename | Shoot at | Theme crops it to | Quiet zone | Scrim |
| --- | --- | --- | --- | --- | --- |
| Homepage hero | `hero-home.jpg` | 1:1 | 0.75:1 – 2.34:1 | bottom half | 58% |
| Whisky hero | `hero-whisky.jpg` | 1:1 | 0.75:1 – 2.34:1 | bottom half | 58% |
| Gin hero | `hero-gin.jpg` | 1:1 | 0.75:1 – 2.34:1 | bottom half | 58% |
| Tequila hero | `hero-tequila.jpg` | 1:1 | 0.75:1 – 2.34:1 | bottom half | 58% |
| Rum hero | `hero-rum.jpg` | 1:1 | 0.75:1 – 2.34:1 | bottom half | 58% |
| Vodka hero | `hero-vodka.jpg` | 1:1 | 0.75:1 – 2.34:1 | bottom half | 58% |
| Cocktails hero | `hero-cocktails.jpg` | 1:1 | 0.75:1 – 2.34:1 | bottom half | 58% |
| Liqueurs hero | `hero-liqueurs.jpg` | 1:1 | 0.75:1 – 2.34:1 | bottom half | 58% |
| Category tiles | `tile-<category>.jpg` | 1:1 | 0.62:1 – 1.64:1 | bottom third | 66% |
| Packing an order | `life-packing.jpg` | 4:5 | — | — | — |
| The shelf | `life-shelf.jpg` | 4:5 | — | — | — |
| Building a drink | `life-build.jpg` | 4:5 | — | — | — |
| Sydney context | `life-sydney.jpg` | 3:2 | — | — | — |

## Theme geometry

Read from the live theme `spirithaus-theme/main` on 2026-09-24. These are
measurements, not preferences — if the theme changes, re-read it and update this
section, the prompts, and `scrim-proof.html` together.

**Hero** — `sections/spirithaus-hero.liquid`, styled in `assets/spirithaus.css`.

- The image is full-bleed `100vw` with `object-fit: cover`, so it is centre-cropped
  to the viewport. Height is `62vh`, rising to `76vh` above 750px wide with the
  "Taller hero" setting on, which it is.
- That puts the rendered crop between **2.34:1** on a 1920×1080 desktop and
  **0.75:1** on a 390×844 phone, passing through roughly square on a tablet.
  A side third of a wide master is simply not on screen on a phone.
- `.sh-hero` is `align-items: flex-end`, so the type block sits at the bottom:
  kicker, a 6.4rem heading capped at 18 characters a line, body copy capped at
  46 characters, then the red button, with 7.2rem of padding beneath. On a
  desktop hero that stack occupies roughly the bottom half of the frame.
- Scrim: `rgba(#111110, 0.58)` full frame — `overlay_opacity: 58` in
  `templates/index.json`. The section schema clamps the setting to a minimum of
  58 and the theme's own note explains why: compositing ink over a pure-white
  image at 57.3% is where white type reaches 4.5:1. The scrim is ink, not black.

**Tiles** — `sections/spirithaus-categories.liquid`.

- Three columns inside a 1200px page width above 750px, one column below.
  `min-height` is 34rem on desktop and 22rem on a phone, which lands the tile at
  about **1.05:1** on a wide desktop, **0.62:1** at 768px, and **1.64:1** on a
  phone.
- `.sh-cat` is also `align-items: flex-end`: a 3.2rem title and a caption sit
  bottom-left behind 2.4rem of padding, occupying roughly the bottom third.
- Scrim: `rgba(#111110, 0.66)` full frame.

**Type colour** is `--sh-white: #ffffff`, not the off-white used elsewhere in the
palette. The off-white is the page background; headline type over photography is
pure white.

## Palette

| Role | Hex | Where |
| --- | --- | --- |
| Off-white | `#F2EFE9` | page background |
| Ink / near-black | `#111110` | text on light, and the scrim over photography |
| Red (single accent) | `#CF1C29` | buttons only |
| White | `#FFFFFF` | headline type over photography |
