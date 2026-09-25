#!/usr/bin/env node
/**
 * calibrate — runs a folder of frames through Scrim Proof and writes a
 * calibration package: report.html, report.json, report.csv, labels.template.json.
 *
 * It drives the page's own engine through window.scrimProof rather than
 * reimplementing the measurement. There is one engine, so a batch report cannot
 * drift from what the tool shows — which is the whole point of a calibration
 * baseline.
 *
 *   node calibrate.mjs --page ../scrim-proof.html --images ./heroes --out ./out
 *
 * Optional:
 *   --focals focals.json   { "hero-whisky.jpg": { "x": 0.5, "y": 0.37 } }
 *                          Where the subject actually is. Without it the target
 *                          band's centre is assumed, which is a guess, and the
 *                          report says so.
 *   --labels labels.json   { "hero-whisky.jpg": "accept" | "reject" | "reject-layout" }
 *                          Human verdicts. THRESHOLDS CANNOT BE DERIVED WITHOUT
 *                          THESE — see the threshold section of the report.
 *   --slot hero|tile       Override the slot inferred from each filename.
 *   --sweep-step 0.05      Granularity of the safe-zone sweep.
 *
 * Requires node 18+ and playwright with Chromium available.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/* ------------------------------------------------------------------ args */
const args = {};
{
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    if (!a[i].startsWith("--")) continue;
    const k = a[i].replace(/^--/, "");
    args[k] = (a[i + 1] && !a[i + 1].startsWith("--")) ? a[++i] : true;
  }
}
const die = (m) => { console.error("calibrate: " + m); process.exit(1); };
for (const k of ["page", "images", "out"]) if (!args[k]) die(`missing --${k}`);

const SWEEP_STEP = Number(args["sweep-step"] || 0.05);
const TARGET_Y = 0.365;          // centre of the 0.33-0.40 target band
const FOCAL_R = 0.09;

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  // ESM resolution ignores NODE_PATH; CJS resolution honours it, which is how a
  // global playwright install is usually reachable.
  try {
    const { createRequire } = await import("node:module");
    ({ chromium } = createRequire(import.meta.url)("playwright"));
  } catch {
    die("playwright is not available.\nInstall it locally, or point NODE_PATH at a global install.");
  }
}

const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { die(`${p}: ${e.message}`); } };
const focals = args.focals ? readJson(args.focals) : null;
const rawLabels = args.labels ? readJson(args.labels) : null;

// People write "pass"/"fail" at least as often as "accept"/"reject", and a label
// the runner silently drops looks exactly like no label at all — the report would
// read "not derivable" while the file sat there full of verdicts.
const ACCEPT = new Set(["accept", "pass", "good", "ok", "yes", "keep"]);
const REJECT = new Set(["reject", "fail", "bad", "no", "reshoot"]);

// Sub-classed rejects carry WHY alongside the verdict. Every one still normalises to
// "reject" for the verdict, so threshold derivation is untouched — the reason rides
// alongside and is what lets the report ask whether the tool agreed about the cause
// and not merely about the outcome. "reshoot" is deliberately absent: it names a
// remedy rather than a defect, and every reject is arguably a reshoot.
const REJECT_REASONS = {
  "reject-layout":   "layout",
  "reject-subject":  "subject",
  "reject-contrast": "contrast"
};
const labels = rawLabels ? {} : null;
const labelReasons = rawLabels ? {} : null;
// Per-viewport labels. An asset's verdict is its WORST viewport, so an asset-level
// label cannot say whether a particular viewport was judged rightly — and the rows
// where the two models diverge are precisely the rows that an asset verdict averages
// away. A frame can fail on the phone and be perfectly publishable on the desktop.
const viewportLabels = rawLabels ? {} : null;
const ALL_KEYS = new Set(["*", "all", "default"]);
const unreadableLabels = [];
const readVerdict = (v) => {
  const t = String(v == null ? "" : v).trim().toLowerCase();
  if (!t) return { blank: true };
  if (ACCEPT.has(t)) return { verdict: "accept" };
  if (REJECT.has(t)) return { verdict: "reject" };
  if (REJECT_REASONS[t]) return { verdict: "reject", reason: REJECT_REASONS[t] };
  return null;
};
if (rawLabels) {
  for (const [k, v] of Object.entries(rawLabels)) {
    // A plain string labels the whole asset. An object labels it per viewport, and
    // "*" inside it still gives the asset-level verdict.
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const [vp, vv] of Object.entries(v)) {
        const r = readVerdict(vv);
        if (!r) { unreadableLabels.push(`${k}[${vp}]: ${JSON.stringify(vv)}`); continue; }
        if (r.blank) continue;
        if (ALL_KEYS.has(vp.toLowerCase())) {
          labels[k] = r.verdict;
          if (r.reason) labelReasons[k] = r.reason;
        } else {
          (viewportLabels[k] ||= {})[vp] = r.verdict;
        }
      }
      continue;
    }
    const r = readVerdict(v);
    if (!r) { unreadableLabels.push(`${k}: ${JSON.stringify(v)}`); continue; }
    if (r.blank) continue;
    labels[k] = r.verdict;
    if (r.reason) labelReasons[k] = r.reason;
  }
  if (unreadableLabels.length) {
    die(`these labels were not understood:\n  ${unreadableLabels.join("\n  ")}\n`
      + `Use one of accept/pass/good/ok/yes/keep, reject/fail/bad/no/reshoot,\n`
      + `or a sub-classed reject: ${Object.keys(REJECT_REASONS).join(", ")}.\n`
      + `A value may also be an object keyed by viewport, with "*" for the asset.\n`
      + `Refusing to run rather than quietly treating them as unlabelled.`);
  }
}

