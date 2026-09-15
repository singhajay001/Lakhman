#!/usr/bin/env python3
"""Verify the QR as it actually prints: locate the symbol in the rendered PDF,
read its modules back, and compare to the encoder's matrix. Also checks the
two things that silently break a printed QR -- inverted polarity and a missing
quiet zone."""
import sys, importlib.util
import pypdfium2 as pdfium
from PIL import Image

spec = importlib.util.spec_from_file_location("mk", "build-marketing.py")
mk = importlib.util.module_from_spec(spec); spec.loader.exec_module(mk)
M = mk.qr_matrix(mk.BRAND["url"]); N = len(M)

def bbox(px, x0, x1, y0, y1, want_dark):
    xs, ys = [], []
    for y in range(y0, y1, 2):
        for x in range(x0, x1, 2):
            v = px[x, y]
            if (v < 110) if want_dark else (v > 200):
                xs.append(x); ys.append(y)
    return (min(xs), min(ys), max(xs), max(ys)) if xs else None

def check(path, dark_page):
    im = pdfium.PdfDocument(path)[0].render(scale=6.0).to_pil().convert("L")
    W, H = im.size; ppmm = H / 297.01; px = im.load()
    # search the lower-left region where the CTA lives
    # tight window: the CTA text sits at x>=59mm and the section rule at ~y=203mm,
    # so keep both out or they inflate the bounding box
    X0, X1 = int(12*ppmm), int(58*ppmm)
    Y0, Y1 = int(206*ppmm), int(258*ppmm)
    if dark_page:                       # find the white plate, then the symbol inside it
        plate = bbox(px, X0, X1, Y0, Y1, want_dark=False)
        assert plate, "white plate not found"
        b = bbox(px, plate[0]+2, plate[2]-2, plate[1]+2, plate[3]-2, want_dark=True)
        quiet_mm = min(b[0]-plate[0], b[1]-plate[1], plate[2]-b[2], plate[3]-b[3]) / ppmm
    else:
        b = bbox(px, X0, X1, Y0, Y1, want_dark=True)
        quiet_mm = min((b[0]-X0), (b[1]-Y0)) / ppmm     # page is white, so it's clear space
    w, hgt = b[2]-b[0]+1, b[3]-b[1]+1
    assert abs(w-hgt) <= 0.05*w, "located region is not square (%.1f x %.1f mm) -- not the symbol" % (w/ppmm, hgt/ppmm)
    mod = w/N/ppmm
    qr = im.crop((b[0], b[1], b[0]+w, b[1]+w)).resize((N*10, N*10), Image.NEAREST)
    qp = qr.load()
    bad = sum(1 for y in range(N) for x in range(N)
              if (1 if qp[x*10+5, y*10+5] < 128 else 0) != M[y][x])
    print("  %-46s" % path.split('/')[-1])
    print("     found at x %.1f-%.1fmm, y %.1f-%.1fmm"
          % (b[0]/ppmm, b[2]/ppmm, b[1]/ppmm, b[3]/ppmm))
    print("     symbol %.1fmm, %.2fmm per module, quiet zone %.1fmm (need %.1f)"
          % (w/ppmm, mod, quiet_mm, 4*mod))
    print("     polarity: dark modules on light  |  mismatches vs encoder: %d" % bad)
    ok = bad == 0 and quiet_mm >= 4*mod and mod >= 0.4
    print("     ->", "SCAN-SAFE" if ok else "PROBLEM")
    return ok

allok = True
for p, dark in (("dist/spirithaus-marketing-label-a4-white.pdf", False),
                ("dist/spirithaus-marketing-label-a4-ink.pdf", True)):
    allok &= check(p, dark)
sys.exit(0 if allok else 1)
