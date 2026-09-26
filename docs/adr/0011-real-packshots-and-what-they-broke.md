# 0011 — Real packshots, and the four assumptions they broke

**Status:** accepted, 2026-09-26

## Context

Phases 1 to 3 were built against a synthetic bottle, because this environment could not reach
Shopify. The network policy has since changed: `cdn.shopify.com` and the public storefront are
reachable, while `*.myshopify.com` is still refused at CONNECT. That is enough to ingest real
product artwork, and doing so immediately falsified four things the synthetic fixture had made
look true.

**The synthetic bottle was the wrong shape.** Its subject is 0.643 wide for its height. Real
single-product packshots in this catalogue run 0.219 to 0.55, median 0.313 — far narrower and
taller. Every geometry conclusion drawn from it was drawn from an outlier.

**A packshot is mostly empty canvas.** A Karu gin is a 649×1437 bottle inside a 1600×1600 frame:
63% nothing. The compositor placed the *frame* in the safe zone, so the transparent margin was
scaled to fit and the bottle came out smaller than the zone allowed. The synthetic bottle filled
its own frame, so this never showed.

**A minimum-edge gate is aspect-blind.** "At least 600px on either edge" refused a Jack Daniel's
trimmed to 528×1622 — which has ample resolution for every format here — while accepting a
600×600 square, which has too little for a Pinterest pin.

**Image #1 is not always a clean single bottle.** Talisker 10 and Lark Devil's Storm are both
photographed beside their gift boxes. Roughly a third of primary images are opaque JPEGs on white
with no alpha at all.

## Decision

**A master is the product.** Ingestion cuts the backdrop where there is one, then trims to the
subject, and only then takes the digest — so the digest identifies the bytes the pipeline holds,
and placing the frame is placing the product.

**The cutout solves for the foreground rather than choking the matte.** Every edge pixel of a
bottle shot on white is `C = a·F + (1−a)·B`. Making it opaque keeps the backdrop and reads as a
bright fringe over a dark environment; eroding it shaves a pixel off a silhouette this pipeline
exists to preserve. So `a` is estimated from how far the pixel has travelled from the backdrop
toward the nearest interior colour, and `F = (C − (1−a)·B)/a` is recovered. Measured on the real
Husk Bam Bam packshot, the edge composites at 1.31× the body's brightness with a binary alpha and
0.79× decontaminated. A backdrop that is not plain is refused with its measurement rather than
guessed at.

**The size gate is derived, not picked.** `requiredMasterHeightPx(aspect)` asks what the largest
format would place a product of that shape at — `min(zoneHeight·f, zoneWidth·f / aspect)`,
maximised across formats. A typical bottle needs 961px of height, set by the Pinterest pin; a
square needs 838px, set by the Instagram story.

**`minUsableWidthPx` stopped meaning half the native width.** That rule was contradicted by every
correct placement: real bottles land between 0.30 and 0.56 of native across the four formats.
Placement only ever scales down, and downscaling invents no detail, so the field now records the
smallest the master could have been and still cleared the gate.

**Single-subject detection is by column profile, not aspect.** The two overlap: a single can reads
0.589 wide, a bottle-beside-box 0.564. The column occupancy profile separates them cleanly — across
27 packshots, multi-subject and cutout-debris cases scored 0.225 to 0.917 while every single
subject scored at most 0.039. The threshold sits in that gap, and it flags for review rather than
rejecting.

**The label region comes from OCR word boxes, or from a person.** Nobody is drawing a rectangle on
238 products. Words are evidence, so a region built from them demonstrably contains printed text.
Where OCR finds nothing — reversed-out type on clear glass gives it nothing usable — the master is
still ingested, digested and masked to its silhouette, and waits in a queue for someone to draw the
region. `compositeForPlatform` already refuses an asset without one. Inventing a rectangle where a
label usually sits would give the ΔE guard the wrong pixels while looking like it had worked.

## Consequences

- Two catalogue sources behind one port. The Admin GraphQL API is the production path; the public
  storefront reader exists because this container can reach one and not the other. It carries no
  token, sees no drafts and has no metafields, and `sourceKind` records which one an asset came
  from so an audit record never implies Admin.
- CDN URLs are stripped back to the original before download. Verified against the live CDN:
  `_600x600` returns a 424×600 derivative and `?width=400` a 400×566 one, where the stripped URL
  returns the 1366×1932 original. Ingesting a derivative would make the "protected master" a
  resampled copy — precisely what ADR 0009 forbids verifying against.
- OCR is given pixels to work with. A Penfolds Grange crops to 200px wide, where OCR finds 2 words;
  upscaled to 600 it finds 63. This resamples what is *read*, never what is composited.
- Ground truth is stored even when it is imperfect. OCR read Jack Daniel's Tennessee Honey as
  "357%" where the label says 35.7%. Its purpose is to be the baseline later reads are compared
  against, and it serves that purpose whether or not it transcribed correctly — which is the same
  argument ADR 0009 makes for comparing two reads rather than trusting one.
- No supplier packshot is committed to this repository. The tests use fixtures that reproduce the
  conditions measured on the real catalogue, because redistributing a third party's artwork to test
  our own code is the unlicensed-asset problem section 16 forbids.
- The rights basis is asserted by whoever runs the sync and has no default. A supplier's packshot
  carried in a retailer's catalogue is not automatically licensed for marketing use.