const IMAGE_RE = /\.(jpe?g|png|webp|avif)$/i;
const files = fs.readdirSync(args.images).filter(f => IMAGE_RE.test(f)).sort();
if (!files.length) die(`no images in ${args.images}`);
fs.mkdirSync(args.out, { recursive: true });

const MIME = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif" };
const dataUrl = (p) => {
  const ext = path.extname(p).slice(1).toLowerCase();
  return `data:${MIME[ext] || "application/octet-stream"};base64,` + fs.readFileSync(p).toString("base64");
};

/* ------------------------------------------------------------------ stats */
const num = (xs) => xs.filter(v => typeof v === "number" && isFinite(v)).sort((a, b) => a - b);
const pct = (sorted, q) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] : null;
const summarise = (xs) => {
  const s = num(xs);
  if (!s.length) return null;
  return { n: s.length, min: s[0], p10: pct(s, .10), p25: pct(s, .25), median: pct(s, .50),
           p75: pct(s, .75), p90: pct(s, .90), max: s[s.length - 1] };
};

/** Largest gap between consecutive observed values — a natural break, if one exists. */
function naturalBreak(xs) {
  const s = num(xs);
  if (s.length < 4) return null;
  let best = null;
  for (let i = 1; i < s.length; i++) {
    const gap = s[i] - s[i - 1];
    if (!best || gap > best.gap) best = { gap: +gap.toFixed(3), below: s[i - 1], above: s[i], at: +((s[i - 1] + s[i]) / 2).toFixed(2) };
  }
  return best && best.gap > 0 ? best : null;
}

/**
 * With human labels, a threshold can actually be derived: pick the cut that best
 * separates accepted from rejected frames. Without them this returns null, and the
 * report says so rather than dressing a guess up as evidence.
 */
function deriveThreshold(rows, key, direction) {
  const labelled = rows.filter(r => r.label === "accept" || r.label === "reject");
  if (labelled.length < 4) return null;
  const accepts = labelled.filter(r => r.label === "accept");
  const rejects = labelled.filter(r => r.label === "reject");
  if (!accepts.length || !rejects.length) return null;

  const candidates = [...new Set(labelled.map(r => r[key]).filter(v => typeof v === "number"))].sort((a, b) => a - b);
  let best = null;
  for (const t of candidates) {
    // direction "lower" -> a frame passes when value <= t
    const passes = (v) => direction === "lower" ? v <= t : v >= t;
    const tp = accepts.filter(r => passes(r[key])).length;
    const fn = accepts.length - tp;
    const tn = rejects.filter(r => !passes(r[key])).length;
    const fp = rejects.length - tn;
    const j = (tp / accepts.length) + (tn / rejects.length) - 1;
    if (!best || j > best.j) best = { threshold: t, j: +j.toFixed(3), falseAccepts: fp, falseRejects: fn,
                                      accuracy: +(((tp + tn) / labelled.length) * 100).toFixed(1) };
  }
  return best;
}

/* ------------------------------------------------------------------- run */
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const pageErrors = [];
page.on("pageerror", e => pageErrors.push(String(e)));
await page.goto(pathToFileURL(path.resolve(args.page)).href);
await page.waitForFunction("!!window.scrimProof", null, { timeout: 15000 })
  .catch(() => die(`${args.page} does not expose window.scrimProof — is it the current build?`));

const meta = await page.evaluate(() => ({
  fontsLoaded: window.scrimProof.fontsLoaded(),
  profile: {
    themeName: window.scrimProof.profile.source.themeName,
    themeUpdatedAt: window.scrimProof.profile.source.themeUpdatedAt,
    generatedAt: window.scrimProof.profile.generatedAt
  },
  slots: window.scrimProof.slots()
}));

if (!meta.fontsLoaded) console.error("calibrate: WARNING — the page reports substitute fonts. Results are directional only.");

// A mistyped viewport id would otherwise sit in the file looking like a judgement and
// count for nothing, which is the same failure mode as an unrecognised verdict.
if (viewportLabels) {
  const known = new Set(Object.values(meta.slots).flatMap(s => s.views.map(v => v.id)));
  const bad = [];
  for (const [file, byVp] of Object.entries(viewportLabels))
    for (const vp of Object.keys(byVp)) if (!known.has(vp)) bad.push(`${file}[${vp}]`);
  if (bad.length) {
    die(`these viewport labels name no viewport this theme renders:\n  ${bad.join("\n  ")}\n`
      + `Known viewports: ${[...known].sort().join(", ")}.`);
  }
}

