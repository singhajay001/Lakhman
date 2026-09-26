/* What did the bottle normaliser actually decide, and why?

   sh-bottle.js publishes two numbers and swallows everything else: on a bad
   read, a tainted canvas or a box it distrusts, it returns quietly and the
   image keeps its plain rendering. That is the right behaviour on a
   storefront and useless when a card is coming out wrong, because "no
   --sh-k" covers a guard firing, an exception, and a decision not to act,
   and those want different fixes.

   This runs the real script with a reporting line spliced into each of its
   exits and each of its intermediate values. The splices are exact-string
   replacements against the shipped source and the run aborts if one does not
   match, so the file cannot drift away from this tool in silence.

   Usage:
     node docs/spirithaus/tools/probe-bottle-normaliser.cjs \
       <image-dir> /path/to/spirithaus-theme/assets <file> [<file> ...]

   Reads, per image: the corner alpha and luminance that pick the ground
   branch; whether keying succeeded and what share it cleared; the bottle's
   bounding box and the frac/centre taken from it; the element, frame and
   contained heights (E, F, R); every stage of k; and the shift before and
   after it is clamped to the room available. `bail` names the exit taken. */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const DIR = process.argv[2];
const ASSETS = process.argv[3];
const files = process.argv.slice(4);
if (!DIR || !ASSETS || !files.length) {
  console.error('usage: node probe-bottle-normaliser.cjs <image-dir> <theme-assets-dir> <file>...');
  process.exit(2);
}
const mime = f => /\.png$/i.test(f) ? 'image/png' : /\.jpe?g$/i.test(f) ? 'image/jpeg' : 'image/webp';

let js = fs.readFileSync(path.join(ASSETS, 'sh-bottle.js'), 'utf8');

/* Exact-string splices. A miss aborts: silence here would report a
   normaliser that is not the one on disk. */
const subs = [
  ["      var frac = (box.maxY - box.minY + 1) / box.H;\n      if (frac < 0.10 || frac > 0.92) return; /* mis-read, or already tight */",
   "      var frac = (box.maxY - box.minY + 1) / box.H;\n      window.__dbg.frac = frac; window.__dbg.boxTrusted = box.trusted; window.__dbg.box = [box.minY, box.maxY, box.H];\n      if (frac < 0.10 || frac > 0.92) { window.__dbg.bail = 'frac-guard'; return; }"],
  ["      if (!(R > 0)) return;",
   "      window.__dbg.E = E; window.__dbg.EW = EW; window.__dbg.F = F; window.__dbg.R = R; window.__dbg.centre = centre;\n      if (!(R > 0)) { window.__dbg.bail = 'R'; return; }"],
  ["      var k = Math.min(TARGET * E / (frac * R), CAP);",
   "      var k = Math.min(TARGET * E / (frac * R), CAP); window.__dbg.k_raw = k;"],
  ["      if (!box.trusted) k = Math.min(k, F / (HOVER * R));",
   "      if (!box.trusted) { k = Math.min(k, F / (HOVER * R)); window.__dbg.k_untrusted = k; }"],
  ["      if (reach > 0) k = Math.min(k, F / (HOVER * R * reach));",
   "      if (reach > 0) k = Math.min(k, F / (HOVER * R * reach)); window.__dbg.reach = reach; window.__dbg.k_final = k;"],
  ["      var shift = clamp(k * R * (0.5 - centre), -room, room);",
   "      var shift = clamp(k * R * (0.5 - centre), -room, room); window.__dbg.room = room; window.__dbg.shift_want = k * R * (0.5 - centre); window.__dbg.shift = shift;"],
  ["    } catch (err) { /* leave the image as it came */ }",
   "    } catch (err) { window.__dbg.bail = 'throw:' + err; }"],
  ["      if (!nW || !nH) return;",
   "      if (!nW || !nH) { window.__dbg.bail = 'natural'; return; }\n      window.__dbg.nat = [nW, nH];"],
  ["      alpha /= corners.length; lum /= corners.length;",
   "      alpha /= corners.length; lum /= corners.length; window.__dbg.alpha = alpha; window.__dbg.lum = lum;"],
  ["        box = keyOutGround(img, ctx, 46);",
   "        box = keyOutGround(img, ctx, 46); window.__dbg.keyed = !!box; window.__dbg.branch = 'dark';"],
  ["        box = keyOutGround(img, ctx, 30);",
   "        box = keyOutGround(img, ctx, 30); window.__dbg.keyed = !!box; window.__dbg.branch = 'light';"],
  ["        frame.classList.add('is-alpha');",
   "        frame.classList.add('is-alpha'); window.__dbg.branch = 'alpha'; window.__dbg.keyed = false;"],
  ["      var frac = cleared / total;\n      if (frac < MIN_CLEARED || frac > MAX_CLEARED) return null;",
   "      var frac = cleared / total;\n      window.__dbg.keyCleared = frac;\n      if (frac < MIN_CLEARED || frac > MAX_CLEARED) return null;"],
  ["    } catch (err) { /* tainted canvas or decode failure */ }",
   "    } catch (err) { window.__dbg.bail = 'measure-throw:' + err; }"],
];
for (const [a, b] of subs) {
  if (js.indexOf(a) < 0) {
    console.error('sh-bottle.js has moved on; this splice no longer matches:\n  ' + a.split('\n')[0].trim());
    process.exit(1);
  }
  js = js.split(a).join(b);
}

const CHROME = (fs.existsSync('/opt/pw-browsers')
  ? fs.readdirSync('/opt/pw-browsers').filter(d => d.startsWith('chromium-')).sort().pop()
  : null);
const EXEC = process.env.CHROMIUM_PATH ||
  (CHROME ? `/opt/pw-browsers/${CHROME}/chrome-linux/chrome` : undefined);

(async () => {
  const browser = await chromium.launch({ executablePath: EXEC });
  const page = await browser.newPage({ viewport: { width: 400, height: 900 }, deviceScaleFactor: 1 });
  const css = fs.readFileSync(path.join(ASSETS, 'spirithaus.css'), 'utf8');

  for (const f of files) {
    const src = `data:${mime(f)};base64,` + fs.readFileSync(path.join(DIR, f)).toString('base64');
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
      :root{--sh-ink:#111110;--sh-ink-rgb:17,17,16;--sh-white:#fff;--sh-white-rgb:255,255,255;}
      *{box-sizing:border-box}body{margin:0;padding:0;width:360px}
      ${css}
    </style></head><body><article class="sh-card"><a class="sh-card__link">
      <div class="sh-card__shot" id="f" data-sh-bottle-frame>
      <img class="sh-card__img" data-sh-bottle src="${src}"></div></a></article></body></html>`);
    await page.evaluate(() => { window.__dbg = {}; });
    await page.waitForTimeout(150);
    await page.addScriptTag({ content: js });
    await page.waitForTimeout(600);
    const d = await page.evaluate(() => {
      const img = document.querySelector('img[data-sh-bottle]');
      return Object.assign({}, window.__dbg, {
        k: img.style.getPropertyValue('--sh-k'), ty: img.style.getPropertyValue('--sh-ty') });
    });
    console.log('=== ' + f);
    console.log(JSON.stringify(d, null, 1).replace(/\n\s*/g, ' '));
  }
  await browser.close();
})();
