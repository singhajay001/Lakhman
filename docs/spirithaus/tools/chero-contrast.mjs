// Derives the scrim floor for the SPIRITHAUS collection hero (.sh-chero).
//
// The band paints one flat ink scrim over the photograph -
// `.sh-chero__media::after { background: rgba(ink, var(--sh-chero-overlay)) }`
// - and sets its type in white stepped down by alpha. The worst case for
// readability is therefore a pure-white pixel of the photograph sitting under
// the words, which is exactly what a bottle shot puts there.
//
// Run: node docs/spirithaus/tools/chero-contrast.mjs
const INK = [17, 17, 16];            // #111110
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const relLum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const [x, y] = [relLum(a), relLum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const over = (fg, a, bg) => fg.map((c, i) => a * c + (1 - a) * bg[i]);

// worst case underneath the scrim: a pure-white pixel of the photograph
const WHITE = [255, 255, 255];
const roles = [
  ["title  (pure white, large)", 1.00, 3.0],
  ["body   (white @ .88)",       0.88, 4.5],
  ["count  (white @ .86)",       0.86, 4.5],
  ["kicker (white @ .72)",       0.72, 4.5],
];

console.log("scrim   " + roles.map(r => r[0].padEnd(27)).join(""));
for (const a of [0.20, 0.30, 0.45, 0.58, 0.62, 0.68, 0.72, 0.80]) {
  const backdrop = over(INK, a, WHITE);
  const cells = roles.map(([, ta, need]) => {
    const text = over([255, 255, 255], ta, backdrop);
    const c = ratio(text, backdrop);
    return `${c.toFixed(2)}:1 ${c >= need ? "pass" : "FAIL"}`.padEnd(27);
  });
  console.log(String(Math.round(a * 100)).padStart(4) + "%   " + cells.join(""));
}

// solve the minimum scrim that clears every role over pure white
let need = null;
for (let a = 0.20; a <= 0.999; a += 0.001) {
  const backdrop = over(INK, a, WHITE);
  if (roles.every(([, ta, n]) => ratio(over([255,255,255], ta, backdrop), backdrop) >= n)) { need = a; break; }
}
console.log("\nminimum scrim clearing every role over a pure-white pixel: " + (need*100).toFixed(1) + "%");
