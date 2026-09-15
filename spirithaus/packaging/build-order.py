#!/usr/bin/env python3
"""Generate filled SPIRITHAUS box labels + a packing manifest from an order JSON.

  python3 build-order.py orders/<slug>.json
Writes dist/orders/<slug>-labels-{bone,ink}.pdf and <slug>-manifest.pdf
"""
import json, sys, os, subprocess, html
from collections import OrderedDict

HERE = os.path.dirname(os.path.abspath(__file__))
CHROME = os.environ.get("CHROME", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome")

CSS = """
:root{--ink:#111110;--bone:#F2EFE9;--red:#CF1C29;
  --rule:rgba(17,17,16,.22);--rule-strong:rgba(17,17,16,.55);--mute:rgba(17,17,16,.52);--pad:16mm}
*{box-sizing:border-box;margin:0;padding:0}
@page{size:297mm 210mm;margin:0}
html,body{background:#777}
body{font-family:'Archivo',Helvetica,Arial,sans-serif;
  -webkit-print-color-adjust:exact;print-color-adjust:exact}
.sheet{position:relative;width:297mm;height:210mm;margin:0 auto;overflow:hidden;
  background:var(--bone);color:var(--ink);
  display:grid;grid-template-rows:42mm 24mm 16mm 90mm 38mm;page-break-after:always}
.sheet:last-child{page-break-after:auto}
.v-ink .sheet{background:var(--ink);color:var(--bone)}
.v-ink{--rule:rgba(242,239,233,.28);--rule-strong:rgba(242,239,233,.6);--mute:rgba(242,239,233,.55)}
.v-ink .band{background:var(--bone);color:var(--ink)}
.v-ink .band .tagline{color:rgba(17,17,16,.6)}
.v-ink .cartonbox{border-color:rgba(17,17,16,.35)}
.v-ink .foot{background:var(--bone);color:var(--ink)}
.v-ink .foot .legal{color:rgba(17,17,16,.74)}
.v-ink .foot .legal b,.v-ink .foot .nm{color:var(--ink)}
.v-ink .foot .lic,.v-ink .foot .sub{color:rgba(17,17,16,.74)}
.v-ink .foot .rts{color:rgba(17,17,16,.55)}
.v-ink .foot .lic u{border-bottom-color:rgba(17,17,16,.5)}

.wordmark{display:flex;align-items:baseline;line-height:.8;white-space:nowrap}
.wm-a{font-weight:300;letter-spacing:.20em}
.wm-b{font-weight:800;letter-spacing:-.005em;display:inline-flex;align-items:baseline}
.wm-u{display:inline-block;height:.72em;width:.71em;margin:0 .012em}
.wm-u svg{display:block;height:100%;width:100%}

.band{background:var(--ink);color:var(--bone);padding:0 var(--pad);
  display:flex;align-items:center;justify-content:space-between;gap:10mm}
.band .lockup{display:flex;flex-direction:column;gap:3.6mm}
.band .wordmark{font-size:15.4mm}
.band .tagline{font-family:'Space Mono',monospace;font-size:2.5mm;letter-spacing:.50em;
  color:rgba(242,239,233,.62);text-transform:uppercase}
.cartonbox{border:.5mm solid rgba(242,239,233,.38);padding:2.4mm 5mm 2.6mm;text-align:center;min-width:42mm}
.cartonbox span{display:block;font-family:'Space Mono',monospace;font-size:2.3mm;
  letter-spacing:.24em;color:rgba(242,239,233,.6);text-transform:uppercase;margin-bottom:1.4mm}
.cartonbox b{font-size:9mm;font-weight:800;display:block;line-height:1;letter-spacing:-.01em}
.cartonbox b i{font-style:normal;opacity:.45;font-weight:300;padding:0 1.4mm}

.handling{display:grid;grid-template-columns:1fr 1fr 1fr;
  border-bottom:.4mm solid var(--rule);padding:0 var(--pad)}
.hcell{display:flex;align-items:center;gap:4mm;padding:0 2mm}
.hcell+.hcell{border-left:.3mm solid var(--rule);padding-left:8mm}
.icon{width:10mm;height:10mm;flex:none}
.icon svg{display:block;width:100%;height:100%}
.htext strong{display:block;font-size:4.2mm;font-weight:800;letter-spacing:.04em;
  text-transform:uppercase;line-height:1.05}
.htext em{display:block;font-style:normal;font-family:'Space Mono',monospace;font-size:2.2mm;
  letter-spacing:.14em;color:var(--mute);text-transform:uppercase;margin-top:1.2mm;white-space:nowrap}

.age{background:var(--red);color:#fff;display:flex;align-items:center;justify-content:center;
  gap:5mm;padding:0 var(--pad)}
.age .n{font-size:8mm;font-weight:800;line-height:1;border:.7mm solid rgba(255,255,255,.9);
  border-radius:50%;width:12mm;height:12mm;display:flex;align-items:center;justify-content:center;
  flex:none;padding-bottom:.4mm}
.age .t{font-size:4.6mm;font-weight:800;letter-spacing:.075em;text-transform:uppercase;line-height:1.2}
.age .t s{display:block;text-decoration:none;font-family:'Space Mono',monospace;font-size:2.4mm;
  font-weight:400;letter-spacing:.16em;color:rgba(255,255,255,.82);margin-top:.9mm}

.body{position:relative;padding:8mm var(--pad) 0;display:flex;gap:10mm;overflow:hidden}
.ghost{position:absolute;right:-30mm;top:-16mm;width:118mm;height:120mm;
  color:var(--ink);opacity:.05;pointer-events:none}
.v-ink .ghost{color:var(--bone);opacity:.045}
.ghost svg{display:block;width:100%;height:100%}
.kicker{font-family:'Space Mono',monospace;font-size:2.9mm;font-weight:700;letter-spacing:.34em;
  text-transform:uppercase;color:var(--mute)}
.kicker b{color:var(--red);font-weight:700}
.to{flex:1;display:flex;flex-direction:column;position:relative;z-index:2;padding-bottom:6mm}
.cust{margin-top:3.5mm}
.cust .nm{font-size:7.8mm;font-weight:800;letter-spacing:-.012em;line-height:1.05}
.cust .ev{font-size:4.6mm;font-weight:300;margin-top:1.4mm;letter-spacing:.01em}
.cust .addr{font-size:4.8mm;font-weight:500;margin-top:2.8mm;letter-spacing:.005em}
.cust .loc{font-family:'Space Mono',monospace;font-size:3.3mm;letter-spacing:.26em;
  text-transform:uppercase;margin-top:1.6mm;color:var(--mute)}
.hr{border-top:.35mm solid var(--rule);margin:4.5mm 0 3.5mm}
.items{display:flex;flex-direction:column;gap:3mm;margin-top:3.5mm}
.item{display:flex;align-items:baseline;gap:3mm;overflow:hidden}
.item b{font-size:5.6mm;font-weight:800;min-width:14mm;text-align:right;letter-spacing:-.01em}
.item .x{font-family:'Space Mono',monospace;font-size:3mm;color:var(--mute)}
.item em{font-style:normal;font-size:4.5mm;font-weight:400;letter-spacing:0;
  white-space:nowrap}
.item i{font-style:normal;font-family:'Space Mono',monospace;font-size:2.4mm;
  letter-spacing:.07em;color:var(--mute);text-transform:uppercase;white-space:nowrap}
.boxnote{margin-top:3.5mm;border:.4mm solid var(--red);color:var(--red);align-self:flex-start;
  font-family:'Space Mono',monospace;font-size:2.7mm;font-weight:700;letter-spacing:.16em;
  text-transform:uppercase;padding:2.4mm 4.5mm}
.vdiv{width:0;border-left:.3mm solid var(--rule);margin:2mm 0 8mm}
.meta{width:78mm;display:flex;flex-direction:column;padding-bottom:8mm;position:relative;z-index:2}
.mcell{flex:1;display:flex;flex-direction:column;justify-content:flex-end;padding-bottom:1mm}
.mcell span{font-family:'Space Mono',monospace;font-size:2.4mm;letter-spacing:.2em;
  text-transform:uppercase;color:var(--mute);margin-bottom:6mm}
.mcell .fill{border-bottom:.35mm solid var(--rule-strong)}
.mcell .val{font-size:6.4mm;font-weight:800;line-height:1;margin-bottom:2mm;letter-spacing:-.01em}
.mcell .val u{text-decoration:none;font-family:'Space Mono',monospace;font-size:2.6mm;
  font-weight:400;color:var(--mute);letter-spacing:.16em;margin-left:2mm;text-transform:uppercase}

/* ---------- white / press-light variant ----------
   No flood fills anywhere: the header, footer and 18+ band carry their weight
   with rules and type instead. Prints clean on an office laser, where large
   solid areas band, streak and starve the toner. */
.v-white .sheet{background:#fff;color:var(--ink)}
.v-white{--rule:rgba(17,17,16,.25);--rule-strong:rgba(17,17,16,.6);--mute:rgba(17,17,16,.55)}
.v-white .band{background:#fff;color:var(--ink);border-bottom:.7mm solid var(--ink)}
.v-white .band .tagline{color:rgba(17,17,16,.55)}
.v-white .cartonbox{border-color:rgba(17,17,16,.45)}
.v-white .cartonbox span{color:rgba(17,17,16,.55)}
.v-white .cartonbox b{color:var(--ink)}
.v-white .age{background:#fff;color:var(--red);
  border-top:.6mm solid var(--red);border-bottom:.6mm solid var(--red)}
.v-white .age .n{border-color:var(--red);color:var(--red)}
.v-white .age .t s{color:rgba(207,28,41,.88)}
.v-white .foot{background:#fff;color:var(--ink);border-top:.7mm solid var(--ink)}
.v-white .foot .rts{color:rgba(17,17,16,.55)}
.v-white .foot .nm{color:var(--ink)}
.v-white .foot .sub,.v-white .foot .legal,.v-white .foot .lic{color:rgba(17,17,16,.7)}
.v-white .foot .legal b,.v-white .foot .lic .ln{color:var(--ink)}
.v-white .foot .lic u{border-bottom-color:rgba(17,17,16,.5)}
/* a light screen is the other thing cheap lasers render badly -- drop it */
.v-white .ghost{display:none}

.foot{background:var(--ink);color:var(--bone);padding:5.5mm var(--pad) 0;
  display:grid;grid-template-columns:86mm 1fr 58mm;gap:10mm;align-items:start}
.foot .rts{font-size:2.5mm;color:rgba(242,239,233,.55)}
.foot .nm{font-weight:800;font-size:3.4mm;letter-spacing:.03em;color:var(--bone);margin-top:3.4mm}
.foot .sub{font-family:'Space Mono',monospace;font-size:2.4mm;letter-spacing:.08em;line-height:1.65;
  color:rgba(242,239,233,.72);margin-top:1.4mm}
.foot .legal{font-family:'Space Mono',monospace;font-size:2.3mm;line-height:1.7;letter-spacing:.05em;
  color:rgba(242,239,233,.72)}
.foot .legal b{color:var(--bone);font-weight:700;letter-spacing:.14em;text-transform:uppercase;
  display:block;margin-bottom:1.6mm;font-size:2.35mm}
.foot .lic{font-family:'Space Mono',monospace;font-size:2.3mm;letter-spacing:.1em;
  color:rgba(242,239,233,.72);line-height:2.05;text-align:right}
.foot .lic u{text-decoration:none;display:inline-block;width:26mm;
  border-bottom:.3mm solid rgba(242,239,233,.45);margin-left:2mm}
.foot .lic .lt{display:block;font-size:2.1mm;letter-spacing:.18em;text-transform:uppercase}
.foot .lic .ln{display:block;font-size:3.2mm;font-weight:700;letter-spacing:.1em;
  color:var(--bone);margin:.4mm 0 2.4mm;line-height:1.2}
.v-ink .foot .lic .ln{color:var(--ink)}
"""

U_FILL = ('<svg viewBox="0 0 276 280" xmlns="http://www.w3.org/2000/svg"><defs><clipPath id="u%d">'
  '<path d="M60,0 L60,142 A78,78 0 0,0 216,142 L216,0 Z"/></clipPath></defs>'
  '<path fill="currentColor" d="M0,0 L0,142 A138,138 0 0,0 276,142 L276,0 L216,0 L216,142 '
  'A78,78 0 0,1 60,142 L60,0 Z"/>'
  '<rect clip-path="url(#u%d)" x="60" y="162" width="156" height="118" fill="#CF1C29"/></svg>')
U_PLAIN = ('<svg viewBox="0 0 276 280" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" '
  'd="M0,0 L0,142 A138,138 0 0,0 276,142 L276,0 L216,0 L216,142 A78,78 0 0,1 60,142 L60,0 Z"/></svg>')

ICONS = {
 "fragile":'<svg viewBox="0 0 100 100" fill="currentColor"><path d="M27,8 H73 L67.5,44 C65.5,57.5 34.5,57.5 32.5,44 Z"/><rect x="46.5" y="56" width="7" height="26"/><rect x="29" y="82" width="42" height="7.5" rx="1.5"/></svg>',
 "up":'<svg viewBox="0 0 100 100" fill="currentColor"><path d="M28,6 L41,29 H33.5 V92 H22.5 V29 H15 Z"/><path d="M72,6 L85,29 H77.5 V92 H66.5 V29 H59 Z"/></svg>',
 "dry":'<svg viewBox="0 0 100 100"><path fill="currentColor" d="M50,14 C27,14 10,30 8,48 H92 C90,30 73,14 50,14 Z"/><path fill="none" stroke="currentColor" stroke-width="7.5" stroke-linecap="round" d="M50,14 V76 C50,88 28,88 28,76"/><circle fill="currentColor" cx="50" cy="8" r="5"/></svg>'}

STATUTORY = ("It is against the law to sell or supply alcohol to, or to obtain alcohol on "
             "behalf of, a person under the age of 18 years.")

# Delivery and customer collection need different operational wording. Printing
# "return to depot" on a carton the customer collects in person is simply wrong.
MODES = {
  "delivery": {
    "kicker":   "Deliver&nbsp;to",
    "age_head": "Contains alcohol &middot; ID required on delivery",
    "age_sub":  "Must not be left unattended &middot; Do not supply to a minor or an intoxicated person",
    "date":     "Despatch date",
    "party":    "Return to sender",
    "legal2":   ("Photo ID must be sighted on delivery. If no person aged 18 or over is present to "
                 "receive and sign for this consignment, it must not be left &mdash; return to depot."),
  },
  "collection": {
    "kicker":   "For&nbsp;collection&nbsp;by",
    "age_head": "Contains alcohol &middot; ID required on collection",
    "age_sub":  "Do not release to a minor or to an intoxicated person",
    "date":     "Collection date",
    "party":    "Enquiries",
    "legal2":   ("Photo ID must be sighted on collection. This consignment will not be released to a "
                 "person under the age of 18, or to a person who is intoxicated."),
  },
}

def esc(s): return html.escape(str(s))

def label_page(order, box, total_boxes, idx):
    c = order["customer"]; co = order.get("company", {})
    md = MODES.get(order.get("fulfilment", "delivery"), MODES["delivery"])
    units = sum(i["qty"] for i in box["items"] if i["qty"] is not None)
    known = all(i["qty"] is not None for i in box["items"])
    unit = box.get("unit", "units")
    rows = []
    for it in box["items"]:
        q = ('<b>%d</b><span class="x">&times;</span>' % it["qty"]) if it["qty"] is not None \
            else '<b>&mdash;</b><span class="x">&nbsp;</span>'
        detail = " &middot; ".join(esc(v) for v in
                 (it.get("size"), it.get("abv"), it.get("origin")) if v)
        d = '<i>%s</i>' % detail if detail else ''
        rows.append('<div class="item">%s<em>%s</em>%s</div>' % (q, esc(it["name"]), d))
    note = ('<div class="boxnote">%s</div>' % esc(box["note"])) if box.get("note") else ''
    count = ('<div class="val">%d<u>%s</u></div>' % (units, esc(unit))) if known \
            else '<div class="val" style="font-size:4.4mm;font-weight:400">Qty to confirm</div>'
    return """
<div class="sheet">
  <header class="band">
    <div class="lockup">
      <div class="wordmark"><span class="wm-a">SPIRIT</span><span class="wm-b">HA<span class="wm-u">%(u)s</span>S</span></div>
      <div class="tagline">SPIRITS &nbsp;&middot;&nbsp; WINE &nbsp;&middot;&nbsp; COCKTAILS</div>
    </div>
    <div class="cartonbox"><span>Carton</span><b>%(n)d<i>/</i>%(t)d</b></div>
  </header>
  <section class="handling">
    <div class="hcell"><div class="icon">%(i1)s</div><div class="htext"><strong>Fragile</strong><em>Glass &middot; Handle with care</em></div></div>
    <div class="hcell"><div class="icon">%(i2)s</div><div class="htext"><strong>This Way Up</strong><em>Do not invert &middot; Do not stack</em></div></div>
    <div class="hcell"><div class="icon">%(i3)s</div><div class="htext"><strong>Keep Dry</strong><em>Store upright &middot; Away from heat</em></div></div>
  </section>
  <section class="age">
    <div class="n">18</div>
    <div class="t">%(agehead)s
      <s>%(agesub)s</s></div>
  </section>
  <section class="body">
    <div class="ghost">%(ug)s</div>
    <div class="to">
      <div class="kicker">%(kicker)s <b>&mdash;</b> signature required</div>
      <div class="cust">
        <div class="nm">%(name)s</div>
        <div class="ev">%(event)s</div>
        %(street)s
        <div class="loc">%(loc)s</div>
      </div>
      <div class="hr"></div>
      <div class="kicker">Contents <b>&mdash;</b> carton %(n)d of %(t)d</div>
      <div class="items">%(rows)s</div>
      %(boxnote)s
    </div>
    <div class="vdiv"></div>
    <div class="meta">
      <div class="mcell"><span>Order No.</span><div class="fill"></div></div>
      <div class="mcell"><span>%(datelabel)s</span><div class="fill"></div></div>
      <div class="mcell"><span>Items in carton</span>%(count)s</div>
      <div class="mcell"><span>Packed &amp; checked by</span><div class="fill"></div></div>
    </div>
  </section>
  <footer class="foot">
    <div>
      <div class="kicker rts">%(party)s</div>
      <div class="nm">%(rtname)s</div>
      <div class="sub">%(rtblock)s</div>
    </div>
    <div class="legal"><b>Liquor Act 2007 (NSW)</b>%(legal1)s<br>%(legal2)s</div>
    <div class="lic"><span class="lt">%(liclabel)s</span><span class="ln">%(licno)s</span>ABN&nbsp;%(abn)s<br>CONSIGNMENT<u>&nbsp;</u></div>
  </footer>
</div>""" % dict(u=U_FILL % (idx, idx), ug=U_PLAIN, n=box["n"], t=total_boxes,
                 i1=ICONS["fragile"], i2=ICONS["up"], i3=ICONS["dry"],
                 name=esc(c["name"]), event=esc(c["event"]),
                 street=('<div class="addr">%s</div>' % esc(c["street"])) if c.get("street") else "",
                 loc=" ".join(x for x in (esc(c["locality"]), esc(c["state"]),
                                          esc(c.get("postcode") or "")) if x),
                 rows="".join(rows), count=count, boxnote=note,
                 legal1=STATUTORY, legal2=md["legal2"], kicker=md["kicker"],
                 agehead=md["age_head"], agesub=md["age_sub"],
                 datelabel=md["date"], party=md["party"],
                 liclabel=co.get("licenceLabel","Liquor licence"),
                 licno=co.get("licence",""), abn=co.get("abn",""),
                 rtname=esc(co.get("tradingName") or co.get("name","SPIRITHAUS")),
                 rtblock="<br>".join(x for x in (
                     esc(co.get("street","")),
                     " ".join(v for v in (esc(co.get("locality","")).upper(),
                                          esc(co.get("state","")),
                                          esc(co.get("postcode","")), "AUSTRALIA") if v),
                     " &middot; ".join(v for v in (esc(co.get("phone","")),
                                                   esc(co.get("email",""))) if v)) if x))

MCSS = """
:root{--ink:#111110;--bone:#F2EFE9;--red:#CF1C29;--rule:rgba(17,17,16,.2);
  --mute:rgba(17,17,16,.55);--pad:16mm}
*{box-sizing:border-box;margin:0;padding:0}
@page{size:210mm 297mm;margin:0}
html,body{background:#777}
body{font-family:'Archivo',Helvetica,Arial,sans-serif;
  -webkit-print-color-adjust:exact;print-color-adjust:exact}
.sheet{width:210mm;height:297mm;margin:0 auto;background:var(--bone);color:var(--ink);
  overflow:hidden;display:flex;flex-direction:column}
.band{background:var(--ink);color:var(--bone);padding:0 var(--pad);height:34mm;flex:none;
  display:flex;align-items:center;justify-content:space-between}
.wordmark{display:flex;align-items:baseline;line-height:.8;white-space:nowrap;font-size:9.4mm}
.wm-a{font-weight:300;letter-spacing:.20em}
.wm-b{font-weight:800;letter-spacing:-.005em;display:inline-flex;align-items:baseline}
.wm-u{display:inline-block;height:.72em;width:.71em;margin:0 .012em}
.wm-u svg{display:block;height:100%;width:100%}
.band .ttl{font-family:'Space Mono',monospace;font-size:3mm;letter-spacing:.34em;
  text-transform:uppercase;color:rgba(242,239,233,.72);text-align:right}
.head{padding:7mm var(--pad) 0;flex:none}
.kicker{font-family:'Space Mono',monospace;font-size:2.6mm;font-weight:700;letter-spacing:.32em;
  text-transform:uppercase;color:var(--mute)}
.nm{font-size:7mm;font-weight:800;letter-spacing:-.01em;margin-top:3.5mm;line-height:1.05}
.ev{font-size:4.4mm;font-weight:300;margin-top:1.4mm}
.loc{font-family:'Space Mono',monospace;font-size:3mm;letter-spacing:.26em;
  text-transform:uppercase;margin-top:2.6mm;color:var(--mute)}
table{width:100%;border-collapse:collapse;margin-top:6mm}
thead th{font-family:'Space Mono',monospace;font-size:2.3mm;letter-spacing:.2em;
  text-transform:uppercase;color:var(--mute);text-align:left;font-weight:400;
  padding:0 0 2.4mm;border-bottom:.4mm solid var(--rule)}
tbody td{padding:2.4mm 0;border-bottom:.3mm solid var(--rule);vertical-align:top;font-size:3.4mm}
td.c{width:16mm;font-weight:800;font-size:4.2mm;letter-spacing:-.01em}
td.q{width:20mm;text-align:right;font-weight:800;font-size:3.8mm}
td.k{width:12mm;text-align:right}
td.k b{display:inline-block;width:5mm;height:5mm;border:.4mm solid var(--rule);
  border-radius:.6mm}
td.i div+div{margin-top:1.4mm}
td.i em{font-style:normal;font-family:'Space Mono',monospace;font-size:2.5mm;
  letter-spacing:.14em;color:var(--mute);text-transform:uppercase;margin-left:2mm}
tfoot td{padding:4mm 0 0;font-weight:800;font-size:3.8mm;border-top:.5mm solid var(--ink)}
.totals{margin-top:6mm;padding-top:4mm;border-top:.4mm solid var(--rule)}
.tgrid{display:grid;grid-template-columns:1fr 1fr;column-gap:12mm;margin-top:4mm}
.totals .row{display:flex;justify-content:space-between;font-size:3mm;padding:.9mm 0;
  gap:4mm;border-bottom:.25mm solid var(--rule)}
.totals .row span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.totals .row b{font-weight:800}
.totals .row em{font-style:normal;font-family:'Space Mono',monospace;font-size:2.5mm;
  letter-spacing:.14em;color:var(--mute);text-transform:uppercase;margin-left:2mm}
.body{flex:1;padding:0 var(--pad);overflow:hidden}
.note{font-family:'Space Mono',monospace;font-size:2.4mm;line-height:1.7;letter-spacing:.06em;
  color:var(--red);margin-top:4.5mm}
.v-white .sheet{background:#fff}
.v-white .band{background:#fff;color:var(--ink);border-bottom:.7mm solid var(--ink)}
.v-white .band .ttl{color:rgba(17,17,16,.6)}
.v-white .foot{background:#fff;color:rgba(17,17,16,.75);border-top:.7mm solid var(--ink)}
.v-white .foot u{border-bottom-color:rgba(17,17,16,.5)}
.v-white .licline{background:#fff;color:rgba(17,17,16,.55)}

.licline{background:var(--ink);color:rgba(242,239,233,.55);padding:0 var(--pad) 4.5mm;flex:none;
  font-family:'Space Mono',monospace;font-size:2.2mm;letter-spacing:.2em;text-transform:uppercase}
.foot{background:var(--ink);color:rgba(242,239,233,.72);padding:5mm var(--pad) 2.5mm;flex:none;
  font-family:'Space Mono',monospace;font-size:2.3mm;letter-spacing:.1em;line-height:1.9;
  display:flex;justify-content:space-between}
.foot u{text-decoration:none;display:inline-block;width:32mm;
  border-bottom:.3mm solid rgba(242,239,233,.45);margin-left:2mm}
"""

def build_manifest(order, variant="bone"):
    c = order["customer"]; boxes = order["boxes"]; co = order.get("company", {})
    tot = OrderedDict(); grand = 0; unknown = 0
    rows = []
    for b in boxes:
        items = []; n = 0; allknown = True
        for it in b["items"]:
            key = it["name"] + ((" " + it["size"]) if it["size"] else "")
            sz = ("<em>%s</em>" % esc(it["size"])) if it["size"] else ""
            if it["qty"] is None:
                allknown = False; unknown += 1
                items.append("<div>%s%s</div>" % (esc(it["name"]), sz))
            else:
                tot[key] = tot.get(key, 0) + it["qty"]; n += it["qty"]; grand += it["qty"]
                items.append("<div><b>%d</b> &times; %s%s</div>" % (it["qty"], esc(it["name"]), sz))
        rows.append("<tr><td class='c'>%d</td><td class='i'>%s</td><td class='q'>%s</td>"
                    "<td class='k'><b></b></td></tr>"
                    % (b["n"], "".join(items), (str(n) if allknown else "&mdash;")))
    trows = "".join("<div class='row'><span>%s</span><b>%d</b></div>" % (esc(k), v)
                    for k, v in tot.items())
    note = ("<div class='note'>%d line item(s) have no quantity supplied and are shown as "
            "&mdash;. Confirm before despatch.</div>" % unknown) if unknown else ""
    cls = ' class="v-white"' if variant == "white" else ''
    return """<!doctype html><html%(cls)s lang='en-AU'><head><meta charset='utf-8'>
<title>SPIRITHAUS packing manifest</title><link rel='stylesheet' href='../../fonts.css'>
<style>%(css)s</style></head><body><div class="sheet">
  <header class="band">
    <div class="wordmark"><span class="wm-a">SPIRIT</span><span class="wm-b">HA<span class="wm-u">%(u)s</span>S</span></div>
    <div class="ttl">Packing manifest</div>
  </header>
  <div class="head">
    <div class="kicker">Consignment</div>
    <div class="nm">%(name)s</div>
    <div class="ev">%(event)s</div>
    <div class="ev" style="font-size:4mm;margin-top:2.4mm">%(street)s</div>
    <div class="loc">%(loc)s &nbsp;&middot;&nbsp; %(nb)d boxes &nbsp;&middot;&nbsp; %(grand)d items</div>
  </div>
  <div class="body">
    <table>
      <thead><tr><th>Carton</th><th>Contents</th><th style="text-align:right">Units</th><th style="text-align:right">Packed</th></tr></thead>
      <tbody>%(rows)s</tbody>
      <tfoot><tr><td></td><td>%(nb)d cartons</td><td class="q">%(grand)d</td><td></td></tr></tfoot>
    </table>
    %(note)s
    <div class="totals">
      <div class="kicker">Totals by product</div>
      <div class="tgrid">%(trows)s</div>
    </div>
  </div>
  <footer class="foot">
    <div>PACKED BY<u>&nbsp;</u> &nbsp; CHECKED BY<u>&nbsp;</u></div>
    <div>DATE<u>&nbsp;</u></div>
  </footer>
  <div class="licline">%(coname)s &nbsp;&middot;&nbsp; ABN %(abn)s &nbsp;&middot;&nbsp; %(liclabel)s %(licno)s</div>
</div></body></html>""" % dict(css=MCSS, u=U_FILL % (99, 99), name=esc(c["name"]),
        event=esc(c["event"]), street=esc(c.get("street","")),
        loc=" ".join(x for x in (esc(c["locality"]), esc(c["state"]),
                                 esc(c.get("postcode") or "")) if x),
        rows="".join(rows), trows=trows, nb=len(boxes), grand=grand, note=note,
        coname=esc(co.get("name","")), abn=esc(co.get("abn","")),
        liclabel=esc(co.get("licenceLabel","")), licno=esc(co.get("licence","")), cls=cls)

def build_labels(order, variant):
    pages = "".join(label_page(order, b, len(order["boxes"]), i)
                    for i, b in enumerate(order["boxes"]))
    cls = {"ink": ' class="v-ink"', "white": ' class="v-white"'}.get(variant, "")
    return ("<!doctype html><html%s lang='en-AU'><head><meta charset='utf-8'>"
            "<title>SPIRITHAUS labels</title><link rel='stylesheet' href='../../fonts.css'>"
            "<style>%s</style></head><body>%s</body></html>" % (cls, CSS, pages))

def to_pdf(html_path, pdf_path):
    subprocess.run([CHROME, "--headless=new", "--no-sandbox", "--disable-gpu",
                    "--disable-dev-shm-usage", "--no-pdf-header-footer",
                    "--virtual-time-budget=20000",
                    "--print-to-pdf=" + pdf_path, "file://" + html_path],
                   check=True, capture_output=True)

if __name__ == "__main__":
    order = json.load(open(sys.argv[1]))
    outdir = os.path.join(HERE, "dist", "orders")
    os.makedirs(outdir, exist_ok=True)
    slug = order["slug"]
    for v in ("white", "bone", "ink"):
        hp = os.path.join(outdir, "%s-labels-%s.html" % (slug, v))
        open(hp, "w").write(build_labels(order, v))
        pp = os.path.join(outdir, "%s-labels-%s.pdf" % (slug, v))
        to_pdf(hp, pp); os.remove(hp)
        print("  ->", os.path.relpath(pp, HERE))
    for v in ("white", "bone"):
        hp = os.path.join(outdir, "%s-manifest-%s.html" % (slug, v))
        open(hp, "w").write(build_manifest(order, v))
        pp = os.path.join(outdir, "%s-manifest-%s.pdf" % (slug, v))
        to_pdf(hp, pp); os.remove(hp)
        print("  ->", os.path.relpath(pp, HERE))