const assets = [];
const unusableFocals = [];
for (const file of files) {
  process.stderr.write(`calibrate: ${file} ... `);
  const src = dataUrl(path.join(args.images, file));
  // A focals entry that is present but not a usable pair is worse than an absent
  // one: it would suppress the assumed-position banner while still being a guess.
  const entry = focals && focals[file];
  const usable = entry && typeof entry.x === "number" && typeof entry.y === "number"
    && entry.x >= 0 && entry.x <= 1 && entry.y >= 0 && entry.y <= 1;
  if (entry && !usable) unusableFocals.push(file);
  const focal = usable ? { x: entry.x, y: entry.y, r: entry.r ?? FOCAL_R }
                       : { x: 0.5, y: TARGET_Y, r: FOCAL_R };
  const focalKnown = !!usable;

  const result = await page.evaluate(
    ([src, opts]) => window.scrimProof.analyse(src, opts),
    [src, { name: file, slot: args.slot === true ? undefined : args.slot, focal, modes: ["band", "glyph"] }]
  );

  // Safe-zone sweep: walk the focal point down the master and record what survives.
  const sweep = [];
  for (let y = SWEEP_STEP; y < 1; y = +(y + SWEEP_STEP).toFixed(4)) {
    const r = await page.evaluate(
      ([src, opts]) => window.scrimProof.analyse(src, opts),
      [src, { name: file, slot: args.slot === true ? undefined : args.slot,
              focal: { x: 0.5, y, r: FOCAL_R }, modes: ["glyph"], width: 240 }]
    );
    sweep.push({ y, viewports: (r.focal ? r.focal.rows : []).map(v => ({
      viewport: v.viewport, cropVisible: v.cropVisible, typeOccluded: v.typeOccluded,
      scrimCovered: v.scrimCovered, scrimLoss: v.scrimLoss, status: v.status })) });
  }

  // `result.focal` is the focal REPORT; keep the spec under its own key or one
  // silently overwrites the other and three metrics come back empty.
  assets.push({ ...result, file, focalSpec: focal, focalKnown,
                label: labels ? (labels[file] || null) : null,
                labelReason: labelReasons ? (labelReasons[file] || null) : null, sweep });
  process.stderr.write(`${result.modes.band?.worst ?? "-"} -> ${result.modes.glyph?.worst ?? "-"}\n`);
}
await browser.close();

/* -------------------------------------------------------------- analysis */
const worstOf = (rows, key, dir) => {
  const vals = num(rows.map(r => r[key]));
  if (!vals.length) return null;
  return dir === "lower" ? vals[vals.length - 1] : vals[0];
};

const perAsset = assets.map(a => {
  const g = a.modes.glyph?.rows || [];
  const f = a.focal?.rows || [];
  return {
    file: a.file, slot: a.slot, label: a.label, labelReason: a.labelReason,
    legacy: a.modes.band?.worst ?? null,
    current: a.modes.glyph?.worst ?? null,
    focalStatus: a.focal?.status ?? null,
    worstIntrusion: worstOf(g, "intrusion", "lower"),
    worstContrast: worstOf(g, "contrast", "higher"),
    worstSurvival: worstOf(g, "survival", "higher"),
    worstCropVisible: worstOf(f, "cropVisible", "higher"),
    worstTypeOccluded: worstOf(f, "typeOccluded", "lower"),
    worstScrimCovered: worstOf(f, "scrimCovered", "lower"),
    worstRawDistinguishable: worstOf(f, "rawDistinguishable", "higher"),
    worstPostScrimDistinguishable: worstOf(f, "postScrimDistinguishable", "higher"),
    worstScrimLoss: worstOf(f, "scrimLoss", "lower")
  };
});

const failureMatrix = [];
for (const a of assets) {
  for (const r of a.modes.glyph?.rows || []) {
    if (r.state !== "pass") {
      const why = [];
      if (r.intrusion >= 30) why.push("intrusion severe");
      else if (r.intrusion >= 12) why.push("intrusion present");
      if (r.contrast < 3) why.push("type contrast below 3:1");
      else if (r.contrast < 4.5) why.push("type contrast below 4.5:1");
      if (r.survival < 8) why.push("image flattened by scrim");
      else if (r.survival < 15) why.push("highlights lost to scrim");
      failureMatrix.push({ file: a.file, viewport: r.viewport, type: "text metrics",
                           severity: r.state === "fail" ? "fail" : "marginal", reason: why.join("; ") });
    }
  }
  for (const r of a.focal?.rows || []) {
    if (r.status === "fail") {
      failureMatrix.push({ file: a.file, viewport: r.viewport, type: "focal",
                           severity: "fail", reason: r.reasons.join("; ") });
    }
  }
}

// Diagnostic agreement. A binary label tests whether the tool reached the same
// VERDICT; a sub-classed reject tests whether it reached the same CAUSE. The two can
// come apart — a correct "reject" for the wrong reason sends someone to fix the wrong
// thing — and only this table can show it.
//
// Deliberately a cross-tab and not a score. Mapping "reject-layout" onto the tool's
// own reason tokens would mean inventing a correspondence nobody has agreed, and a
// derived accuracy figure would inherit that invention while looking like a
// measurement. The rows are counts; the reading is yours.
const diagnosisCrossTab = (() => {
  const rows = perAsset.filter(a => a.labelReason);
  if (!rows.length) return null;
  const byFile = {};
  for (const m of failureMatrix) {
    const seen = (byFile[m.file] ||= new Set());
    // One row can name several causes; Set.add takes one argument, so they go in
    // individually or all but the first are dropped without a word.
    for (const reason of m.reason.split("; ")) if (reason) seen.add(reason);
  }
  const table = {};
  for (const a of rows) {
    const observed = [...(byFile[a.file] || new Set())].sort();
    const cell = (table[a.labelReason] ||= { assets: 0, toolReasons: {} });
    cell.assets++;
    if (!observed.length) cell.toolReasons["(tool found nothing)"] =
      (cell.toolReasons["(tool found nothing)"] || 0) + 1;
    for (const o of observed) cell.toolReasons[o] = (cell.toolReasons[o] || 0) + 1;
  }
  return table;
})();

