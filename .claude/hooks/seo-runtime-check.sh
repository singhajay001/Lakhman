#!/usr/bin/env bash
# Claude SEO runtime readiness check (SessionStart).
# Fast and offline: reports status only, never installs. Provisioning the
# Python venv is an explicit, on-demand step so session start is never blocked.
set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
LAUNCHER="${ROOT}/.claude/seo-toolkit/bin/claude-seo"

[ -x "${LAUNCHER}" ] || exit 0

if timeout 10s "${LAUNCHER}" doctor --json 2>/dev/null | grep -q '"ready": true'; then
  echo "Claude SEO: runtime ready. Skills and agents loaded."
else
  echo "Claude SEO: skills and agents loaded (prompt-driven commands work now)."
  echo "Python-backed commands (GSC, PageSpeed, rendering, drift) need a one-time"
  echo "provision this session. Run when you first need one:"
  echo "  \"\$CLAUDE_PROJECT_DIR/.claude/seo-toolkit/bin/claude-seo\" setup --skip-browser"
fi
exit 0
