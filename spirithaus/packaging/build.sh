#!/usr/bin/env bash
# Render the SPIRITHAUS A4 box label + box artwork to print-ready PDF.
set -euo pipefail
cd "$(dirname "$0")"
CHROME="${CHROME:-/opt/pw-browsers/chromium-1194/chrome-linux/chrome}"
[ -x "$CHROME" ] || CHROME="$(command -v chromium || command -v google-chrome)"
OUT=dist; mkdir -p "$OUT"
FLAGS="--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage
       --no-pdf-header-footer --virtual-time-budget=10000"
render () { # $1 = source html, $2 = variant, $3 = output basename
  "$CHROME" $FLAGS --print-to-pdf="$OUT/$3.pdf" "file://$PWD/$1?v=$2" 2>/dev/null
  echo "  -> $OUT/$3.pdf"
}
echo "Label…"
render box-label-a4.html bone       spirithaus-box-label-a4-bone
render box-label-a4.html ink        spirithaus-box-label-a4-ink
render box-label-a4.html bone-bleed spirithaus-box-label-a4-bone-bleed
echo "Artwork…"
render box-artwork-a4.html ink        spirithaus-box-artwork-a4-ink
render box-artwork-a4.html bone       spirithaus-box-artwork-a4-bone
render box-artwork-a4.html ink-bleed  spirithaus-box-artwork-a4-ink-bleed
echo "Done. (Editable deck: node build-deck.js)"
