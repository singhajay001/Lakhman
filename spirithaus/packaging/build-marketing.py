#!/usr/bin/env python3
"""SPIRITHAUS A4 portrait marketing box label.

Goes on the carton alongside the despatch label. Its job is a reorder, so it
carries a scannable QR at 30% error correction -- it has to survive a box.
  python3 build-marketing.py
"""
import io, os, re, subprocess, segno

HERE = os.path.dirname(os.path.abspath(__file__))
CHROME = os.environ.get("CHROME", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome")

BRAND = {
    "url":         "https://spirithaus.com.au",   # <- CONFIRM BEFORE PRINT
    "url_display": "spirithaus.com.au",
    "phone":       "0452 480 487",
    "email":       "sales@spirithaus.com.au",
    "company":     "SPIRITHAUS PTY LTD",
    "abn":         "97 701 853 483",
    "licence":     "LIQP700301260",
    "licenceLabel":"NSW Packaged Liquor Licence",
}

PILLARS = [
    ("01", "The range",
     "Curated, not catalogued. If it's on the shelf, there's a reason it's there."),
    ("02", "The advice",
     "Tell us the occasion and the budget. We'll tell you what to pour."),
    ("03", "The service",
     "Packed by hand, checked twice, tracked to the door. Events and gifting a speciality."),
]

def qr_svg(url):
    """Emit the QR as one path of horizontal runs so it inherits currentColor
    (segno's writer only takes literal colours) and stays crisp at any size."""
    q = segno.make(url, error="h")
    rows = [list(r) for r in q.matrix]
    n = len(rows)
    d = []
    for y, row in enumerate(rows):
        x = 0
        while x < n:
            if row[x]:
                x0 = x
                while x < n and row[x]:
                    x += 1
                d.append("M%d %dh%dv1h-%dz" % (x0, y, x - x0, x - x0))
            else:
                x += 1
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" '
            'shape-rendering="crispEdges"><path fill="currentColor" d="%s"/></svg>'
            % (n, n, "".join(d)))


def qr_matrix(url):
    return [list(r) for r in segno.make(url, error="h").matrix]


CSS = """
:root{--ink:#111110;--bone:#F2EFE9;--red:#CF1C29;
  --rule:rgba(17,17,16,.22);--mute:rgba(17,17,16,.58);--pad:20mm}
*{box-sizing:border-box;margin:0;padding:0}
@page{size:210mm 297mm;margin:0}
html,body{background:#777}
body{font-family:'Archivo',Helvetica,Arial,sans-serif;
  -webkit-print-color-adjust:exact;print-color-adjust:exact}
.sheet{position:relative;width:210mm;height:297mm;margin:0 auto;overflow:hidden;
  background:#fff;color:var(--ink);display:flex;flex-direction:column;
  padding:22mm var(--pad) 0}
/* ink variant, for trade-printed stock */
.v-ink .sheet{background:var(--ink);color:var(--bone)}
.v-ink{--rule:rgba(242,239,233,.26);--mute:rgba(242,239,233,.62)}
/* A QR must be dark-on-light with a 4-module quiet zone. On the dark variant
   that means a white plate: inverted symbols defeat many scanners, and with no
   quiet zone the dark page runs straight into the finder patterns. */
.v-ink .qr{color:var(--ink);background:#fff;padding:4mm;width:36mm;height:36mm}
.v-ink .foot{border-top-color:rgba(242,239,233,.26)}

.wordmark{display:flex;align-items:baseline;line-height:.8;white-space:nowrap;font-size:16mm}
.wm-a{font-weight:300;letter-spacing:.20em}
.wm-b{font-weight:800;letter-spacing:-.005em;display:inline-flex;align-items:baseline}
.wm-u{display:inline-block;height:.72em;width:.71em;margin:0 .012em}
.wm-u svg{display:block;height:100%;width:100%}
.tagline{font-family:'Space Mono',monospace;font-size:2.9mm;letter-spacing:.5em;
  text-transform:uppercase;color:var(--mute);margin-top:4.5mm}

.lede{margin-top:20mm}
.lede h1{font-size:13.4mm;font-weight:800;line-height:1.04;letter-spacing:-.022em;max-width:150mm}
.lede h1 b{color:var(--red);font-weight:800}
.lede p{font-size:4.4mm;font-weight:300;line-height:1.55;margin-top:7mm;max-width:142mm;
  color:var(--mute)}

.pillars{margin-top:17mm;display:flex;flex-direction:column;gap:8.5mm}
.p{display:flex;gap:7mm;align-items:baseline}
.p .n{font-family:'Space Mono',monospace;font-size:3mm;font-weight:700;letter-spacing:.2em;
  color:var(--red);min-width:9mm;padding-top:.6mm}
.p h2{font-size:4.6mm;font-weight:800;letter-spacing:.005em;min-width:34mm}
.p span{font-size:3.9mm;font-weight:300;line-height:1.5;color:var(--mute);max-width:104mm}

.cta{margin-top:auto;margin-bottom:11mm;display:flex;gap:11mm;align-items:center;
  border-top:.4mm solid var(--rule);padding-top:11mm}
.qr{width:28mm;height:28mm;flex:none;color:var(--ink)}
.qr svg{display:block;width:100%;height:100%;shape-rendering:crispEdges}
.cta .t h3{font-size:6.6mm;font-weight:800;letter-spacing:-.012em;line-height:1.1}
.cta .t .u{font-size:4.6mm;font-weight:400;margin-top:3mm;letter-spacing:.012em}
.cta .t .s{font-family:'Space Mono',monospace;font-size:2.7mm;letter-spacing:.22em;
  text-transform:uppercase;color:var(--mute);margin-top:3.4mm}

.foot{border-top:.4mm solid var(--rule);padding:6mm 0 0;margin:0 calc(var(--pad)*-1);
  padding-left:var(--pad);padding-right:var(--pad);padding-bottom:16mm}
.foot .row{font-family:'Space Mono',monospace;font-size:2.7mm;letter-spacing:.18em;
  text-transform:uppercase}
.foot .row .lc{text-transform:none}
.foot .legal{font-family:'Space Mono',monospace;font-size:2.35mm;line-height:1.75;
  letter-spacing:.06em;color:var(--mute);margin-top:4.5mm}
.v-bleed .sheet{width:216mm;height:303mm;padding:25mm 23mm 0}
"""

