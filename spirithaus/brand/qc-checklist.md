# QC Checklist

Run against every frame before it is accepted. **Any single failure rejects the
frame** — regenerate, do not retouch around it.

## 1. Hard compliance — responsible alcohol

- [ ] No drinking, no lips, no glass touching a mouth
- [ ] No celebration, party, crowd, nightclub, or romantic scene
- [ ] No implication that alcohol confers popularity, confidence, status,
      success, attraction, or social acceptance
- [ ] No empty bottles, no drained glasses
- [ ] At most **one** prepared drink in frame, untouched
      (`hero-whisky`, `hero-cocktails` only — every other asset is zero)
- [ ] No rows of shots, no multiple served drinks, no excess quantity

## 2. Hard compliance — content

- [ ] No faces, no partial faces, no heads, no bodies
- [ ] No text, typography, lettering, or numerals anywhere — including
      signage, shelf cards, packaging, and background depth
- [ ] No logos, brand names, watermarks, or real product labels
- [ ] No invented product branding — bottles are bare glass, wax, foil,
      or plain uninked bands
- [ ] No beaches, boats, water sports, pools, vehicles, machinery, or sport
- [ ] No cartoon, illustration, anime, CGI, or 3D-render appearance

## 3. Human depiction (hand assets only)

- [ ] Hands read as 35+ — visible veins, defined knuckles, real skin texture
- [ ] No smooth, young, or fashion-model hands; no ambiguous age
- [ ] No jewellery, no watch, no nail polish
- [ ] Correct anatomy — five fingers, plausible joints, no duplication
- [ ] Nothing above the forearm in frame

## 4. Composition & safe zone

- [ ] **Hero:** left third fully empty, unlit, no objects, no specular highlights
- [ ] **Tile:** centre-third band empty and low contrast
- [ ] Safe zone measured, not eyeballed — sample luma, must sit ≤ 15 IRE
- [ ] Subject sits right of centre (hero) / at the edges (tile)
- [ ] Frame holds one clear sharp plane with honest falloff

## 5. Visual language

- [ ] Single directional key, side or three-quarter rear — no frontal fill
- [ ] Key-to-fill ratio reads 6:1 or deeper; shadows are committed
- [ ] Warm tungsten cast, 2900K–3400K
- [ ] Palette confined to the approved set; no neon, electric blue, bright
      green, or candy colour
- [ ] At most one small `#CF1C29` accent
- [ ] Shadows hold detail (not crushed to 0); highlights hold detail
      (not clipped past `#F2EFE9`)
- [ ] Depth of field and bokeh read as a real 50–100mm lens

## 6. Material realism

- [ ] Glass refracts and reflects consistently with the key
- [ ] Reflections agree with the surrounding geometry
- [ ] Condensation beads and runs; it does not tile or speckle uniformly
- [ ] Timber grain is continuous and directional; end-grain is correct
- [ ] Metal shows anisotropic streak, not a mirror gradient
- [ ] Honest imperfection present — dust, scuffs, fingerprints, wear
- [ ] Nothing reads as plastic or as a render

## 7. Technical delivery

- [ ] ≥ 4K on the long edge; 8K preferred
- [ ] Sharp but natural — no halos, no over-sharpening artefacts
- [ ] Grain is fine and film-like, not digital noise
- [ ] sRGB, JPEG q88–92 for web; 16-bit unsharpened master retained
- [ ] Filename matches the manifest exactly

## 8. Campaign continuity

Lay the frame beside `hero-home.jpg`. It must look like the same shoot, the
same day, the same lighting truck.

- [ ] Same key direction family and quality
- [ ] Same colour temperature and grade
- [ ] Same black level and contrast character
- [ ] Same material vocabulary
- [ ] No frame is noticeably brighter, cooler, or flatter than the set
