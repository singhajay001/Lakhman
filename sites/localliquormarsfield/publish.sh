#!/usr/bin/env bash
# Assemble the publishable site into dist/.
#
# This is what Cloudflare Pages runs when the project is connected to GitHub:
#
#   Root directory        sites/localliquormarsfield
#   Build command         bash publish.sh
#   Build output          dist
#
# Two things it does that a plain "serve this folder" cannot:
#
#   1. check.sh gates the deploy. An expired specials promotion, a drifted
#      footer, a hand-edited generated block or a broken NAP fails the build
#      instead of going live.
#   2. Only the files below reach the public site. Pointing Pages straight at
#      this folder would also publish DEPLOY.md, check.sh, the build scripts,
#      the upload zip, and the supplier's catalogue PDF.
set -euo pipefail
cd "$(dirname "$0")"

./check.sh

PUBLISH=(
  index.html specials.html spirits.html range.html
  services.html visit.html about.html contact.html
  assets robots.txt sitemap.xml .htaccess
)

rm -rf dist
mkdir -p dist
for path in "${PUBLISH[@]}"; do
  [ -e "$path" ] || { echo "publish.sh: missing $path" >&2; exit 1; }
  cp -R "$path" dist/
done

# assets/products/_source/ holds the 600x600 catalogue tiles that
# build/crop-tiles.py cuts the card images from - ~18MB that must not ship.
# README.md documents the naming convention; also not part of the site.
rm -rf dist/assets/products/_source
find dist -name '*.md' -delete

echo
echo "dist/ assembled:"
find dist -type f | sort | sed 's/^/  /'
