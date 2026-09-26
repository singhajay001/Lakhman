# 1 — Repository assessment

## What is here

`singhajay001/Lakhman`, on branch `claude/spirithaus-social-platform-7msuug`, level with
`origin/main` at `951ac00`. 57 tracked files, 35 MB, of which 34 MB is fifteen hero
photographs. Everything is under `docs/`.

There is **no application**. No `package.json` anywhere, no lockfile, no framework, no
TypeScript config, no Prisma schema, no migrations, no Dockerfile, no CI workflow, no
test runner, no linter or formatter config, no `.env.example`, no `CLAUDE.md` or
`AGENTS.md`. The five tools under `docs/spirithaus/tools/` are dependency-free Node ESM
scripts (`node:fs`, `node:path`, `node:url` only) run by hand.

So Social Studio is greenfield. Nothing needs to be replaced and §4's instruction to
preserve compatible existing work has no conflict to resolve — but it does have
something substantial to preserve.

| | |
| --- | --- |
| Runtime present | Node v22.22.2, npm 10.9.7, pnpm available |
| Also present | docker, psql, redis-server, python3 |
| Absent | `ffmpeg`, `shopify` CLI |
| Instruction files | none |
| Tests / CI | none |

`ffmpeg` being absent matters less than it looks: Remotion 4 ships its own FFmpeg binary,
so composition and transcode work without a system install. A standalone `ffmpeg` is
still wanted for probing and for transcode work outside Remotion, and the npm registry
is reachable, so `ffmpeg-static` covers it.

The empty `lakhman-platform` file at the repository root is the only hint that this repo
is meant to hold more than documentation. It is the reason blocking question 1 exists.

## What is reusable

This is the part of the assessment that changes the plan. Five pieces of prior work map
onto sections of the build prompt directly.

### `docs/spirithaus/tools/calibrate.mjs` → §16 safe zones, §15 validation

790 lines, no dependencies, drives a real browser against a real layout and reports, per
image per viewport:

- **crop survival** — how much of the subject disc is still on screen after a cover crop
- **type occlusion** — how much of it sits under the actual glyph ink, dilated 0.25em,
  with opaque blocks excluded
- **scrim loss** — the subject's distinguishability *before* minus *after* the veil, not
  an absolute darkness test

Every platform variant in §12 and §16 asks exactly these three questions against a
different matrix: 9:16 with TikTok's caption and button furniture, 4:5 with Instagram's
crop, 1:1, 16:9, Pinterest vertical. The engine is the same; the profile it reads is
different. This is a port from a theme profile to a platform profile, and it arrives
with three measurement defects already found and fixed on contact with real photographs
(recorded in `docs/spirithaus/reports/step5-*.md`) that a fresh implementation would
find again the hard way.

It also arrives with a warning worth carrying: over fifteen real frames the engine had
**no discriminating power at asset level**, because an asset's verdict is its worst
viewport and the phone failed every frame. Divergence only appears per viewport. A
per-asset pass/fail chip in the Media Studio would be decorative for the same reason.

### `docs/spirithaus/theme-profile.json` → §14 Brand Kit

Generated from the live theme, never hand-edited, and carries the authoritative brand
tokens: ink `#111110`, bone `#f2efe9`, red `#cf1c29`, white; Archivo for display at
weights 300/400/900, Space Mono for mono; page width, root font scale, per-viewport type
metrics, and both scrim placements with their schema-enforced floors. The Brand Kit seed
should be **derived from this file** rather than typed in, which makes the storefront and
the social output provably the same brand rather than two readings of it.

`theme-profile.schema.json` and `tools/build-theme-profile.mjs` come with it, including
the `must()` discipline — a missing value is a build failure, never a default. That
discipline is the right one for the Brand Kit loader too.

### `docs/spirithaus/fonts/` → §14, §16

