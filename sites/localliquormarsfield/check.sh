#!/usr/bin/env bash
# Pre-launch check. Exits non-zero while the site is not ready to publish.
set -uo pipefail
cd "$(dirname "$0")"
fail=0
say() { printf '%-6s %s\n' "$1" "$2"; }

# 1. Placeholders must be gone.
if grep -rn 'REPLACE\|class="todo"' --include='*.html' . >/dev/null 2>&1; then
  say FAIL "placeholder content still present:"
  grep -rln 'REPLACE\|class="todo"' --include='*.html' . | sed 's/^/         /'
  fail=1
else
  say OK "no placeholders left"
fi

# 2. noindex must never ship. This is the classic launch failure.
if grep -rni 'noindex' --include='*.html' . >/dev/null 2>&1; then
  say FAIL "noindex found — this would hide the site from Google"
  fail=1
else
  say OK "no noindex directive"
fi

# 3. NAP must match the master sheet exactly, on every page.
# Tracked separately so this result is reported whatever else failed.
nap=0
for f in *.html; do
  grep -q '5A, 1 Trafalgar Place' "$f" || { say FAIL "$f missing exact street address"; nap=1; }
  grep -q 'Marsfield NSW 2122' "$f"        || { say FAIL "$f missing suburb/state/postcode"; nap=1; }
  grep -q '+61452480487' "$f"              || { say FAIL "$f missing tel: link"; nap=1; }
done
[ $nap -eq 0 ] && say OK "NAP present and consistent on all pages"
[ $nap -eq 0 ] || fail=1

# 4. Wrong address formats must not creep back in. The one legitimate exception is
# the licensed premises as written on the licence itself, which must be quoted
# exactly; those lines carry data-licence-verbatim and are skipped.
if grep -rn 'Shop 5/1\|1 Trafalgar Pl,\|Shiop' --include='*.html' . \
     | grep -v 'data-licence-verbatim' >/dev/null 2>&1; then
  say FAIL "a retired address format has crept in"
  fail=1
else
  say OK "no retired address formats"
fi

# 5. The supermarket's landline must never appear on the bottle shop's site.
# It reverted once via a hardcoded string in the generator; this catches a repeat.
if grep -rn '9868 1070\|61298681070' --include='*.html' --include='*.py' . >/dev/null 2>&1; then
  say FAIL "supermarket landline found — this site uses 0452 480 487"
  grep -rln '9868 1070\|61298681070' --include='*.html' --include='*.py' . | sed 's/^/         /'
  fail=1
else
  say OK "no supermarket landline on this site"
fi

# 6. Catalogue-derived counts must not return. The supplied spreadsheet is the
# orderable range, not the shelf: the owner confirmed wine is ~120, not 2,153.
if grep -rnE '\b(4,?700|2,?15[0-9]|2,?1[0-9]{2} wines|1,?49[0-9]|45[0-9]\+? craft|219 whisk|157 gin|591 premium)\b' \
     --include='*.html' --include='*.py' . >/dev/null 2>&1; then
  say FAIL "catalogue-derived counts found — these describe orderable range, not shelf stock"
  grep -rlnE '\b(4,?700|2,?15[0-9]|1,?49[0-9]|45[0-9]\+? craft|219 whisk|157 gin|591 premium)\b' \
    --include='*.html' --include='*.py' . | sed 's/^/         /'
  fail=1
else
  say OK "no catalogue-derived counts"
fi

# 7. Social preview + icon must be on every page. They were added once and a
# rebuild silently dropped them before the generator was taught to emit them.
for f in *.html; do
  grep -q 'og:image"' "$f" || { say FAIL "$f missing og:image"; fail=1; }
  grep -q 'rel="icon"' "$f" || { say FAIL "$f missing favicon"; fail=1; }
done
[ $fail -eq 0 ] && say OK "social preview and favicon on every page"

# 8. URLs must stay extensionless. Cloudflare's auto-trailing-slash 301s
# /about.html to /about, so a published .html URL points at a redirect. This
# caught a live 404 once; it must not come back.
if grep -rnE '(href="/[a-z-]+\.html"|localliquormarsfield\.com\.au/[a-z-]+\.html)' \
     --include='*.html' --include='*.xml' --include='*.py' . >/dev/null 2>&1; then
  say FAIL "published .html URL found — these must be extensionless"
  fail=1
else
  say OK "all published URLs extensionless"
fi

# 9. Every page's footer must match build/footer.html. services.html was built
# by appending the template once and then missed several rounds of footer edits,
# silently shipping a stale footer.
python3 - <<'PYEOF' || fail=1
import pathlib, sys
cur = pathlib.Path("build/footer.html").read_text().strip()
bad = []
for f in sorted(pathlib.Path(".").glob("*.html")):
    s = f.read_text()
    if "</main>" not in s: continue
    if s[s.index("</main>"):].strip() != cur: bad.append(f.name)
if bad:
    print("FAIL   footer drifted from the template: " + ", ".join(bad)); sys.exit(1)
print("OK     every footer matches the template")
PYEOF

# 10. JSON-LD must parse.
python3 - <<'PY' || fail=1
import re, json, sys, glob
ok = True
for f in glob.glob("*.html"):
    for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>',
                            open(f).read(), re.S):
        try:
            json.loads(block)
        except json.JSONDecodeError as e:
            print(f"FAIL   {f}: invalid JSON-LD — {e}"); ok = False
print("OK     JSON-LD parses" if ok else "")
sys.exit(0 if ok else 1)
PY

echo
if [ $fail -eq 0 ]; then
  echo "READY TO PUBLISH"
else
  echo "NOT READY — fix the failures above first"
fi
exit $fail
