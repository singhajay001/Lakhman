# Square master vs native master

Every asset in the corpus is 3:2. The tool centre-crops each source to a square before
cropping to a viewport ratio, because the shooting brief specifies square masters at
maximum size. Shopify does no such thing — it covers the container with whatever is
uploaded. If what gets uploaded is 3:2, the square step is a crop the storefront never
performs, and the whole corpus is measured through a lens that does not exist.

`--master square|source` runs the same images both ways. Fifteen hero frames, five
viewports, both models. Here is what actually changes.

## Most of it doesn't

Expressed in the photographer's own frame, the **horizontal safe zone is identical**:

```
square master   x 0.2516 - 0.7484
native master   x 0.2516 - 0.7484
```

Not close — the same. Cover-cropping to a narrow ratio reaches the same pixels whether
or not the frame was squared first, because the square step never crops tighter than the
narrowest viewport does. So the two narrow views are **pixel-identical** between modes:

| viewport | ratio | square master keeps | native master keeps |
|---|---|---|---|
| desktop-1920 | 2.339 | 66.7% w × 42.7% h | 100% w × 64.1% h |
| laptop-1440 | 2.105 | 66.7% w × 47.5% h | 100% w × 71.2% h |
| small-1024 | 1.754 | 66.7% w × 57.0% h | 100% w × 85.5% h |
| tablet-768 | 0.987 | 65.8% w × 100% h | **65.8% w × 100% h** |
| phone-390 | 0.745 | 49.7% w × 100% h | **49.7% w × 100% h** |

The choice therefore reaches only the three widest viewports, and only vertically.

## What does change

**Vertical room.** In the source frame the safe zone is 42.7% of the height under a
square master and 64.1% under a native one — half as much again. The report prints these
in *master* coordinates, where they read as a 90° rotation (74.5% × 42.8% against
49.7% × 64.1%); that is the same fact in a different coordinate system, and the source
frame is the one a photographer can act on.

Both give a safe zone of the same **area**, 31.9%, which is not a coincidence: the area
is the narrowest viewport ratio divided by the widest, 0.745 / 2.339, and the master's
aspect cancels out. Squaring cannot buy safe area. It only decides whether that area is
wide and short or narrow and tall.

**Ten verdicts in seventy-five.**

```
desktop-1920   12 identical   3 changed
laptop-1440    11 identical   4 changed
small-1024     12 identical   3 changed
tablet-768     15 identical   0 changed
phone-390      15 identical   0 changed
```

No asset-level verdict moves at all, because an asset's verdict is its worst viewport
and the worst is always the phone — which is identical in both modes.

**The failure profile softens.** Across 102/105 failing rows:

| reason | square | native |
|---|---|---|
| highlights lost to scrim | 33 | 42 |
| intrusion severe | 34 | 35 |
| typography occlusion | 30 | 30 |
| image flattened by scrim | 31 | **25** |

Frames move out of the severe bucket (*flattened*) into the marginal one (*highlights
lost*).

**Model divergence rises.** Legacy vs 2.0, per viewport row:

```
square   19 / 75 diverging (25.3%)   7/15 assets   0 stricter   19 permissive
native   26 / 75 diverging (34.7%)  10/15 assets   0 stricter   26 permissive
```

Still zero rows where 2.0 is stricter, now over 75 rows rather than 25.

## What it does not decide

Subject placement guidance is unaffected horizontally — the x safe zone is the same
number under both. The 0.33–0.40 target band for subject height sits inside the safe
zone either way (0.286–0.714 square, 0.179–0.821 native); a native master simply leaves
more room above it.

Six of fifteen proposed focal points fall inside the safe zone, **and it is the same six
under both geometries** — because the x limit that excludes the other nine is the
identical number in both.

## The decision this leaves

Not a measurement question. Both modes are correct models of different upload
behaviours:

- **Upload square masters**, as the brief and run sheet specify → `square` is faithful.
- **Upload the 3:2 files as shot** → `source` is faithful, and the brief's geometry
  section, the run sheet, and the safe-zone diagram all describe a crop that will not
  happen.

The cost of getting it wrong is bounded and now known: ten viewport verdicts, a softer
failure profile, and 21 points of vertical latitude that either exist or do not.