// Model divergence, per viewport rather than per asset.
//
// The two models are deliberately correlated: Step 2 established parity where they
// measure the same region, so AGREEMENT IS THE DEFAULT and carries no information.
// Every bit of evidence about whether the glyph model predicts better than the band
// model lives in the rows where they part company. A corpus that produces two
// divergences is not a corpus showing the models are equivalent — it is a corpus that
// never exercised the difference, and this table is what tells those two apart before
// anyone spends an evening labelling.
//
// Survival is held on the band in both modes by design, so it cannot diverge; when it
// does, something is wrong with the harness rather than with the image, and saying so
// is more useful than quietly attributing it to the region change.
const RANK = { pass: 0, warn: 1, fail: 2 };
const stateOfMetric = {
  contrast:  v => v >= 4.5 ? "pass" : v >= 3.0 ? "warn" : "fail",
  intrusion: v => v < 12 ? "pass" : v < 30 ? "warn" : "fail",
  survival:  v => v >= 15 ? "pass" : v >= 8 ? "warn" : "fail"
};
const divergence = [];
for (const a of assets) {
  const bandBy = Object.fromEntries((a.modes.band?.rows || []).map(r => [r.viewport, r]));
  for (const g of a.modes.glyph?.rows || []) {
    const b = bandBy[g.viewport];
    if (!b || b.state === g.state) continue;
    const moved = [];
    for (const key of ["contrast", "intrusion", "survival"]) {
      if (b[key] == null || g[key] == null) continue;
      const from = stateOfMetric[key](b[key]), to = stateOfMetric[key](g[key]);
      if (from !== to) moved.push({ metric: key, band: b[key], glyph: g[key], from, to,
                                    delta: +(g[key] - b[key]).toFixed(2) });
    }
    const harder = RANK[g.state] > RANK[b.state];
    const survivalMoved = moved.some(m => m.metric === "survival");
    const explanation = survivalMoved
      ? "Image survival moved between modes. It is held on the band in both by design, "
        + "so this is a harness fault rather than a property of the frame."
      : !moved.length
        ? "States differ with no metric changing class \u2014 investigate."
        : harder
          ? "The rendered glyph boxes reach content the assumed band excludes."
          : "The assumed band included content the rendered type never covers.";
    divergence.push({
      file: a.file, viewport: g.viewport, legacy: b.state, current: g.state,
      direction: harder ? "2.0 stricter" : "2.0 more permissive",
      moved, explanation,
      reason: (moved.length
        ? moved.map(m => `${m.metric} ${m.band} \u2192 ${m.glyph} (${m.from} \u2192 ${m.to})`).join("; ") + ". "
        : "") + explanation
    });
  }
}
const divergenceSummary = {
  assets: assets.length,
  viewportRows: assets.reduce((n, a) => n + (a.modes.glyph?.rows.length || 0), 0),
  diverging: divergence.length,
  agreeing: assets.reduce((n, a) => n + (a.modes.glyph?.rows.length || 0), 0) - divergence.length,
  assetsDiverging: new Set(divergence.map(d => d.file)).size,
  stricter: divergence.filter(d => d.direction === "2.0 stricter").length,
  permissive: divergence.filter(d => d.direction === "2.0 more permissive").length
};
divergenceSummary.rate = divergenceSummary.viewportRows
  ? +((divergenceSummary.diverging / divergenceSummary.viewportRows) * 100).toFixed(1) : null;

// Which model matched the reviewer, on the rows where they disagree. This is the A/B
// question: agreement rows carry no information, so this is where the evidence is.
//
// "Would the model publish this?" has two defensible readings and picking one quietly
// would decide the result by fiat, so both are reported. STRICT counts only `pass`,
// matching the run sheet's acceptance criteria. LENIENT also counts `warn`, treating a
// marginal reading as shippable. A conclusion that holds under both is a real finding;
// one that flips between them is a statement about where the line was drawn.
const adjudication = (() => {
  if (!viewportLabels) return null;
  const judged = divergence
    .map(d => ({ ...d, human: viewportLabels[d.file]?.[d.viewport] || null }))
    .filter(d => d.human);
  if (!judged.length) return null;
  const score = (accepts) => {
    let legacyRight = 0, currentRight = 0, bothRight = 0, neitherRight = 0;
    for (const d of judged) {
      const l = (accepts.has(d.legacy) ? "accept" : "reject") === d.human;
      const c = (accepts.has(d.current) ? "accept" : "reject") === d.human;
      if (l && c) bothRight++; else if (l) legacyRight++; else if (c) currentRight++;
      else neitherRight++;
    }
    return { legacyOnly: legacyRight, currentOnly: currentRight, both: bothRight,
             neither: neitherRight, rows: judged.length };
  };
  return {
    rows: judged.map(d => ({ file: d.file, viewport: d.viewport, legacy: d.legacy,
                             current: d.current, human: d.human })),
    strict: score(new Set(["pass"])),
    lenient: score(new Set(["pass", "warn"]))
  };
})();

const newlyFailed = perAsset.filter(a => a.legacy === "pass" && a.current !== "pass");
const newlyPassed = perAsset.filter(a => a.legacy !== "pass" && a.current === "pass");

