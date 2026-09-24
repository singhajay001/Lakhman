#!/usr/bin/env python3
"""Validate a barcode backfill before a single one reaches the store.

Spirithaus has barcodes on 3 of 217 active products, so the product JSON-LD
emits no GTIN for almost the whole catalogue. Backfilling that is worth doing.
Backfilling it *wrong* is worse than leaving it empty: a GTIN is a claim that
this page is that product, and a wrong one hands your listing to someone
else's bottle.

The theme already refuses a barcode that is not digits-only or not 8/12/13/14
long. It does NOT check the check digit, and that is the gap this fills — a
single transposed digit produces a barcode of the right length, all digits,
that passes every check the theme has and is simply a different product.

    python3 tools/check-barcodes.py supplier.csv
    python3 tools/check-barcodes.py supplier.csv --against products-export.csv

Column names are detected, not assumed: anything matching barcode/ean/gtin/upc
is the barcode, and sku/handle/variant sku identify the row. With --against,
a Shopify product export, it also refuses the import shape that has already
destroyed variants on this store.

Exits non-zero if anything would be unsafe to write.
"""

from __future__ import annotations

import argparse
import csv
import pathlib
import re
import sys
from collections import Counter, defaultdict

VALID_LENGTHS = {8, 12, 13, 14}

BARCODE_COLS = ("barcode", "ean", "gtin", "upc", "variant barcode")
SKU_COLS = ("sku", "variant sku")
HANDLE_COLS = ("handle", "product handle")


def check_digit(barcode: str) -> int:
    """GS1 check digit: weight 3 and 1 alternating from the right of the body.

    One algorithm covers EAN-8, UPC-A, EAN-13 and GTIN-14 — the weighting is
    anchored to the right-hand end, so the differing lengths do not matter.
    """
    body = [int(c) for c in barcode[:-1]]
    total = sum(v * (3 if i % 2 == 0 else 1) for i, v in enumerate(reversed(body)))
    return (10 - total % 10) % 10


def find_column(fieldnames: list[str], candidates: tuple[str, ...]) -> str | None:
    lowered = {(f or "").strip().lower(): f for f in fieldnames}
    for want in candidates:
        if want in lowered:
            return lowered[want]
    for key, original in lowered.items():
        if any(want in key for want in candidates):
            return original
    return None


