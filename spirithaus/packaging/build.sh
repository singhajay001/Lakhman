#!/usr/bin/env bash
# Render the SPIRITHAUS A4 box label to print-ready PDF.
# Usage: ./build.sh          (renders all variants into dist/)
set -euo pipefail
cd "$(dirname "$0")"
CHROME="${CHROME:-/opt/pw-browsers/chromium-1194/chrome-linux/chrome}"
[ -x "$CHROME" ] || CHROME="$(command -v chromium || command -v google-chrome)"
OUT=dist; mkdir -p "$OUT"
FLAGS="--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage
       --no-pdf-header-footer --virtual-time-budget=10000"
render () { # $1 = variant, $2 = output basename
  "$CHROME" $FLAGS --print-to-pdf="$OUT/$2.pdf" \
    "file://$PWD/box-label-a4.html?v=$1" 2>/dev/null
  echo "  -> $OUT/$2.pdf"
}
echo "Rendering SPIRITHAUS A4 box label…"
render bone       spirithaus-box-label-a4-bone
render ink        spirithaus-box-label-a4-ink
render bone-bleed spirithaus-box-label-a4-bone-bleed
echo "Done."
