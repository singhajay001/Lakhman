# Step 2 — profile-driven pipeline: parity report

Proves that moving Scrim Proof's source of truth from constants in the page to
`theme-profile.json` did not change what it measures. The objective for this step was
parity: same measurements, same thresholds, same outputs, different source.


## How this was produced

The pre-migration build (`8230296:docs/spirithaus/scrim-proof.html`) and the migrated
build were each driven headlessly in Chromium over the three built-in sample frames, in
both the hero and tile treatments, capturing the verdict and the intrusion reading at
every ratio. Computed values below come from the profile and from the frozen legacy
constants recorded in this report.


## 1. Viewport ratios

Legacy values were hand-rounded to two decimals. The profile derives them, so they are
now exact.


| Viewport | Legacy constant | Derived | Delta |
| --- | --- | --- | --- |
| hero desktop-1920 | 2.34 | 2.3392 | -0.0008 |
| hero laptop-1440 | 2.11 | 2.1053 | -0.0047 |
| hero small-1024 | — | 1.7544 | **new viewport** |
| hero tablet-768 | 0.99 | 0.9868 | -0.0032 |
| hero phone-390 | 0.75 | 0.7453 | -0.0047 |
| tile desktop-1920 | 1.05 | 1.0471 | -0.0029 |
| tile laptop-1440 | — | 1.0471 | **not in legacy set** |
| tile small-1024 | 0.87 | 0.8745 | +0.0045 |
| tile tablet-768 | 0.62 | 0.6235 | +0.0035 |
| tile phone-390 | 1.64 | 1.6364 | -0.0036 |

Largest delta 0.0047. A 1024-wide viewport was absent from the legacy set entirely; it
adds a hero ratio of 1.75:1 and is the viewport at which tiles are narrowest above the
breakpoint.


## 2. Scrim values

| | Legacy constant | Profile | Same |
| --- | --- | --- | --- |
| hero opacity | 58% | 58% | yes |
| hero floor | 58% | 58% | yes |
| tile opacity | 66% | 66% | yes |
| scrim colour | `#111110` | `#111110` | yes |
| type colour | `#ffffff` | `#ffffff` | yes |

The slider's bounds now come from each section's own schema range rather than a shared
constant, so the 58% floor is enforced per placement as the theme enforces it.


## 3. Quiet-zone geometry — deliberately unchanged

| | Legacy | Now | |
| --- | --- | --- | --- |
| hero zone top | 0.50 of the crop | 0.50 | unchanged |
| tile zone top | 0.667 | 0.667 | unchanged |
| hero veil anchor | 0.50 of the master | 0.50 | unchanged |
| tile veil anchor | 0.60 | 0.60 | unchanged |

These are **policy, not theme data**, and are now labelled as such in the source. They
are a coarse stand-in for the real text box, held at their pre-migration values so this
step could not move a measurement. Step 3 replaces them with measured glyph boxes, and
that is where the numbers are expected to move.


## 4. Text placement geometry — changed, and this is the point

The legacy type layer was invented in viewport-relative units. Nothing in it came from
the theme. Because `cqw` scales with the frame, the error ran in opposite directions at
the two ends of the range: oversized on a desktop, undersized on a phone.


Hero, desktop-1920 (frame 1920 CSS px, so 1cqw = 19.2px):


| Element | Legacy | Profile | Legacy was |
| --- | --- | --- | --- |
| left inset | 86.4px | 410.0px | 0.21× |
| heading size | 99.8px | 64.0px | 1.56× |
| kicker size | 28.8px | 12.0px | 2.40× |
| body size | 38.4px | 18.0px | 2.13× |
| cta size | 34.6px | 15.0px | 2.30× |
| stack bottom padding | 115.2px | 72.0px | 1.60× |
| heading weight | 600 | 300 (emphasis 900) | too heavy |
| kicker face | IBM Plex Mono 500 | Space Mono 400 | wrong face |
| heading line-height | 1.08 | 1.1 | |
| body line-height | 1.5 | 1.6 | |
| heading tracking | -0.02em | -0.01em | |
| kicker tracking | 0.14em | 0.12em | |

Hero, phone-390 (1cqw = 3.9px) — the same model, now undersized:


| Element | Legacy | Profile | Legacy was |
| --- | --- | --- | --- |
| left inset | 17.6px | 15.0px | 1.17× |
| heading size | 20.3px | 36.0px | 0.56× |
| kicker size | 5.8px | 12.0px | 0.49× |
| body size | 7.8px | 16.0px | 0.49× |
| stack bottom padding | 23.4px | 48.0px | 0.49× |

The left inset is the largest single correction. The legacy layer indented type from the
frame edge; the theme puts it in a 1200px page-width container, centred, so on a wide
desktop the real inset is the page gutter — several times further in.


## 5. Rendered preview locations

The preview now draws the type stack at the theme's own metrics, scaled from theme CSS
pixels into the stage. The scale factor is `stageWidth / view.cssW`, where `view.cssW` is
the rendered width of that placement at that viewport.

Known gap: tile caption copy is not in the profile, because the theme takes it from the
collection at render time rather than from a theme file. The tile preview therefore shows
the title only, which slightly understates the tile text box height. It does not affect
this step's measurements — the tile quiet zone is still the policy bottom third — and it
is resolved in Step 3.


## 6. Measurement parity

Three sample frames, two treatments, every shared ratio: **24 cells compared, 22 identical,
2 differing by one level.** No verdict changed anywhere — every chip matched, at both the
per-ratio and the overall level.


| Frame | Treatment | Legacy | Migrated |
| --- | --- | --- | --- |
| sample-clean-bottom | hero | Holds, 6 lv at all ratios | identical |
| sample-lit-bottom | hero | Breaks, 67/76/77/80 lv | identical |
| sample-wide-offcentre | hero | Marginal, 18/18/18/19 lv | identical |
| sample-clean-bottom | tile | Marginal, 1 lv | identical |
| sample-lit-bottom | tile | Breaks, 69/66/67/69 lv | identical |
| sample-wide-offcentre | tile | Holds, 5/2/2/2 lv | 6/3/2/2 lv |

The two moved cells are accounted for: the legacy ratios were rounded to two decimals
and the derived ones are exact, so the crop is sampled a pixel or two differently. The
deltas are the 0.0036 and 0.0029 in section 1. No threshold was crossed.


## Conclusion

The migration did not introduce behavioural drift. Every difference is explained by one
of two things, both intended: ratios are no longer rounded, and a viewport that was
missing has been added.

What this report does **not** cover: the typography engine. Section 4 shows how far the
rendered type has moved, but the measurement still reads the policy band, not the glyphs.
The 300-weight correction has not yet reached a single measurement. That is Step 3, and
the comparison mode built there is what should be used to retune thresholds.