// Safe-zone: at each Y, across every asset and viewport, how often does the focal survive?
const sweepYs = assets.length ? assets[0].sweep.map(s => s.y) : [];
const safeZone = sweepYs.map((y, i) => {
  let total = 0, survived = 0, cropSum = 0, typeSum = 0, scrimSum = 0, lossSum = 0;
  for (const a of assets) {
    for (const v of a.sweep[i].viewports) {
      total++;
      if (v.status === "pass") survived++;
      cropSum += v.cropVisible; typeSum += v.typeOccluded; scrimSum += v.scrimCovered;
      lossSum += v.scrimLoss;
    }
  }
  return { y, samples: total,
           survivalRate: total ? +((survived / total) * 100).toFixed(1) : null,
           meanCropVisible: total ? +(cropSum / total).toFixed(1) : null,
           meanTypeOccluded: total ? +(typeSum / total).toFixed(1) : null,
           meanScrimCovered: total ? +(scrimSum / total).toFixed(1) : null,
           meanScrimLoss: total ? +(lossSum / total).toFixed(1) : null };
});

// The sweep's shape is the point: survival is squeezed from above by the crop and
// from below by the type, and the best Y is wherever those two pressures cross.
const bestY = safeZone.reduce((b, s) => (!b || (s.survivalRate ?? -1) > (b.survivalRate ?? -1)) ? s : b, null);
const bindingAbove = bestY ? safeZone.filter(s => s.y < bestY.y).slice(-1)[0] : null;
const bindingBelow = bestY ? safeZone.filter(s => s.y > bestY.y)[0] : null;
const sweepVerdict = bestY ? {
  bestY: bestY.y,
  survivalRate: bestY.survivalRate,
  limitedAbove: bindingAbove ? (bindingAbove.meanCropVisible < bestY.meanCropVisible ? "crop loss" : "scrim obscuration") : null,
  limitedBelow: bindingBelow ? (bindingBelow.meanTypeOccluded > bestY.meanTypeOccluded ? "typography occlusion" : "scrim obscuration") : null,
  inTargetBand: bestY.y >= 0.33 && bestY.y <= 0.40
} : null;

const METRICS = [
  { key: "worstIntrusion", label: "Intrusion", dir: "lower", unit: "levels", current: 12,
    note: "House limit. Peak above the quiet zone's own floor." },
  { key: "worstContrast", label: "Type contrast", dir: "higher", unit: ":1", current: 4.5,
    note: "WCAG. 4.5 comfortable, 3.0 the floor for display type. Not ours to tune." },
  { key: "worstCropVisible", label: "Crop visibility", dir: "higher", unit: "%", current: 90,
    note: "Share of the focal disc surviving the crop." },
  { key: "worstTypeOccluded", label: "Type occlusion", dir: "lower", unit: "%", current: 5,
    note: "Share of the focal disc under rendered glyphs." },
  { key: "worstScrimLoss", label: "Scrim loss", dir: "lower", unit: "%", current: 40,
    note: "Share of the focal disc the scrim took from distinguishable to not. "
        + "Blocking. The 40 is inherited from the absolute metric this replaced and "
        + "has never been derived from labels \u2014 treat it as provisional." },
  { key: "worstScrimCovered", label: "Absolute darkness (diagnostic)", dir: "lower", unit: "%",
    current: null,
    note: "Share of the focal disc indistinguishable from the ink after compositing. "
        + "Tracks how low-key the photograph is, not what the scrim did. Not blocking." }
];

const thresholds = METRICS.map(m => ({
  ...m,
  distribution: summarise(perAsset.map(a => a[m.key])),
  naturalBreak: naturalBreak(perAsset.map(a => a[m.key])),
  derived: deriveThreshold(perAsset, m.key, m.dir)
}));

const labelledCount = perAsset.filter(a => a.label === "accept" || a.label === "reject").length;

const report = {
  generatedAt: new Date().toISOString(),
  page: path.resolve(args.page),
  images: path.resolve(args.images),
  fontsLoaded: meta.fontsLoaded,
  theme: meta.profile,
  slots: meta.slots,
  focalKnown: assets.filter(a => a.focalKnown).length,
  unusableFocals,
  labelled: labelledCount,
  assetCount: assets.length,
  summary: {
    legacy: tally(perAsset.map(a => a.legacy)),
    current: tally(perAsset.map(a => a.current))
  },
  perAsset, failureMatrix, diagnosisCrossTab, divergenceSummary, divergence, adjudication,
  newlyFailed, newlyPassed, safeZone, sweepVerdict, thresholds,
  pageErrors,
  assets
};

function tally(states) {
  const t = { pass: 0, warn: 0, fail: 0 };
  states.forEach(s => { if (t[s] !== undefined) t[s]++; });
  return t;
}

fs.writeFileSync(path.join(args.out, "report.json"), JSON.stringify(report, null, 2) + "\n");

/* ------------------------------------------------------------------- csv */
const csvEsc = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const csvRows = [["file", "slot", "label", "mode", "viewport", "ratio", "state",
                  "contrast", "intrusion", "survival", "cropVisible", "typeOccluded",
                  "scrimCovered", "rawDistinguishable", "postScrimDistinguishable",
                  "scrimLoss", "focalStatus"]];
for (const a of assets) {
  const focalByVp = Object.fromEntries((a.focal?.rows || []).map(r => [r.viewport, r]));
  for (const mode of ["band", "glyph"]) {
    for (const r of a.modes[mode]?.rows || []) {
      const f = mode === "glyph" ? focalByVp[r.viewport] : null;
      csvRows.push([a.file, a.slot, a.label, mode, r.viewport, r.ratio, r.state,
                    r.contrast, r.intrusion, r.survival,
                    f?.cropVisible ?? "", f?.typeOccluded ?? "", f?.scrimCovered ?? "",
                    f?.rawDistinguishable ?? "", f?.postScrimDistinguishable ?? "",
                    f?.scrimLoss ?? "", f?.status ?? ""]);
    }
  }
}
fs.writeFileSync(path.join(args.out, "report.csv"), csvRows.map(r => r.map(csvEsc).join(",")).join("\n") + "\n");

