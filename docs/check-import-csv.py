#!/usr/bin/env python3
"""
Pre-flight check for a Shopify product import CSV.

    python3 docs/check-import-csv.py docs/product-import-template.csv

Optionally diff the headers against a CSV exported from your own store, which is
the authoritative source for what your Shopify version actually accepts:

    python3 docs/check-import-csv.py my-380-products.csv --against shopify-export.csv

Standard library only. Exits non-zero if anything is wrong.
"""
import csv, sys, re, argparse, unicodedata

REQUIRED = ["Handle", "Title", "Variant Price"]
NUMERIC = {
    "Variant Grams": int,
    "Variant Inventory Qty": int,
    "Variant Price": float,
    "Variant Compare At Price": float,
    "Metafield: custom.standard_drinks [number_decimal]": float,
    "Metafield: custom.abv [number_decimal]": float,
    "Metafield: custom.volume_ml [number_integer]": int,
}
META_RE = re.compile(r"^Metafield: [a-z0-9_]+\.[a-z0-9_]+ \[[a-z_]+\]$")
HANDLE_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("csv_path")
    ap.add_argument("--against", help="a CSV exported from your Shopify admin")
    a = ap.parse_args()

    errors, warnings = [], []

    raw = open(a.csv_path, "rb").read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as e:
        print(f"FAIL  not valid UTF-8: {e}")
        print("      Save As -> CSV UTF-8 (Comma delimited). This is failure cause #1.")
        return 1
    if raw.startswith(b"\xef\xbb\xbf"):
        warnings.append("file starts with a UTF-8 BOM; usually fine, but strip it if the import rejects the header row")

    rows = list(csv.DictReader(text.splitlines(True)))
    if not rows:
        print("FAIL  no data rows")
        return 1
    headers = list(rows[0].keys())

    # Headers: exact-match traps.
    for h in headers:
        if h != h.strip():
            errors.append(f"header {h!r} has leading/trailing whitespace")
        if any(unicodedata.category(c) == "Zs" and c != " " for c in h):
            errors.append(f"header {h!r} contains a non-breaking or exotic space")
        if h.startswith("Metafield") and not META_RE.match(h):
            errors.append(f"metafield header {h!r} does not match 'Metafield: ns.key [type]'")
    for r in REQUIRED:
        if r not in headers:
            errors.append(f"missing required column {r!r}")

    # Ragged rows: DictReader puts overflow under None.
    for i, row in enumerate(rows, 2):
        if None in row:
            errors.append(f"row {i}: more fields than headers (unescaped quote or comma?)")
        if any(v is None for v in row.values()):
            errors.append(f"row {i}: fewer fields than headers")

    # Numeric fields must be bare numbers.
    for i, row in enumerate(rows, 2):
        for col, cast in NUMERIC.items():
            v = (row.get(col) or "").strip()
            if not v:
                continue
            try:
                cast(v)
            except ValueError:
                errors.append(f"row {i}: {col} = {v!r} is not a bare {cast.__name__} "
                              f"(strip %, mL, $ and thousands separators)")

    # Handles: format, contiguity, and product-row completeness.
    seen, order = {}, []
    for i, row in enumerate(rows, 2):
        h = (row.get("Handle") or "").strip()
        if not h:
            errors.append(f"row {i}: empty Handle")
            continue
        if not HANDLE_RE.match(h):
            errors.append(f"row {i}: handle {h!r} must be lowercase, hyphenated, no spaces or apostrophes")
        seen.setdefault(h, []).append(i)
        if not order or order[-1] != h:
            order.append(h)
    for h, lines in seen.items():
        if order.count(h) > 1:
            errors.append(f"handle {h!r} is non-contiguous (rows {lines}); "
                          f"rows for one product must sit together")

    # First row of each handle is the product row and needs a Title.
    for h, lines in seen.items():
        first = rows[lines[0] - 2]
        if not (first.get("Title") or "").strip():
            errors.append(f"row {lines[0]}: first row of handle {h!r} has no Title")
        for extra in lines[1:]:
            if (rows[extra - 2].get("Title") or "").strip():
                warnings.append(f"row {extra}: continuation row for {h!r} repeats Title; "
                                f"leave it empty or you may create a duplicate product")

    # Images must be fetchable URLs.
    for i, row in enumerate(rows, 2):
        src = (row.get("Image Src") or "").strip()
        if src and not src.startswith("https://"):
            errors.append(f"row {i}: Image Src {src[:50]!r} is not an https URL")
        if src and ("drive.google.com" in src or "dropbox.com" in src):
            warnings.append(f"row {i}: {src[:40]}... share links usually serve HTML, not image bytes")
        if src and not (row.get("Image Alt Text") or "").strip():
            warnings.append(f"row {i}: image has no Image Alt Text")

    # Literal \n is the classic multi-line mistake.
    for i, row in enumerate(rows, 2):
        for col, v in row.items():
            if col and v and "\\n" in v:
                errors.append(f"row {i}: {col} contains a literal backslash-n; "
                              f"use a real line break inside the quoted field")

    # Header diff against a real export.
    if a.against:
        exp = list(csv.reader(open(a.against, encoding="utf-8-sig")))[0]
        mine, theirs = set(headers), set(exp)
        unknown = sorted(mine - theirs)
        if unknown:
            errors.append("columns not present in your Shopify export (Shopify may ignore "
                          "or reject these): " + ", ".join(repr(u) for u in unknown))
        else:
            print("OK    every column in this file also appears in your Shopify export")

    for w in warnings:
        print(f"WARN  {w}")
    for e in errors:
        print(f"FAIL  {e}")
    print(f"\n{len(rows)} data rows, {len(headers)} columns, "
          f"{len(seen)} products, {len(errors)} errors, {len(warnings)} warnings")
    return 1 if errors else 0

if __name__ == "__main__":
    sys.exit(main())
