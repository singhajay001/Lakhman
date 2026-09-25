// Measures the shipped collection-hero frames against the scrim the band needs.
//
// The section's schema carried a note saying these frames "measure 18:1 for
// white type at 0%", and a 20% scrim floor was set on the strength of it. That
// note describes the typical pixel and not the one that decides readability:
// these are near-black frames carrying specular highlights, and a highlight
// under a glyph is what fails.
//
// So this samples every pixel in the region the type covers, reports the
// distribution as well as the worst case, and solves for the smallest scrim
// that clears WCAG AA for all four roles in the band against the brightest
// pixel found. Run it against a checkout of the theme repo:
//
//   NODE_PATH=/opt/node22/lib/node_modules \
//   node docs/spirithaus/tools/measure-hero-frames.cjs /path/to/spirithaus-theme/assets
//
// Requires Playwright and a Chromium build; there is no image decoder in the
// base environment, which is why this goes through a canvas rather than sharp.

const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');

const DIR = process.argv[2] || '/home/user/spirithaus-theme/assets';
const CHROME = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const INK = [17, 17, 16];                       // --sh-ink, the scrim colour
// .sh-chero sets its type in white stepped down by alpha, so each role needs
// its own check: large title at 3:1, everything else at 4.5:1.
const ROLES = [['title', 1.00, 3.0], ['body', 0.88, 4.5], ['count', 0.86, 4.5], ['kicker', 0.72, 4.5]];

const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const relLum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const [x, y] = [a, b].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const over = (fg, a, bg) => fg.map((c, i) => a * c + (1 - a) * bg[i]);

// Integer percent steps deliberately: accumulating `a += 0.01` drifts to
// 0.7000000000000004 and ceil() then reports 71 where the answer is 70.
function minScrim(px) {
  for (let p = 1; p <= 99; p++) {
    const bd = over(INK, p / 100, px), bl = relLum(...bd);
    if (ROLES.every(([, ta, need]) => ratio(relLum(...over([255, 255, 255], ta, bd)), bl) >= need)) return p;
  }
  return null;
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage();
  const files = fs.readdirSync(DIR).filter(f => /^sh-hero-.*\.jpg$/.test(f)).sort();

  console.log('frame'.padEnd(24), 'WxH'.padEnd(10), 'p50'.padStart(6), 'p99'.padStart(6),
              'max'.padStart(6), 'brightest px'.padEnd(18), 'needs');
  for (const f of files) {
    const b64 = fs.readFileSync(path.join(DIR, f)).toString('base64');
    const r = await page.evaluate(async (src) => {
      const img = new Image();
      await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = src; });
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      // The type sits low and left: .sh-chero__inner is align-self:end and
      // .sh-chero__body is capped at 58ch. This zone is deliberately generous.
      const x1 = Math.floor(c.width * 0.62), y0 = Math.floor(c.height * 0.30);
      const px = [];
      let best = [0, 0, 0], bestL = -1;
      for (let y = y0; y < c.height; y++) {
        for (let x = 0; x < x1; x++) {
          const i = (y * c.width + x) * 4;
          const L = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
          if (L > bestL) { bestL = L; best = [d[i], d[i + 1], d[i + 2]]; }
          if ((x % 2) === 0 && (y % 2) === 0) px.push([d[i], d[i + 1], d[i + 2]]);
        }
      }
      return { w: c.width, h: c.height, best, px };
    }, 'data:image/jpeg;base64,' + b64);

    const lums = r.px.map(p => relLum(...p)).sort((a, b) => a - b);
    const q = p => lums[Math.min(lums.length - 1, Math.floor(lums.length * p))];
    console.log(
      f.replace('sh-hero-', '').replace('.jpg', '').padEnd(24),
      `${r.w}x${r.h}`.padEnd(10),
      q(0.50).toFixed(3).padStart(6), q(0.99).toFixed(3).padStart(6),
      lums.at(-1).toFixed(3).padStart(6),
      `rgb(${r.best.join(',')})`.padEnd(18),
      String(minScrim(r.best)).padStart(3) + '%'
    );
  }
  await browser.close();
})();