/* ------------------------------------------------------------------ html */
fs.writeFileSync(path.join(args.out, "report.html"), renderHtml(report));

// A labelling sheet with the divergent rows already in it. Transcribing them out of the
// report by hand is the one step in the workflow where a row can be quietly missed, and
// a missed row is a row of evidence thrown away. Blank values mean "not yet judged", so
// this is safe to copy to labels.json and fill in from the top.
const divergentByFile = {};
for (const d of divergence) (divergentByFile[d.file] ||= new Set()).add(d.viewport);
const template = {};
for (const a of assets) {
  const vps = divergentByFile[a.file];
  if (!vps) { template[a.file] = ""; continue; }
  const entry = { "*": "" };
  for (const vp of [...vps].sort()) entry[vp] = "";
  template[a.file] = entry;
}
const templatePath = path.join(args.out, "labels.template.json");
fs.writeFileSync(templatePath, JSON.stringify(template, null, 2) + "\n");

console.error(`calibrate: wrote report.html, report.json and report.csv to ${args.out}`);
console.error(`calibrate: wrote labels.template.json \u2014 ${divergence.length} divergent `
  + `row${divergence.length === 1 ? "" : "s"} across `
  + `${Object.keys(divergentByFile).length} of ${assets.length} assets, blank and ready to fill.`);

function esc(s){ return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c])); }
function chip(state){
  const label = state === "pass" ? "holds" : state === "warn" ? "marginal" : state === "fail" ? "breaks" : "&mdash;";
  return `<span class="chip ${esc(state || "")}">${label}</span>`;
}

