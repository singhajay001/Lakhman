# Claude SEO — vendored toolkit

## Provenance

Vendored from [`AgriciDaniel/claude-seo`](https://github.com/AgriciDaniel/claude-seo)
v2.2.5, commit `a1480c7` (2026-08-26). MIT licensed; the upstream `LICENSE` is
preserved in this directory as the license requires. Upstream is the source of
truth — this is a pinned copy, not a fork.

## Why vendored instead of `/plugin install`

Claude Code on the web runs in an ephemeral container: `~/.claude` is wiped
between sessions, so a plugin install does not persist. Project-level skills in
`.claude/skills/` and agents in `.claude/agents/` are loaded from the repository
on every session, so they survive.

## Layout

| Path | Contents |
|---|---|
| `.claude/skills/seo*/` | 25 skills — auto-discovered, available as `/seo …` |
| `.claude/agents/seo-*.md` | 18 specialist subagents |
| `.claude/seo-toolkit/scripts/` | 53 Python scripts |
| `.claude/seo-toolkit/bin/claude-seo` | Runtime launcher (venv-isolated) |
| `.claude/hooks/seo-runtime-check.sh` | SessionStart readiness report |

Launcher references inside skill/agent markdown were rewritten from the bare
`claude-seo` (which relies on plugin `bin/` PATH injection) to
`"$CLAUDE_PROJECT_DIR/.claude/seo-toolkit/bin/claude-seo"`.

## Two tiers of capability

**Works immediately, no setup.** The skills and agents are prompt-driven
markdown — analysis, strategy, schema generation, planning. This is most of the
value and it is live the moment a session starts.

**Needs a one-time provision per session.** Anything calling a bundled Python
script: Google Search Console, PageSpeed/CrUX, headless rendering, drift
baselines, backlinks. Provision on demand:

```bash
"$CLAUDE_PROJECT_DIR/.claude/seo-toolkit/bin/claude-seo" setup --skip-browser
"$CLAUDE_PROJECT_DIR/.claude/seo-toolkit/bin/claude-seo" doctor
```

`--skip-browser` omits the Chromium download (~2 min). Drop it if you need
SPA rendering or screenshots.

## Deliberately not enabled

Upstream ships a `PostToolUse` hook (`hooks/validate-schema.py`) matching
`Edit|Write`. It is safe code — no network, no subprocess — but it exits 2 to
**block** a write when a JSON-LD block contains placeholder text or a deprecated
`@type`, and it matches every `.html/.jsx/.tsx/.vue/.svelte/.php/.ejs` file in
the project, not just SEO work. It is not wired into `settings.json` here. To
opt in, add a `PostToolUse` entry pointing at
`.claude/seo-toolkit/hooks/validate-schema.py`.

## Credentials

Nothing is configured. When you add them they land outside this repo, in
`~/.config/claude-seo/` (`google-api.json`, `oauth-token.json`, `backlinks-api.json`),
or come from environment variables. Do not commit credentials to this repo.

Prefer the read-only Search Console scope. The upstream OAuth flow requests
write scopes by default — see the security note below.

## Security review summary (2026-09-02)

Reviewed: `install.sh`, `hooks/`, `bin/claude-seo`, `scripts/runtime.py`,
`scripts/google_auth.py`, `scripts/backlinks_auth.py`, `scripts/url_safety.py`,
and every outbound host across `scripts/` and `extensions/`.

No malicious behaviour, no telemetry, no callback to author infrastructure.
Notable positives: venv isolation with atomic swap and rollback; script
allowlisting in `runtime.py` blocking path traversal; OAuth tokens written
`0o600` with an `fchmod` TOCTOU guard; 622 lines of SSRF defence
(`url_safety.py`) covering cloud-metadata endpoints, obfuscated IP literals,
and DNS rebinding on redirect targets.

Open items, none blocking:

1. **OAuth over-scoping.** `OAUTH_SCOPES` requests `.../auth/webmasters`
   (write) and `.../auth/indexing`, though a `gsc_readonly` constant exists
   unused. Write scope permits sitemap submission and URL removal. Narrow it
   to `webmasters.readonly` unless you need submission.
2. **Dependencies are range-pinned, not hash-pinned.** `pip install -r
   requirements.txt` with `>=x,<y` ranges and no `--require-hashes`. Normal
   Python practice, but it is the real supply-chain surface: ~20 direct deps
   plus transitives, trust delegated to PyPI.
3. **Upstream `install.sh` closes by suggesting `curl … | bash`** for
   uninstall — the exact pattern the project's own README argues against.
   Not used by this vendored setup.
