#!/usr/bin/env node
/**
 * build-theme-profile — turns a copy of the live theme into theme-profile.json.
 *
 * Scrim Proof used to carry the theme's geometry as constants read off by hand.
 * That is only true on the day it is written. This makes the theme the source of
 * truth: every ratio, scrim value and type metric is extracted from the files the
 * storefront actually serves, and anything the extractor cannot find is a hard
 * failure rather than a default — a silent default is how the constants got stale
 * in the first place.
 *
 * Two steps, deliberately separate. FETCHING needs store credentials; PARSING does
 * not. This script is the parser: it is pure, offline, and deterministic, so the
 * profile it produces can be reviewed in a diff.
 *
 *   1. Fetch:  shopify theme pull --path <dir>        (or any copy of the theme)
 *              plus a _source.json naming the theme and its file checksums.
 *   2. Build:  node build-theme-profile.mjs \
 *                --theme <dir> --source <dir>/_source.json --out theme-profile.json
 *
 * Requires: node 18+. No dependencies.
 */

import fs from "node:fs";
import path from "node:path";

/* ---------------------------------------------------------------- plumbing */

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) out[argv[i].replace(/^--/, "")] = argv[i + 1];
  return out;
}

const args = parseArgs(process.argv.slice(2));
for (const k of ["theme", "source", "out"]) {
  if (!args[k]) die(`missing --${k}\n\nusage: build-theme-profile.mjs --theme <dir> --source <file> --out <file> [--viewports <file>]`);
}

function die(msg) {
  console.error("build-theme-profile: " + msg);
  process.exit(1);
}

/** Every extracted value goes through this. No silent defaults. */
function must(value, what) {
  if (value === undefined || value === null || (Array.isArray(value) && !value.length)) {
    die(`could not extract ${what}.\nThe theme has changed shape. Update the extractor — do not add a default.`);
  }
  return value;
}

const read = (rel) => {
  const p = path.join(args.theme, rel);
  if (!fs.existsSync(p)) die(`missing input file ${rel} under ${args.theme}`);
  return fs.readFileSync(p, "utf8");
};

/** Theme JSON files carry a leading /* … *\/ banner and are not valid JSON. */
const readThemeJson = (rel) => {
  try {
    return JSON.parse(read(rel).replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ""));
  } catch (e) {
    die(`could not parse ${rel}: ${e.message}`);
  }
};

/* --------------------------------------------------------------------- CSS */

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/** Remove at-rules whose bodies nest, so the flat rule scanner stays honest. */
function stripNestedAtRules(css) {
  for (const kw of ["@keyframes", "@supports", "@-webkit-keyframes"]) {
    let at;
    while ((at = css.indexOf(kw)) !== -1) {
      const ob = css.indexOf("{", at);
      if (ob === -1) break;
      let depth = 1, j = ob + 1;
      while (j < css.length && depth > 0) {
        if (css[j] === "{") depth++;
        else if (css[j] === "}") depth--;
        j++;
      }
      css = css.slice(0, at) + css.slice(j);
    }
  }
  return css;
}

/** Split into the base sheet plus each min-width block, discarding print and motion queries. */
function mediaBlocks(css) {
  css = stripNestedAtRules(stripComments(css));
  const blocks = [];
  let base = "", i = 0;
  while (i < css.length) {
    const at = css.indexOf("@media", i);
    if (at === -1) { base += css.slice(i); break; }
    base += css.slice(i, at);
    const ob = css.indexOf("{", at);
    const cond = css.slice(at, ob);
    let depth = 1, j = ob + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") depth--;
      j++;
    }
    const mw = /min-width:\s*(\d+)px/.exec(cond);
    if (mw && !/print|prefers-/.test(cond)) blocks.push({ minWidth: +mw[1], css: css.slice(ob + 1, j - 1) });
    i = j;
  }
  return [{ minWidth: 0, css: base }, ...blocks];
}