function renderHtml(r){
  const rows = (arr, cells) => arr.map(x => "<tr>" + cells(x).map(c => `<td>${c}</td>`).join("") + "</tr>").join("\n");

  const sweepMax = Math.max(1, ...r.safeZone.map(s => s.survivalRate || 0));
  const sweepBars = r.safeZone.map(s => {
    const inTarget = s.y >= 0.33 && s.y <= 0.40;
    const w = ((s.survivalRate || 0) / sweepMax) * 100;
    return `<tr class="${inTarget ? "target" : ""}">
      <td class="n">${s.y.toFixed(2)}</td>
      <td class="bar"><i style="width:${w.toFixed(1)}%"></i></td>
      <td class="n">${s.survivalRate === null ? "&mdash;" : s.survivalRate + "%"}</td>
      <td class="n">${s.meanCropVisible}%</td>
      <td class="n">${s.meanTypeOccluded}%</td>
      <td class="n">${s.meanScrimLoss}%</td></tr>`;
  }).join("\n");

  const thresholdBlocks = r.thresholds.map(t => {
    const d = t.distribution;
    const derived = t.derived
      ? `<p class="good"><b>Derived from ${r.labelled} labelled frames:</b> ${t.dir === "lower" ? "≤" : "≥"} ${t.derived.threshold}${t.unit === ":1" ? ":1" : " " + t.unit} &mdash; accuracy ${t.derived.accuracy}%, ${t.derived.falseAccepts} false accepts, ${t.derived.falseRejects} false rejects.</p>`
      : `<p class="warnp"><b>Not derivable.</b> A threshold separates good frames from bad ones, and nothing here records which is which. Supply <code>--labels</code> and this becomes evidence instead of a distribution.</p>`;
    const brk = t.naturalBreak
      ? `<p class="dim">Largest gap in the observed values sits at ${t.naturalBreak.at} (between ${t.naturalBreak.below} and ${t.naturalBreak.above}). Suggestive only &mdash; a gap is not a verdict.</p>` : "";
    return `<div class="card">
      <h3>${esc(t.label)} <span class="dim">&middot; ${t.current === null ? "not blocking"
        : "currently " + t.current + (t.unit === ":1" ? ":1" : " " + t.unit)}</span></h3>
      <p class="dim">${esc(t.note)}</p>
      ${d ? `<table class="mini"><tr><th>n</th><th>min</th><th>p10</th><th>p25</th><th>median</th><th>p75</th><th>p90</th><th>max</th></tr>
      <tr><td>${d.n}</td><td>${d.min}</td><td>${d.p10}</td><td>${d.p25}</td><td>${d.median}</td><td>${d.p75}</td><td>${d.p90}</td><td>${d.max}</td></tr></table>` : "<p class='dim'>No values.</p>"}
      ${derived}${brk}
    </div>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Scrim Proof calibration</title>
<style>
:root{color-scheme:dark;--ground:#0B0B0A;--panel:#141413;--line:#26251F;--ink:#F2EFE9;
  --dim:#8C877C;--pass:#7A8F6B;--warn:#C98A2E;--fail:#CF1C29}
*{box-sizing:border-box}body{margin:0;background:var(--ground);color:var(--ink);
  font:400 14px/1.55 "Archivo",Helvetica,Arial,sans-serif;padding:0 20px 60px}
.wrap{max-width:1100px;margin:0 auto}
h1{font-size:24px;margin:28px 0 4px;letter-spacing:-.01em}
h2{font-size:12px;letter-spacing:.11em;text-transform:uppercase;color:var(--dim);
  margin:36px 0 12px;border-top:1px solid var(--line);padding-top:16px}
h3{font-size:15px;margin:0 0 4px}
p{margin:0 0 10px}.dim{color:var(--dim);font-size:12px}
.good{color:var(--pass);font-size:12px}.warnp{color:var(--warn);font-size:12px}
.sub{color:var(--dim);margin-bottom:20px}
table{border-collapse:collapse;width:100%;font-size:13px}
th{text-align:left;font-weight:500;color:var(--dim);font-size:11px;letter-spacing:.06em;
  text-transform:uppercase;padding:6px 8px;border-bottom:1px solid var(--line)}
td{padding:7px 8px;border-bottom:1px solid var(--line);vertical-align:top}
td.n{font-family:"Space Mono",monospace;font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}
.chip{font:500 10px/1 "Space Mono",monospace;letter-spacing:.06em;text-transform:uppercase;
  padding:4px 6px;background:var(--dim);color:#0B0B0A;display:inline-block}
.chip.pass{background:var(--pass)}.chip.warn{background:var(--warn)}
.chip.fail{background:var(--fail);color:#fff}
.card{background:var(--panel);border:1px solid var(--line);padding:14px 16px;margin-bottom:12px}
.tiles{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px}
.tile{background:var(--panel);border:1px solid var(--line);padding:12px 16px;min-width:150px}
.tile b{display:block;font:500 22px/1.2 "Space Mono",monospace}
.tile span{color:var(--dim);font-size:11px;text-transform:uppercase;letter-spacing:.07em}
.banner{border:1px solid var(--warn);background:#2a1f0c;padding:11px 13px;margin:16px 0;font-size:13px}
.banner b{color:var(--warn)}
.bar{width:40%}.bar i{display:block;height:9px;background:var(--pass);opacity:.75}
tr.target td{background:rgba(122,143,107,.10)}
tr.target td.n:first-child{color:var(--pass);font-weight:500}
.mini td,.mini th{padding:4px 7px;font-family:"Space Mono",monospace;font-size:11px}
code{font-family:"Space Mono",monospace;font-size:12px;color:var(--ink)}
</style></head><body><div class="wrap">

<h1>Scrim Proof calibration</h1>
<p class="sub">${esc(r.assetCount)} frames &middot; theme ${esc(r.theme.themeName)}, profile built ${esc(r.theme.generatedAt.slice(0,10))} &middot; generated ${esc(r.generatedAt.slice(0,16).replace("T"," "))}</p>

${r.fontsLoaded ? "" : `<div class="banner"><b>Substitute fonts.</b> The page reported that the theme faces did not load, so every glyph-derived number here is directional only and none of it can set a threshold.</div>`}
${r.focalKnown < r.assetCount ? `<div class="banner"><b>Focal points assumed for ${r.assetCount - r.focalKnown} of ${r.assetCount} frames.</b> The subject is taken to sit at the centre of the target band. Crop, occlusion and obscuration figures for those frames describe that assumed position, not the actual subject.${r.unusableFocals.length ? ` ${r.unusableFocals.length} entr${r.unusableFocals.length === 1 ? "y was" : "ies were"} present in the focals file but not a usable x/y pair: <code>${r.unusableFocals.map(esc).join(", ")}</code>.` : ""}</div>` : ""}

<h2>Asset summary</h2>
<div class="tiles">
  <div class="tile"><b>${r.summary.legacy.pass}/${r.assetCount}</b><span>legacy pass</span></div>
  <div class="tile"><b>${r.summary.current.pass}/${r.assetCount}</b><span>current pass</span></div>
  <div class="tile"><b>${r.newlyFailed.length}</b><span>newly failed</span></div>
  <div class="tile"><b>${r.newlyPassed.length}</b><span>newly passed</span></div>
</div>
<table><tr><th>Asset</th><th>Slot</th><th>Legacy</th><th>Current</th><th>Focal</th>
<th>Intrusion</th><th>Contrast</th><th>Crop</th></tr>
${rows(r.perAsset, a => [esc(a.file), esc(a.slot), chip(a.legacy), chip(a.current),
  chip(a.focalStatus === "fail" ? "fail" : a.focalStatus === "pass" ? "pass" : null),
  `<span class="n">${a.worstIntrusion ?? "&mdash;"}</span>`,
  `<span class="n">${a.worstContrast ?? "&mdash;"}</span>`,
  `<span class="n">${a.worstCropVisible ?? "&mdash;"}%</span>`])}
</table>

<h2>Model divergence</h2>
<p class="dim">The two models are deliberately correlated &mdash; parity was established where they measure the same region &mdash; so agreement is the default and carries no information. Every bit of evidence about whether 2.0 predicts better than the band model lives in the rows below. <strong>A near-empty table does not mean the models are equivalent; it means this corpus never exercised the difference.</strong></p>
<div class="tiles">
  <div class="tile"><b>${r.divergenceSummary.diverging}</b><span>diverging rows</span></div>
  <div class="tile"><b>${r.divergenceSummary.rate === null ? "&mdash;" : r.divergenceSummary.rate + "%"}</b><span>of ${r.divergenceSummary.viewportRows} rows</span></div>
  <div class="tile"><b>${r.divergenceSummary.assetsDiverging}/${r.divergenceSummary.assets}</b><span>assets affected</span></div>
  <div class="tile"><b>${r.divergenceSummary.stricter}</b><span>2.0 stricter</span></div>
  <div class="tile"><b>${r.divergenceSummary.permissive}</b><span>2.0 more permissive</span></div>
</div>
${r.divergence.length ? `<table><tr><th>Asset</th><th>Viewport</th><th>Legacy</th><th>2.0</th><th>Metric</th><th>Delta</th><th>Explanation</th></tr>
${rows(r.divergence, d => [esc(d.file), esc(d.viewport), chip(d.legacy), chip(d.current),
  d.moved.map(m => esc(m.metric)).join("<br>") || "<span class='dim'>&mdash;</span>",
  d.moved.map(m => `<span class="n">${m.band} &rarr; ${m.glyph}</span> <span class="dim">${m.delta > 0 ? "+" : ""}${m.delta} &middot; ${esc(m.from)}&rarr;${esc(m.to)}</span>`).join("<br>") || "<span class='dim'>&mdash;</span>",
  esc(d.explanation)])}
</table>` : `<p class="dim"><strong>No divergence at any viewport.</strong> The band model and the glyph model reached the same verdict on every row. This corpus cannot answer whether 2.0 predicts publishability better &mdash; not because the answer is no, but because the question was never put. Frames that would put it: bright or busy content near the band boundary (y &asymp; 0.5 for hero), and short headlines whose rendered ink covers far less than the assumed band.</p>`}

${r.adjudication ? `<h2>Which model matched you</h2>
<p class="dim">Scored only on the rows where the models disagree &mdash; agreement rows carry no information. &ldquo;Would the model publish this?&rdquo; has two defensible readings, so both are given. <strong>Strict</strong> counts only <em>pass</em>, matching the run sheet's acceptance criteria. <strong>Lenient</strong> also counts <em>warn</em>. A conclusion holding under both is a finding; one that flips is a statement about where the line was drawn.</p>
<table><tr><th>Reading</th><th>Rows judged</th><th>Only legacy right</th><th>Only 2.0 right</th><th>Both right</th><th>Neither</th></tr>
${["strict", "lenient"].map(k => { const a = r.adjudication[k]; return `<tr><td>${k}</td><td class="n">${a.rows}</td><td class="n">${a.legacyOnly}</td><td class="n">${a.currentOnly}</td><td class="n">${a.both}</td><td class="n">${a.neither}</td></tr>`; }).join("\n")}
</table>
<table><tr><th>Asset</th><th>Viewport</th><th>Legacy</th><th>2.0</th><th>You</th></tr>
${rows(r.adjudication.rows, d => [esc(d.file), esc(d.viewport), chip(d.legacy), chip(d.current), chip(d.human === "accept" ? "pass" : "fail")])}
</table>` : ""}

<h2>Failure matrix</h2>
${r.failureMatrix.length ? `<table><tr><th>Asset</th><th>Viewport</th><th>Type</th><th>Severity</th><th>Reason</th></tr>
${rows(r.failureMatrix, f => [esc(f.file), esc(f.viewport), esc(f.type), chip(f.severity === "fail" ? "fail" : "warn"), esc(f.reason)])}
</table>` : "<p class='dim'>No failures.</p>"}

${r.diagnosisCrossTab ? `<h2>Diagnostic agreement</h2>
<p class="dim">Sub-classed rejects say <em>why</em> a frame was turned down. This crosses your reason against the causes the tool named for the same frame. A correct verdict reached for the wrong reason sends someone to fix the wrong thing, and only this table shows it. It is a cross-tab, not a score &mdash; scoring it would mean inventing a correspondence between your vocabulary and the tool's, and no such correspondence has been agreed.</p>
<table><tr><th>Your reason</th><th>Assets</th><th>Causes the tool named</th></tr>
${Object.entries(r.diagnosisCrossTab).map(([reason, cell]) => `<tr><td>${esc(reason)}</td><td class="n">${cell.assets}</td><td>${
  Object.entries(cell.toolReasons).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${esc(k)} <span class="dim">&times;${v}</span>`).join("<br>")
}</td></tr>`).join("\n")}
</table>` : ""}

<h2>Safe-zone analysis</h2>
<p class="dim">The focal point walked down the master, then asked what survives &mdash; across every frame and every viewport. Survival counts a sample only when it passes all three focal tests at that viewport. The highlighted rows are the current target band, 0.33 to 0.40.</p>
${r.sweepVerdict ? `<div class="card"><h3>Best observed position: y = ${r.sweepVerdict.bestY.toFixed(2)} <span class="dim">&middot; ${r.sweepVerdict.survivalRate}% of samples survive</span></h3>
<p class="dim">Squeezed from above by ${esc(r.sweepVerdict.limitedAbove || "\u2014")} and from below by ${esc(r.sweepVerdict.limitedBelow || "\u2014")}. ${r.sweepVerdict.inTargetBand ? "This sits inside the current 0.33\u20130.40 target band." : "<b>This sits outside the current 0.33\u20130.40 target band.</b>"}</p>
<p class="dim">The window depends on how big the subject is: this sweep used a focal disc of ${(FOCAL_R * 100).toFixed(0)}% of the master. A smaller subject has more room, a larger one less.</p></div>` : ""}
<table><tr><th>Subject Y</th><th>Survival</th><th>Rate</th><th>Mean visible</th><th>Mean under type</th><th>Mean scrim loss</th></tr>
${sweepBars}</table>

<h2>Threshold analysis</h2>
${thresholdBlocks}

<h2>Method</h2>
<p class="dim">Every number here came from the tool's own engine, driven through its automation surface &mdash; not from a second implementation. Frames were measured in both the legacy band mode and the current glyph mode at every viewport the theme renders. ${r.pageErrors.length ? "<br><b style='color:var(--fail)'>" + r.pageErrors.length + " page error(s) occurred during the run; see report.json.</b>" : ""}</p>
</div></body></html>`;
}
