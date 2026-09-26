# 6 — The protected product visual pipeline

§15 in one sentence: the AI may build the room, but it may not touch the bottle. This is how
that is made true and, more importantly, how it is *proven* on every asset rather than
asserted in a policy.

## The rule the prompt pack already reached

`docs/spirithaus/image-prompt-pack.md` states it plainly: **scenes only, never packshots**,
because an image model cannot reproduce a real label and a fabricated bottle on a product
card is a misrepresentation problem rather than a style problem. That decision was made in
this repository before this build prompt arrived, and it is the same decision §15 makes.
The pipeline below is that rule enforced mechanically instead of by instruction.

## The eight stages

**1. Ingest the master.** The original photograph, unmodified, plus an `AssetLicence` row:
photographer or source, licence terms, permitted uses, expiry. No licence, no ingestion.
`masterDigest` = sha256 of the original bytes, write-once.

**2. Cut the product out.** Background removal produces an alpha cutout. Local model
(`rembg` / SAM-class) preferred over a provider so the master never leaves our storage.

**3. Define the protected regions.** Two masks, not one:
- `productMask` — the whole bottle, closure and packaging.
- `labelRegion` — the label, and anything bearing text or a logo, drawn tighter.

Drawn in the UI, OCR-assisted to propose the text bounding boxes, then confirmed by a human.
`regionDigest` is write-once once approved (§15, [03](03-data-model.md#the-constraints-that-carry-a-rule)).

**4. Record the colour reference.** Mean Lab values sampled inside the label region on the
approved master. This is what stage 7 compares against — a generated environment with warm
light will shift the bottle's apparent colour, and there has to be a number that says how
far is too far.

**5. Generate the environment.** The generation request receives the cutout as a reference
image plus a depth or edge map derived from it, and an inpainting mask that is the
**inverse** of `productMask` dilated by a few pixels. The model is asked for surface,
shadow, reflection, atmosphere and supporting ingredients, and is structurally prevented
from painting inside the product. The prompt is a `PromptVersion` seeded from the existing
prompt pack, carrying its ABAC constraints: no faces, hands clearly older than 35, no
legible third-party labels, palette pinned to the three brand tokens.

Provider-neutral by construction. ControlNet-style conditioning is one adapter's
implementation detail, per §15; the contract asks for "conditioned on this structure with
this region excluded" and each adapter satisfies it however it can — or reports that it
cannot, which is a capability, not an error.

**6. Composite deterministically.** The verified product pixels are laid over the generated
environment by `sharp` — a resample and an alpha over, no model in the path. Shadow and
reflection are generated *layers* placed beneath the product layer, never paint applied to
it. The composite is reproducible from (master, mask, environment, transform), and that
tuple is stored, so any asset can be rebuilt and re-verified later.

**7. Prove the product survived.** Four independent checks, all of which must pass:

| Check | Method | Fails when |
| --- | --- | --- |
| Pixel identity | Re-extract the product region from the composite, invert the recorded transform, compare against the master inside `productMask` | Any pixel inside the mask differs beyond resampling tolerance |
| Label text | Tesseract on `labelRegion` in both, normalised string comparison | A character differs, is missing, or appears |
| Structure | Perceptual hash + SSIM on `labelRegion` | Geometry or layout has moved |
| Colour | Mean ΔE2000 inside `labelRegion` against the approved reference | Beyond the configured threshold — environment lighting has tinted the product |

Each failure names the region and shows a difference overlay. §15 requires flagging altered
label text, logo, colour, geometry or packaging; these four are those five.

**8. Human approval.** Never skipped, even when all four pass. §15's last line.

## Geometry validation is a port, not a build

The composite is correct and might still be unusable, because a platform crops it and lays
its own furniture over it. That is the same question `docs/spirithaus/tools/calibrate.mjs`
already answers against the storefront: crop survival, type occlusion, scrim loss, per
viewport, driven through the page's own measurement rather than a second implementation.

`packages/media-geometry` is that engine reading a **platform profile** instead of a theme
profile. Per platform and format: aspect, safe insets for the platform's UI furniture,
caption and CTA regions, and the viewport matrix. Three findings carry across and are worth
stating because they were expensive to learn:

- **Measure per viewport, never per asset.** An asset's verdict is its worst viewport, and
  over fifteen real frames that made asset-level comparison useless — the phone failed
  every frame, discarding every desktop improvement before it reached the table.
- **Measure where the glyphs are, not where you think they are.** A band-shaped region
  charged frames for brightness nobody reads over, and missed type that extended above the
  band at tall crops.
- **Scrim obscuration is a difference, not an absolute.** Testing whether a pixel is near
  black reported SPIRITHAUS's own low-key house style as a blocking defect on 25 of 25 rows.
  The blocking quantity is distinguishability lost *because of* the veil.

The storefront's own safe zone is already measured and committed:
`docs/spirithaus/safe-zone.svg`, redrawn on a 3:2 master, where a phone keeps the middle
**50%** of the width. Platform profiles need the same measurement per format, and the
resulting numbers will be tighter than anyone expects.

## What this pipeline still cannot do

Stated here rather than discovered in review:

- **It cannot fix a bad master.** No processing adds pixels that were never shot. The scrim
  harness already learned this: without a cap, an auto-fix could "pass" any frame by going
  black, so the veil is capped at 55% and past that the honest answer is a reshoot.
- **Nine of the fifteen delivered hero frames put the subject outside the safe horizontal
  band.** That number did not move across a geometry change, a focal revision or an
  exclusion. The current photography corpus is not compliant with the current guidance, so
  early Media Studio output will be constrained by its inputs, not by the pipeline.
- **Video is harder than stills and is honest about it.** A protected region must hold
  across every frame. The Remotion approach keeps the product as a real image layer moved by
  deterministic transforms — parallax, scale, position — so there is no frame in which a
  model could have redrawn it. Generative video around a real product is not enabled
  ([05](05-providers.md)).
- **Verification thresholds are uncalibrated.** The same is already true of the scrim
  harness's 90/5/40 thresholds, and the reports say so rather than presenting derived
  numbers. ΔE and SSIM thresholds here will ship as configurable starting points, labelled
  uncalibrated, until a labelled corpus exists.