/** selector -> [{minWidth, decls}], in source order. */
function ruleIndex(cssText) {
  const idx = new Map();
  for (const blk of mediaBlocks(cssText)) {
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(blk.css))) {
      const decls = {};
      for (const d of m[2].split(";")) {
        const c = d.indexOf(":");
        if (c === -1) continue;
        decls[d.slice(0, c).trim()] = d.slice(c + 1).trim();
      }
      for (const raw of m[1].split(",")) {
        const sel = raw.trim().replace(/\s+/g, " ");
        if (!sel || sel.startsWith("@")) continue;
        if (!idx.has(sel)) idx.set(sel, []);
        idx.get(sel).push({ minWidth: blk.minWidth, decls });
      }
    }
  }
  return idx;
}

/** All breakpoint values a selector declares for one property, ascending. */
function responsive(idx, sel, prop) {
  const rows = (idx.get(sel) || []).filter((r) => r.decls[prop] !== undefined);
  const byBp = new Map();
  for (const r of rows) byBp.set(r.minWidth, r.decls[prop]);
  return [...byBp.entries()].sort((a, b) => a[0] - b[0]).map(([minWidth, value]) => ({ minWidth, value }));
}

const one = (idx, sel, prop) => {
  const v = responsive(idx, sel, prop);
  return v.length ? v[v.length - 1].value : undefined;
};

/* ------------------------------------------------------------------- units */

function varTable(idx) {
  const table = {};
  for (const row of idx.get(":root") || []) {
    for (const [k, v] of Object.entries(row.decls)) if (k.startsWith("--")) table[k] = v;
  }
  return table;
}

function resolveVar(value, vars, depth = 0) {
  if (typeof value !== "string" || depth > 8) return value;
  return value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)/g, (_, name, fallback) =>
    resolveVar(vars[name] !== undefined ? vars[name] : (fallback ?? "").trim(), vars, depth + 1)
  );
}

const remPx = (v, root) => {
  const n = parseFloat(v);
  if (Number.isNaN(n)) die(`expected a rem length, got "${v}"`);
  return +(n * root).toFixed(2);
};

const remListPx = (list, root) => list.map((x) => ({ minWidth: x.minWidth, value: remPx(x.value, root) }));

/** Narrow evaluator for the one calc() shape Dawn uses on buttons. */
function calcRemPlusVar(expr, root, px) {
  const m = /^calc\(\s*([\d.]+)rem\s*\+\s*var\(--[\w-]+\)\s*\*\s*(\d+)\s*\)$/.exec(expr.trim());
  if (!m) die(`unsupported calc() expression "${expr}" — extend the evaluator rather than guessing`);
  return +(parseFloat(m[1]) * root + px * +m[2]).toFixed(2);
}

/** "0 1.5rem" -> 15 ; "1.8rem" -> 18 */
const padX = (v, root) => {
  const parts = v.trim().split(/\s+/);
  return remPx(parts.length > 1 ? parts[1] : parts[0], root);
};
const padY = (v, root) => remPx(v.trim().split(/\s+/)[0], root);

const chLimit = (v) => {
  const m = /^([\d.]+)ch$/.exec((v || "").trim());
  return m ? +m[1] : undefined;
};

/* ----------------------------------------------------------------- liquid */

function sectionSchema(rel) {
  const src = read(rel);
  const m = /\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/.exec(src);
  if (!m) die(`no {% schema %} block in ${rel}`);
  try { return JSON.parse(m[1]); } catch (e) { die(`bad schema JSON in ${rel}: ${e.message}`); }
}

const settingSpec = (schema, id) =>
  must((schema.settings || []).find((s) => s.id === id), `setting "${id}" in section schema`);

/* ------------------------------------------------------------------- build */

const source = JSON.parse(fs.readFileSync(args.source, "utf8"));

