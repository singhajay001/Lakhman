#!/usr/bin/env node
/**
 * embed-fonts — inlines the theme's faces into scrim-proof.html as data URIs.
 *
 * Glyph measurement is only correct if the real faces are present. Linking a font
 * host makes the tool depend on the network to be accurate, which is the opposite
 * of what a measurement tool should be, so the faces travel inside the page.
 *
 *   node embed-fonts.mjs --fonts ../fonts --page ../scrim-proof.html
 *
 * The families and the weights come from theme-profile.json, so this cannot drift
 * from the theme independently. Requires node 18+, no dependencies.
 */

import fs from "node:fs";
import path from "node:path";

const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 2) args[argv[i].replace(/^--/, "")] = argv[i + 1];
for (const k of ["fonts", "page"]) {
  if (!args[k]) die(`missing --${k}\n\nusage: embed-fonts.mjs --fonts <dir> --page <html>`);
}
function die(m){ console.error("embed-fonts: " + m); process.exit(1); }

// family -> file, and the weight range each file covers. Archivo ships as a variable
// font, so one file answers every weight the theme asks for.
const FACES = [
  { file: "archivo-latin.woff2", family: "Archivo", weight: "100 900" },
  { file: "spacemono-latin.woff2", family: "Space Mono", weight: "400" }
];

const page = fs.readFileSync(args.page, "utf8");
const profileBlock = /<script type="application\/json" id="theme-profile">([\s\S]*?)<\/script>/.exec(page);
if (!profileBlock) die(`no embedded theme profile in ${args.page} — run embed-profile.mjs first`);
let profile;
try { profile = JSON.parse(profileBlock[1].replace(/<\\\//g, "</")); }
catch (e) { die(`embedded theme profile is not valid JSON: ${e.message}`); }

const wanted = [profile.tokens.fontDisplay, profile.tokens.fontMono];
for (const family of wanted) {
  if (!FACES.some(f => f.family === family)) {
    die(`the theme profile asks for "${family}" but no file here provides it.\n`
      + `The theme has changed typeface. Add the face to ${args.fonts} and to FACES, `
      + `rather than letting the page measure with a substitute.`);
  }
}

const rules = FACES.map(f => {
  const p = path.join(args.fonts, f.file);
  if (!fs.existsSync(p)) die(`missing ${f.file} in ${args.fonts}`);
  const buf = fs.readFileSync(p);
  if (buf.slice(0, 4).toString() !== "wOF2") die(`${f.file} is not a woff2 file`);
  return `@font-face{font-family:'${f.family}';font-style:normal;font-weight:${f.weight};`
       + `font-display:block;src:url(data:font/woff2;base64,${buf.toString("base64")}) format('woff2')}`;
}).join("\n");

const block = /(<style id="theme-fonts">)([\s\S]*?)(<\/style>)/;
if (!block.test(page)) die(`no <style id="theme-fonts"> block in ${args.page}`);

fs.writeFileSync(args.page, page.replace(block, `$1\n/* SIL Open Font License 1.1 — see fonts/ for the licence texts */\n${rules}\n$3`));
console.error(`embed-fonts: embedded ${FACES.map(f => f.family).join(" and ")} into ${args.page}`);