Archivo (variable, latin subset, 35 KB) and Space Mono (400, 16 KB) as woff2, both SIL
OFL 1.1 with the licence texts committed alongside. Remotion needs exactly these two
faces to render type that matches the storefront, and the licence permits the embedding.
`AssetLicence` records for both are a seed, not research.

### `docs/spirithaus/image-prompt-pack.md` → §15 generation prompts, §32 compliance

A shot-list and system prompt already written to the ABAC code, with the constraints that
matter as hard rules: no faces, hands clearly 35 or older, no legible labels, no
celebration or consumption, the palette pinned to the three brand tokens. It also carries
the scope decision this whole project depends on — **scenes only, never packshots**,
because a model cannot reproduce a real label and a fabricated one on a product card is a
misrepresentation problem. That is §15's protected-asset rule arrived at independently,
and the prompt pack becomes the seeded `PromptTemplate` for environment generation.

The pack's geometry has already been corrected once, against a 3:2 master: a phone keeps
the middle **50%** of the width, not 75%. Nine of fifteen delivered frames put the
subject past that line. Platform profiles need the same correction applied per aspect,
and the same audit run over generated output.

### `social/` on PR #12 (open, unmerged) → §21 Social Connections

`profiles.json` holds the handle strategy (`spirithausau` everywhere, `au` to
disambiguate from three US entities called Spirit Haus, one of them a liquor retailer
trading since 1972), a tiering of the platforms, each account's age-gate setting, and the
Dawn settings key its URL belongs in. Plus a copy pack measured against each platform's
character limit, and a `sameAs` JSON-LD generator that refuses to emit an entry for an
account that is not live.

It also establishes two facts the Brand Kit needs: the licence number
`LIQP700301260`, read off five storefront policy pages rather than supplied by hand, and
the deliberate decision to publish the licence number and nothing else — no licensee
name, no ABN, no ACN.

This is the seed for `SocialConnection`. Blocking question 10 is whether to merge it
first or duplicate it.

## What this container can reach

§4 requires verifying every API version, scope, posting limit, media specification and
market restriction against current official documentation at implementation time. From
this container, that is partly impossible, and the plan says so rather than producing
remembered endpoints dressed as verified ones.

Probed directly:

| Host | Result |
| --- | --- |
| `registry.npmjs.org` | 200 — dependencies installable |
| `api.anthropic.com` | reachable |
| `cdn.shopify.com` | **403 at CONNECT** — policy denial |
| `spirithaus.com.au` | **403 at CONNECT** — policy denial |
| `graph.facebook.com` | **403 at CONNECT** — policy denial |

The proxy's own status endpoint confirms these as `connect_rejected` policy denials, not
TLS trust failures — a distinction a previous session in this repo learned the hard way
when `fonts.googleapis.com` turned out to be a CA problem rather than a blocked host.

Two consequences:

1. **Every platform capability in the registry ships `verified: false`** with the
   documentation URL and the date it must be checked, and the UI refuses to enable a
   capability that has never been verified against live documentation. The registry is
   built to hold verified values; it will not be seeded with guesses that look like them.
2. **Phases 1 through 3 are buildable here in full**, because they need Shopify and the
   platforms only through mocks. Phase 4 onward needs either the allowlist widened or a
   session with network access. That is in [09-risks.md](09-risks.md), and it is the
   subject of blocking question 2.

## Store facts already established

Carried forward from prior work in this repo rather than re-derived, and treated as
confirmed except where noted:

| | |
| --- | --- |
| Shop domain | `spirithaus.com.au` |
| Theme | `spirithaus-theme/main`, `gid://shopify/OnlineStoreTheme/161468449014`, Dawn-derived |
| Licence | NSW Packaged Liquor Licence No. LIQP700301260 |
| Handle strategy | `spirithausau` on every platform; no account created yet |
| Theme writes | blocked over the Admin API on this store — theme changes are manual |
| Licensed premises | **contradictory** across storefront pages and the Shopify account — blocking question 9 |
