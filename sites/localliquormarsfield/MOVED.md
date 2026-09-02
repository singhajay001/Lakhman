# ⚠️ This copy is no longer authoritative

The Local Liquor Marsfield site now lives in its own repository:

**https://github.com/singhajay001/localliquormarsfield**

Cloudflare Workers builds and deploys from there (`main` → `bash publish.sh` →
`npx wrangler deploy`). Anything changed here is not deployed and will be lost.

Kept only until the domain has been moved off the old Cloudflare Pages project
and that project is deleted. Then this directory should go.

## What stayed in this workspace

Everything that serves **both** businesses, which is why it does not belong in
one site's repo:

| Path | |
|---|---|
| `seo/trafalgar/` | Profile, GBP audits, ranking diagnosis, citation tracker and correction emails |
| `seo/trafalgar/LAUNCH-RUNBOOK.md` | The ordered list of what to do next |
| `product-images/` | 29 named cutouts + 380 store photos, price-free, reusable on Spirithaus |
| `.claude/` | The vendored Claude SEO toolkit |

## Changes made in the new repo after the move

Worth knowing, because they are not reflected here:

- `wrangler.jsonc` — carries `html_handling: "auto-trailing-slash"` and a
  `build.command`, so neither depends on a dashboard field that can silently
  save as None (which it did, failing the first deploy).
- `404.html` — generated through the same head/footer path as every other page.
- Guard 8 in `check.sh` was blind to `href="/about.html#licence"`, which had
  been sitting in the footer of every page. Fixed, and the guards no longer
  scan their own `dist/` output.
- `build/build.py` read its product export from two directories up in *this*
  workspace. That broke on the move; the export now lives in `build/data/`.
- Meta descriptions and titles brought inside Google's display limits.