U = ('<svg viewBox="0 0 276 280" xmlns="http://www.w3.org/2000/svg"><defs><clipPath id="mu">'
     '<path d="M60,0 L60,142 A78,78 0 0,0 216,142 L216,0 Z"/></clipPath></defs>'
     '<path fill="currentColor" d="M0,0 L0,142 A138,138 0 0,0 276,142 L276,0 L216,0 L216,142 '
     'A78,78 0 0,1 60,142 L60,0 Z"/>'
     '<rect clip-path="url(#mu)" x="60" y="162" width="156" height="118" fill="#CF1C29"/></svg>')

def build(variant="white"):
    b = BRAND
    cls = {"ink": " v-ink", "white": ""}.get(variant.replace("-bleed", ""), "")
    if "bleed" in variant: cls += " v-bleed"
    pillars = "".join(
        '<div class="p"><div class="n">%s</div><h2>%s</h2><span>%s</span></div>' % p
        for p in PILLARS)
    page = """<!doctype html><html class="%(cls)s" lang="en-AU"><head><meta charset="utf-8">
<title>SPIRITHAUS — marketing box label</title>
<link rel="stylesheet" href="fonts.css"><style>%(css)s</style></head><body>
<div class="sheet">
  <header>
    <div class="wordmark"><span class="wm-a">SPIRIT</span><span class="wm-b">HA<span class="wm-u">%(u)s</span>S</span></div>
    <div class="tagline">Spirits &nbsp;&middot;&nbsp; Wine &nbsp;&middot;&nbsp; Cocktails</div>
  </header>

  <section class="lede">
    <h1>Every bottle in this box earned its place<b>.</b></h1>
    <p>A specialist spirits shop in Sydney. Single malt, agave, craft gin and
       everything after &mdash; chosen one bottle at a time, not stocked by the pallet.</p>
  </section>

  <section class="pillars">%(pillars)s</section>

  <section class="cta">
    <div class="qr">%(qr)s</div>
    <div class="t">
      <h3>See the whole range</h3>
      <div class="u">%(url)s</div>
      <div class="s">Scan to reorder</div>
    </div>
  </section>

  <footer class="foot">
    <div class="row">%(company)s &nbsp;&middot;&nbsp; Sydney &nbsp;&middot;&nbsp; %(phone)s &nbsp;&middot;&nbsp; <span class="lc">%(email)s</span></div>
    <div class="legal">
      Enjoy responsibly. It is against the law to sell or supply alcohol to, or to obtain
      alcohol on behalf of, a person under the age of 18 years.<br>
      %(liclabel)s %(licence)s &nbsp;&middot;&nbsp; ABN %(abn)s
    </div>
  </footer>
</div></body></html>""" % dict(cls=cls.strip(), css=CSS, u=U, pillars=pillars,
        qr=qr_svg(b["url"]), url=b["url_display"], company=b["company"],
        phone=b["phone"], email=b["email"],
        liclabel=b["licenceLabel"], licence=b["licence"], abn=b["abn"])
    if "bleed" in variant:
        page = page.replace("@page{size:210mm 297mm;margin:0}", "@page{size:216mm 303mm;margin:0}")
    return page

def to_pdf(html_path, pdf_path):
    subprocess.run([CHROME, "--headless=new", "--no-sandbox", "--disable-gpu",
                    "--disable-dev-shm-usage", "--no-pdf-header-footer",
                    "--virtual-time-budget=15000",
                    "--print-to-pdf=" + pdf_path, "file://" + html_path],
                   check=True, capture_output=True)

if __name__ == "__main__":
    out = os.path.join(HERE, "dist"); os.makedirs(out, exist_ok=True)
    for v in ("white", "ink", "white-bleed"):
        hp = os.path.join(HERE, "_mk-%s.html" % v)
        open(hp, "w").write(build(v))
        pp = os.path.join(out, "spirithaus-marketing-label-a4-%s.pdf" % v)
        to_pdf(hp, pp); os.remove(hp)
        print("  ->", os.path.relpath(pp, HERE))
