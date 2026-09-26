/* Does a product card cut the bottle off?

   A card clips for reasons that no amount of reading the stylesheet will
   settle: the shot box is a square by aspect-ratio, the image is sized by
   percentage against it, and the bottle normaliser then scales whatever
   results. The only honest answer comes from rendering a real catalogue file
   through the real stylesheet and the real script, and looking at which rows
   of the frame still hold bottle when the paint has stopped.

   Usage:
     node docs/spirithaus/tools/measure-cards.cjs \
       <image-dir> /path/to/spirithaus-theme/assets

   <image-dir> holds the card images, downloaded from the storefront; the
   second argument is the theme's assets directory. Pass a stylesheet path as
   a third argument to measure against something else — the minified asset
   Shopify serves has been run this way, and it agrees with the source.

   The markup mirrors what the collection template emits, width/height
   attributes and all: those map to CSS presentational hints, and leaving them
   out is how a harness comes back green on a page that is not.

   "Clipped" is measured, not eyeballed. The frame is screenshotted, every row
   compared against the corner pixel, and a card counts as cut when the first
   or last row that differs is against the frame edge. */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');

const DIR = process.argv[2];
const ASSETS = process.argv[3];
if (!DIR || !ASSETS) {
  console.error('usage: node measure-cards.cjs <image-dir> <theme-assets-dir> [stylesheet]');
  process.exit(2);
}
const CSS = process.argv[4] || path.join(ASSETS, 'spirithaus.css');
const SCRIPT = path.join(ASSETS, 'sh-bottle.js');

const CHROME = (fs.existsSync('/opt/pw-browsers')
  ? fs.readdirSync('/opt/pw-browsers').filter(d => d.startsWith('chromium-')).sort().pop()
  : null);
const EXEC = process.env.CHROMIUM_PATH ||
  (CHROME ? `/opt/pw-browsers/${CHROME}/chrome-linux/chrome` : undefined);

const files = fs.readdirSync(DIR).filter(f => /\.(png|jpe?g|webp)$/i.test(f)).sort();
const mime = f => /\.png$/i.test(f) ? 'image/png' : /\.jpe?g$/i.test(f) ? 'image/jpeg' : 'image/webp';

(async () => {
  const browser = await chromium.launch({ executablePath: EXEC });
  const page = await browser.newPage({ viewport: { width: 400, height: 900 }, deviceScaleFactor: 1 });
  const css = fs.readFileSync(CSS, 'utf8');
  const js = fs.readFileSync(SCRIPT, 'utf8');
  const dimOf = src => page.evaluate(s => new Promise(ok => {
    const im = new Image(); im.onload = () => ok([im.naturalWidth, im.naturalHeight]); im.src = s;
  }), src);

  let cut = 0, untouched = 0;
  const bad = [];

  for (const f of files) {
    const src = `data:${mime(f)};base64,` + fs.readFileSync(path.join(DIR, f)).toString('base64');
    const dim = await dimOf(src);
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
      :root{--sh-ink:#111110;--sh-ink-rgb:17,17,16;--sh-white:#fff;--sh-white-rgb:255,255,255;}
      *{box-sizing:border-box}body{margin:0;padding:0;width:360px}
      ${css}
    </style></head><body><article class="sh-card"><a class="sh-card__link">
      <div class="sh-card__shot" id="f" data-sh-bottle-frame>
      <img class="sh-card__img" data-sh-bottle width="${dim[0]}" height="${dim[1]}"
           sizes="44vw" crossorigin="anonymous" src="${src}"></div></a></article></body></html>`);
    await page.waitForTimeout(150);
    await page.addScriptTag({ content: js });
    await page.waitForTimeout(450);

    const meta = await page.evaluate(() => {
      const img = document.querySelector('img[data-sh-bottle]');
      const shot = img.closest('.sh-card__shot');
      return { nW: img.naturalWidth, nH: img.naturalHeight,
               k: img.style.getPropertyValue('--sh-k'), ty: img.style.getPropertyValue('--sh-ty'),
               ground: shot.className.replace('sh-card__shot', '').trim() || 'light' };
    });

    const shot = await (await page.$('#f')).screenshot();
    const rows = await page.evaluate(async (b64) => {
      const im = new Image();
      await new Promise(ok => { im.onload = ok; im.src = 'data:image/png;base64,' + b64; });
      const c = document.createElement('canvas');
      c.width = im.naturalWidth; c.height = im.naturalHeight;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      const bg = [d[0], d[1], d[2]];
      let top = -1, bot = -1;
      for (let y = 0; y < c.height; y++) {
        let n = 0;
        for (let x = 0; x < c.width; x++) {
          const p = (y * c.width + x) * 4;
          if (Math.abs(d[p] - bg[0]) + Math.abs(d[p+1] - bg[1]) + Math.abs(d[p+2] - bg[2]) > 60) n++;
        }
        if (n > 3) { if (top < 0) top = y; bot = y; }
      }
      return { top, bot, H: c.height };
    }, shot.toString('base64'));

    if (rows.top <= 1 || rows.bot >= rows.H - 2) { cut++; bad.push({ f, meta, rows }); }
    if (!meta.k) untouched++;
  }

  console.log(`${files.length} cards rendered against ${path.basename(CSS)} + ${path.basename(SCRIPT)}`);
  console.log(`  clipped: ${cut}`);
  console.log(`  normaliser left alone (no --sh-k): ${untouched}\n`);
  if (bad.length) {
    console.log('clipped'.padEnd(46), 'natural'.padEnd(11), 'ground'.padEnd(9), 'k'.padStart(7), '  bottle rows');
    bad.forEach(b => console.log(
      b.f.slice(0, 44).padEnd(46), `${b.meta.nW}x${b.meta.nH}`.padEnd(11), b.meta.ground.padEnd(9),
      String(b.meta.k || '-').padStart(7), `  ${b.rows.top}..${b.rows.bot} of ${b.rows.H}`));
  }
  await browser.close();
  process.exit(cut ? 1 : 0);
})();
