#!/usr/bin/env node
/**
 * Checks every counted field in ../social/copy-pack.md against its platform limit.
 *
 *   node check-copy-pack.mjs          # verify; exits non-zero on a problem
 *   node check-copy-pack.mjs --fix    # rewrite the stated counts to the measured ones
 *
 * The copy pack states a character count next to each field, like "(136 / 150)", so
 * whoever is pasting can see the text fits. A stated count that has drifted from the
 * text is worse than no count: it gets trusted, and the bio is silently truncated by
 * the platform mid-sentence -- which for these bios means truncating the liquor
 * licence number off the end.
 *
 * --fix corrects the stated counts. It never edits the copy: a field genuinely over
 * its limit is a writing problem, so it is reported and left alone.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, "..", "social", "copy-pack.md");
const FIX = process.argv.includes("--fix");

const die = (m) => { console.error("check-copy-pack: " + m); process.exit(1); };
if (!fs.existsSync(SRC)) die(`cannot find ${SRC}`);

let md = fs.readFileSync(SRC, "utf8");

// Two shapes carry a count: a fenced block below the label, or inline code beside it.
const PATTERNS = [
  /\((\d+) \/ (\d+)\):?\s*\n\n```\n([\s\S]*?)\n```/g,
  /\((\d+) \/ (\d+)\): `([^`]+)`/g,
];

const fields = [];
for (const re of PATTERNS) {
  let m;
  while ((m = re.exec(md))) {
    fields.push({ stated: +m[1], limit: +m[2], text: m[3], whole: m[0] });
  }
}
if (!fields.length) die("found no counted fields -- has the copy pack changed shape?");

const over = [], drifted = [];
for (const f of fields) {
  f.actual = [...f.text].length;                       // code points, not UTF-16 units
  if (f.actual > f.limit) over.push(f);
  else if (f.actual !== f.stated) drifted.push(f);
}

// A bio that still carries the placeholder must never ship.
const placeholders = [...md.matchAll(/<LICENCE NUMBER>/g)].length;

for (const f of over) {
  console.error(`OVER LIMIT  ${f.actual} / ${f.limit}  "${f.text.replace(/\n/g, " ").slice(0, 60)}..."`);
}

if (FIX && drifted.length && !over.length) {
  for (const f of drifted) {
    md = md.replace(f.whole, f.whole.replace(`(${f.stated} / ${f.limit})`, `(${f.actual} / ${f.limit})`));
  }
  fs.writeFileSync(SRC, md);
  console.log(`check-copy-pack: corrected ${drifted.length} stated count(s)`);
} else {
  for (const f of drifted) {
    console.error(`COUNT DRIFT stated ${f.stated}, actual ${f.actual} (limit ${f.limit})  "${f.text.replace(/\n/g, " ").slice(0, 50)}..."`);
  }
}

if (placeholders) console.error(`PLACEHOLDER <LICENCE NUMBER> still present ${placeholders} time(s) -- these bios are not publishable`);

const bad = over.length + placeholders + (FIX ? 0 : drifted.length);
console.log(`check-copy-pack: ${fields.length} counted fields, ${over.length} over limit, ${placeholders} placeholder(s) left`);
process.exit(bad && !(FIX && !over.length && !placeholders) ? 1 : 0);
