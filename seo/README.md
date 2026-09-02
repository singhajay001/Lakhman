# SEO workspace

Two businesses, two playbooks. Read `CLAUDE.md` at the repository root for the
routing rule, then the relevant `profile.md` before running anything.

## Working loop

```bash
# 1. Provision the Python runtime (once per session)
"$CLAUDE_PROJECT_DIR/.claude/seo-toolkit/bin/claude-seo" setup --skip-browser

# 2. Capture a baseline BEFORE changing anything
/seo drift baseline <url>

# 3. Audit
/seo audit <url>

# 4. Fix, then prove it moved
/seo drift compare <url>
```

Baselines belong in `seo/<business>/baselines/`, reports in
`seo/<business>/reports/`, dated. The baseline is what turns opinion into
evidence — capture it first, every time.

## Why baselines are committed

Drift snapshots are the record of what your SEO looked like on a given date.
Committed, they survive session resets and let any future session answer
"did this change help?" without re-guessing.