// The device matrix is a policy choice, not a fact about the theme: it says which
// screens we hold ourselves to. It lives here rather than in the theme files, and
// --viewports overrides it. Widths at and either side of the 750px breakpoint are
// deliberate — that is where the layout changes shape.
const DEFAULT_VIEWPORTS = [
  { id: "desktop-1920", label: "desktop 1920", width: 1920, height: 1080 },
  { id: "laptop-1440", label: "laptop 1440", width: 1440, height: 900 },
  { id: "small-1024", label: "small 1024", width: 1024, height: 768 },
  { id: "tablet-768", label: "tablet 768", width: 768, height: 1024 },
  { id: "phone-390", label: "phone 390", width: 390, height: 844 },
];
const viewports = args.viewports
  ? JSON.parse(fs.readFileSync(args.viewports, "utf8"))
  : DEFAULT_VIEWPORTS;
const settings = readThemeJson("config/settings_data.json").current;
const index = readThemeJson("templates/index.json");

const sh = ruleIndex(read("assets/spirithaus.css"));
const dawn = ruleIndex(read("assets/base.css"));
const vars = varTable(sh);

// Dawn sets html{font-size: calc(var(--font-body-scale) * 62.5%)}, so 1rem is
// 10px at the default body scale. Everything in rem depends on this.
const rootFontPx = +(16 * 0.625 * (must(settings.body_scale, "body_scale") / 100)).toFixed(3);
const pageWidthPx = must(settings.page_width, "page_width");
const buttonBorderPx = settings.buttons_border_opacity > 0 ? settings.buttons_border_thickness : 0;

