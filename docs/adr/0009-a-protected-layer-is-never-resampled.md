# 0009 — A protected layer is never resampled; it is rendered once and verified at scale 1

**Status:** accepted, 2026-09-26

## Context

Section 15 requires that a product's bottle geometry, glass transparency and label typography
survive staging unaltered, and that the claim be *checked* rather than asserted. Phase 3 built
four checks over a composite: pixel identity against a recomputed alpha-over, label text via
offline OCR, structure via pHash and windowed SSIM, and label colour via ΔE2000 against a
reference recorded at ingestion.

The composite placed the master with a scale factor, because a 900×1400 master has to sit inside
a 1080×1920 Reel safe zone. That meant the checks ran on a resampled product layer. Probing what
they actually do there was decisive:

```
honest  @1     PASS  pixel:PASS         label:PASS  structure:PASS  colour:PASS
honest  @0.527 FAIL  pixel:UNAVAILABLE  label:FAIL  structure:PASS  colour:PASS   SSIM 0.9998
abv 45  @0.527 FAIL  pixel:UNAVAILABLE  label:FAIL  structure:PASS  colour:PASS   SSIM 0.9983
```

Two separate failures. Tesseract reads *the same honest label* differently at different scales —
"APPLEWOOD GI … 700ML" on the master against "APPLEWOOD GL … 700M" on the composite — so the
label check accuses honest content. And structure does not separate an honest resample (0.9998)
from a changed strength statement (0.9983); no threshold sits between those two numbers. With
pixel identity already unavailable under resampling, a downscaled composite had no decisive check
on the label at all, while reporting a confident FAIL for the wrong reason.

An integration test was passing on exactly that accident.

## Decision

**The composite never resamples the protected layer.** Where the product must be smaller than its
master, a *rendition* is produced as a deliberate, recorded step — `createRendition`, its own row
with `renditionOfId`, its own sha256, its own storage key — and the composite places that
rendition at scale 1. Every check is then decisive again.

Three supporting rules:

- **OCR reports `UNAVAILABLE`, never `FAIL`, when `scale !== 1`**, and says why. A check that
  cannot decide must say so; section 3 applied to our own checks.
- **A rendition carries the master's approved colour forward; it never re-reads its own.**
  Re-reading would make the colour check circular — a tinted master would quietly become its own
  baseline. Measured on the test master: lanczos3 moves the label by ΔE2000 0.03–0.06, while a
  visible tint reads 8.6–10.9. A rendition drifting past ΔE 1 from the approved colour is refused
  rather than used, and the gap between 0.06 and 8.6 is the headroom that makes that safe.
- **The master's bytes are re-hashed on every composite.** The database row is immutable by
  trigger, but the object store is not. If storage no longer holds the artwork that was hashed at
  ingestion, the composite is refused outright and audited — not produced carrying a FAIL, because
  an altered product layer must never reach a reviewer at all.

## Consequences

- One more asset row and one more stored file per delivered size, reused across composites.
  Renditions are found by `(renditionOfId, widthPx)` and re-hashed before reuse.
- The app-level falsification test now asserts a refusal rather than a FAIL, and the FAIL-with-
  overlay path is exercised where it is genuinely reachable: the unit tests, which falsify a
  tint, a changed name, a changed strength statement and a recoloured glass on real pixels.
- A tint survives a resample and is still caught (ΔE 8.598 through a rendition against 8.599 on
  the master), which is the property that makes renditions safe to composite at all.
- The thresholds remain first-party and uncalibrated against a human panel. `RENDITION_MAX_DELTA_E`
  is set from measurements on a synthetic master; real packshots should be measured before it is
  treated as tuned.