def load(path: pathlib.Path) -> tuple[list[dict], list[str]]:
    with path.open(newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        return list(reader), list(reader.fieldnames or [])


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csv", type=pathlib.Path, help="the barcodes to check")
    ap.add_argument("--against", type=pathlib.Path,
                    help="a current Shopify product export, to check import shape")
    args = ap.parse_args()

    rows, fields = load(args.csv)
    if not rows:
        print("no rows in that file")
        return 2

    bc_col = find_column(fields, BARCODE_COLS)
    id_col = find_column(fields, SKU_COLS) or find_column(fields, HANDLE_COLS)
    if bc_col is None:
        print(f"no barcode column found. looked for {'/'.join(BARCODE_COLS)}")
        print(f"columns present: {', '.join(fields)}")
        itemish = [f for f in fields
                   if re.search(r"item\s*code|product\s*code|sku|article", f or "", re.I)]
        if itemish:
            print(f"\n{', '.join(repr(f) for f in itemish)} is a SUPPLIER code, not a "
                  f"barcode.\nThey are often the same length as a real GTIN and are a "
                  f"different number entirely.\nDo not map one to the other. Ask the "
                  f"supplier for an EAN/GTIN column instead.")
        return 2
    print(f"barcode column: {bc_col!r}   identifier column: {id_col!r}")
    print(f"{len(rows)} rows\n")

    errors: list[str] = []
    warnings: list[str] = []
    seen: dict[str, list[str]] = defaultdict(list)
    ok = blank = 0

    for n, row in enumerate(rows, start=2):  # row 1 is the header
        ident = (row.get(id_col) or "?").strip() if id_col else "?"
        raw = (row.get(bc_col) or "").strip()
        bc = re.sub(r"[\s-]", "", raw)

        if not bc:
            blank += 1
            continue

        # Excel turns a long number into 9.35798e+12 and strips leading zeros.
        # Both are silent, and both produce a barcode that is merely wrong.
        if "e+" in bc.lower() or "." in bc:
            errors.append(f"row {n} [{ident}]: {raw!r} looks like Excel scientific "
                          f"notation. Re-export with the column formatted as text.")
            continue
        if not bc.isdigit():
            errors.append(f"row {n} [{ident}]: {raw!r} is not digits only")
            continue
        if len(bc) not in VALID_LENGTHS:
            hint = ""
            if len(bc) in (7, 11, 12) and len(bc) + 1 in VALID_LENGTHS:
                hint = " — a leading zero may have been stripped by a spreadsheet"
            errors.append(f"row {n} [{ident}]: {bc} is {len(bc)} digits, "
                          f"not 8/12/13/14{hint}")
            continue

        expected = check_digit(bc)
        actual = int(bc[-1])
        if expected != actual:
            errors.append(f"row {n} [{ident}]: {bc} fails its check digit "
                          f"(expected {expected}, got {actual}) — a real barcode "
                          f"cannot look like this, so it is a typo or the wrong product")
            continue

        seen[bc].append(f"row {n} [{ident}]")
        ok += 1

    # An 8-digit "barcode" is usually not one. Supplier item codes are commonly
    # 8 digits, EAN-8 is rare in retail (it is for packs too small for EAN-13),
    # and roughly 1 in 10 arbitrary 8-digit numbers passes the check digit by
    # chance. So the check digit alone does NOT protect against a column of
    # supplier item codes relabelled as barcodes — say so loudly.
    eights = [b for b in seen if len(b) == 8]
    if eights and len(eights) > max(2, 0.2 * max(ok, 1)):
        warnings.append(
            f"{len(eights)} of {ok} values are 8 digits. EAN-8 is rare in retail "
            f"and supplier item codes are commonly 8 digits — about 1 in 10 of "
            f"those passes an EAN-8 check digit by chance, so this check cannot "
            f"catch them all. Confirm this column is a barcode and not an item "
            f"code before writing any of it.")

    for bc, where in seen.items():
        if len(where) > 1:
            errors.append(f"{bc} appears {len(where)} times: {', '.join(where)}. "
                          f"A GTIN identifies one sellable unit; two variants "
                          f"cannot share one.")

    # --- import shape -----------------------------------------------------
    if args.against:
        export_rows, export_fields = load(args.against)
        e_handle = find_column(export_fields, HANDLE_COLS)
        f_handle = find_column(fields, HANDLE_COLS)
        if e_handle and f_handle:
            live = Counter(
                (r.get(e_handle) or "").strip()
                for r in export_rows if (r.get(e_handle) or "").strip())
            incoming = Counter(
                (r.get(f_handle) or "").strip()
                for r in rows if (r.get(f_handle) or "").strip())
            for handle, count in incoming.items():
                if handle in live and count < live[handle]:
                    errors.append(
                        f"importing this DELETES {live[handle] - count} variant(s) "
                        f"of {handle}: the file lists {count} of {live[handle]}. "
                        f"A Handle-keyed product CSV is the complete variant set.")
                if handle not in live:
                    warnings.append(f"{handle} is not in the export — new product?")
        else:
            warnings.append("--against needs a Handle column in both files; skipped")

    # --- report -----------------------------------------------------------
    print(f"  valid      {ok}")
    print(f"  blank      {blank}")
    print(f"  errors     {len(errors)}")
    print(f"  warnings   {len(warnings)}")

    if warnings:
        print("\nWARNINGS")
        for w in warnings[:20]:
            print(f"  - {w}")
        if len(warnings) > 20:
            print(f"  … and {len(warnings) - 20} more")

    if errors:
        print("\nERRORS — do not write these")
        for e in errors[:40]:
            print(f"  - {e}")
        if len(errors) > 40:
            print(f"  … and {len(errors) - 40} more")
        print(f"\n{len(errors)} problem(s). Nothing here should reach the store.")
        return 1

    print("\nsafe to write" if ok else "\nnothing to write")
    return 0


if __name__ == "__main__":
    sys.exit(main())