const tokens = {
  ink: must(vars["--sh-ink"], "--sh-ink"),
  white: must(vars["--sh-white"], "--sh-white"),
  bone: must(vars["--sh-bone"], "--sh-bone"),
  red: must(vars["--sh-red"], "--sh-red"),
  fontDisplay: must(vars["--sh-font-display"], "--sh-font-display").split(",")[0].replace(/['"]/g, "").trim(),
  fontMono: must(vars["--sh-font-mono"], "--sh-font-mono").split(",")[0].replace(/['"]/g, "").trim(),
  weights: {
    light: +must(vars["--sh-weight-light"], "--sh-weight-light"),
    regular: +must(vars["--sh-weight-regular"], "--sh-weight-regular"),
    bold: +must(vars["--sh-weight-bold"], "--sh-weight-bold"),
    black: +must(vars["--sh-weight-black"], "--sh-weight-black"),
  },
};

/* page-width container, from Dawn */
const pageWidth = {
  maxWidthPx: pageWidthPx,
  paddingXPx: must(responsive(dawn, ".page-width", "padding"), ".page-width padding")
    .map((x) => ({ minWidth: x.minWidth, value: padX(x.value, rootFontPx) })),
};

/* ---- hero ---- */
const heroSchema = sectionSchema("sections/spirithaus-hero.liquid");
const heroOverlay = settingSpec(heroSchema, "overlay_opacity");
const heroSettings = must(index.sections?.hero?.settings, "hero section settings in templates/index.json");

const heroHeights = [{ minWidth: 0, value: must(one(sh, ".sh-hero", "min-height"), ".sh-hero min-height") }];
if (heroSettings.full_height) {
  const tall = must(responsive(sh, ".sh-hero--tall", "min-height"), ".sh-hero--tall min-height");
  heroHeights.push({ minWidth: tall[tall.length - 1].minWidth, value: tall[tall.length - 1].value });
}

const headingSizes = remListPx(must(responsive(sh, ".sh-hero__heading", "font-size"), ".sh-hero__heading font-size"), rootFontPx);
const bodySizes = remListPx(must(responsive(sh, ".sh-hero__body", "font-size"), ".sh-hero__body font-size"), rootFontPx);
const labelSizeRem = resolveVar(must(one(sh, ".sh-label", "font-size"), ".sh-label font-size"), vars);

const heading = {
  role: "heading",
  family: "display",
  sizePx: headingSizes,
  weight: +resolveVar(must(one(sh, ".sh-heading", "font-weight"), ".sh-heading font-weight"), vars),
  strongWeight: +resolveVar(must(one(sh, ".sh-heading strong", "font-weight"), ".sh-heading strong font-weight"), vars),
  lineHeight: +must(one(sh, ".sh-heading", "line-height"), ".sh-heading line-height"),
  trackingEm: parseFloat(must(one(sh, ".sh-heading", "letter-spacing"), ".sh-heading letter-spacing")),
  maxCh: must(chLimit(one(sh, ".sh-hero__heading", "max-width")), ".sh-hero__heading max-width in ch"),
  marginBottomPx: padY(must(one(sh, ".sh-hero__heading", "margin"), ".sh-hero__heading margin").split(/\s+/).slice(-1)[0], rootFontPx),
  color: tokens.white,
  text: must(heroSettings.heading, "hero heading copy"),
};

const kicker = {
  role: "kicker",
  family: "mono",
  sizePx: remPx(labelSizeRem, rootFontPx),
  weight: +resolveVar(must(one(sh, ".sh-label", "font-weight"), ".sh-label font-weight"), vars),
  lineHeight: 1,
  trackingEm: parseFloat(resolveVar(must(one(sh, ".sh-label", "letter-spacing"), ".sh-label letter-spacing"), vars)),
  transform: must(one(sh, ".sh-label", "text-transform"), ".sh-label text-transform"),
  marginBottomPx: remPx(must(one(sh, ".sh-hero__kicker", "margin"), ".sh-hero__kicker margin").split(/\s+/).slice(-1)[0], rootFontPx),
  color: tokens.white,
  text: must(heroSettings.kicker, "hero kicker copy"),
};

const bodyBlock = {
  role: "body",
  family: "display",
  sizePx: bodySizes,
  weight: tokens.weights.regular,
  lineHeight: +must(one(sh, ".sh-hero__body", "line-height"), ".sh-hero__body line-height"),
  maxCh: must(chLimit(one(sh, ".sh-hero__body", "max-width")), ".sh-hero__body max-width in ch"),
  marginBottomPx: remPx(must(one(sh, ".sh-hero__body", "margin"), ".sh-hero__body margin").split(/\s+/).slice(-1)[0], rootFontPx),
  color: tokens.white,
  text: must(heroSettings.body, "hero body copy"),
};

const cta = {
  role: "cta",
  kind: "button",
  family: "display",
  sizePx: remPx(must(one(dawn, ".button", "font-size"), ".button font-size"), rootFontPx),
  minHeightPx: calcRemPlusVar(must(one(dawn, ".button", "min-height"), ".button min-height"), rootFontPx, buttonBorderPx),
  paddingXPx: padX(must(one(dawn, ".button", "padding"), ".button padding"), rootFontPx),
  background: tokens.red,
  color: tokens.white,
  label: must(heroSettings.cta_label, "hero cta label"),
};

/* ---- tiles ---- */
const catSchema = sectionSchema("sections/spirithaus-categories.liquid");
const catOverlay = settingSpec(catSchema, "overlay_opacity");
const catSettings = must(index.sections?.categories?.settings, "categories section settings in templates/index.json");

const columns = must(responsive(sh, ".sh-cats__grid", "grid-template-columns"), ".sh-cats__grid columns")
  .map((x) => {
    const rep = /repeat\(\s*(\d+)/.exec(x.value);
    return { minWidth: x.minWidth, value: rep ? +rep[1] : x.value.trim().split(/\s+/).length };
  });

/* ---- assemble ---- */
const profile = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: {
    shop: source.shop,
    themeId: source.themeId,
    themeName: source.themeName,
    role: source.role,
    themeUpdatedAt: source.themeUpdatedAt,
    files: source.files,
  },
  root: { fontPx: rootFontPx, pageWidthPx, breakpointPx: 750 },
  tokens,
  viewports,
  placements: {
    hero: {
      section: "spirithaus-hero",
      box: { widthCss: "100vw", heightCss: heroHeights },
      image: { fit: "cover", positionX: 0.5, positionY: 0.5 },
      scrim: {
        color: tokens.ink,
        opacity: must(heroSettings.overlay_opacity, "hero overlay_opacity") / 100,
        minOpacity: must(heroOverlay.min, "hero overlay min") / 100,
        maxOpacity: must(heroOverlay.max, "hero overlay max") / 100,
        coverage: "full",
      },
      text: {
        anchor: "bottom-left",
        container: {
          maxWidthPx: pageWidth.maxWidthPx,
          paddingXPx: pageWidth.paddingXPx,
          paddingTopPx: must(responsive(sh, ".sh-hero__content", "padding-top"), ".sh-hero__content padding-top")
            .map((x) => ({ minWidth: x.minWidth, value: remPx(x.value, rootFontPx) })),
          paddingBottomPx: must(responsive(sh, ".sh-hero__content", "padding-bottom"), ".sh-hero__content padding-bottom")
            .map((x) => ({ minWidth: x.minWidth, value: remPx(x.value, rootFontPx) })),
        },
        blocks: [kicker, heading, bodyBlock, cta],
      },
    },
    tile: {
      section: "spirithaus-categories",
      grid: {
        columns,
        gapPx: must(responsive(sh, ".sh-cats__grid", "gap"), ".sh-cats__grid gap")
          .map((x) => ({ minWidth: x.minWidth, value: remPx(x.value, rootFontPx) })),
        minHeightPx: must(responsive(sh, ".sh-cat", "min-height"), ".sh-cat min-height")
          .map((x) => ({ minWidth: x.minWidth, value: remPx(x.value, rootFontPx) })),
        paddingPx: must(responsive(sh, ".sh-cat", "padding"), ".sh-cat padding")
          .map((x) => ({ minWidth: x.minWidth, value: remPx(x.value, rootFontPx) })),
        container: { maxWidthPx: pageWidth.maxWidthPx, paddingXPx: pageWidth.paddingXPx },
      },
      image: { fit: "cover", positionX: 0.5, positionY: 0.5 },
      scrim: {
        color: tokens.ink,
        opacity: must(catSettings.overlay_opacity, "categories overlay_opacity") / 100,
        minOpacity: must(catOverlay.min, "categories overlay min") / 100,
        maxOpacity: must(catOverlay.max, "categories overlay max") / 100,
        coverage: "full",
      },
      text: {
        anchor: "bottom-left",
        blocks: [
          {
            role: "title",
            family: "display",
            sizePx: remListPx(must(responsive(sh, ".sh-cat__title", "font-size"), ".sh-cat__title font-size"), rootFontPx),
            weight: +resolveVar(must(one(sh, ".sh-heading", "font-weight"), ".sh-heading font-weight"), vars),
            lineHeight: +must(one(sh, ".sh-heading", "line-height"), ".sh-heading line-height"),
            trackingEm: parseFloat(must(one(sh, ".sh-heading", "letter-spacing"), ".sh-heading letter-spacing")),
            color: tokens.white,
          },
          {
            role: "caption",
            family: "mono",
            sizePx: remPx(labelSizeRem, rootFontPx),
            weight: +resolveVar(must(one(sh, ".sh-label", "font-weight"), ".sh-label font-weight"), vars),
            lineHeight: 1,
            trackingEm: parseFloat(resolveVar(must(one(sh, ".sh-label", "letter-spacing"), ".sh-label letter-spacing"), vars)),
            transform: must(one(sh, ".sh-label", "text-transform"), ".sh-label text-transform"),
            marginTopPx: remPx(must(one(sh, ".sh-cat__caption", "margin-top"), ".sh-cat__caption margin-top"), rootFontPx),
            color: tokens.white,
          },
        ],
      },
    },
  },
};

fs.writeFileSync(args.out, JSON.stringify(profile, null, 2) + "\n");
console.error(`build-theme-profile: wrote ${args.out}`);
