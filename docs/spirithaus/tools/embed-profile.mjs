#!/usr/bin/env node
/**
 * embed-profile — inlines theme-profile.json into scrim-proof.html.
 *
 * The page cannot fetch the profile at runtime. Opened from disk it is a file://
 * document, where fetch of a sibling file is blocked; published as an artifact it
 * is a single self-contained page with nothing alongside it. So the profile is
 * embedded at build time and the page stays one file that works in both places.
 *
 * The consequence: regenerating the profile is only half the job. Run this after
 * build-theme-profile.mjs, or the page keeps rendering from the previous theme.
 *
 *   node embed-profile.mjs --profile ../theme-profile.json --page ../scrim-proof.html
 */

import fs from "node:fs";

const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 2) args[argv[i].replace(/^--/, "")] = argv[i + 1];
for (const k of ["profile", "page"]) {
  if (!args[k]) {
    console.error(`embed-profile: missing --${k}\n\nusage: embed-profile.mjs --profile <json> --page <html>`);
    process.exit(1);
  }
}

const profileText = fs.readFileSync(args.profile, "utf8");
let profile;
try {
  profile = JSON.parse(profileText);
} catch (e) {
  console.error(`embed-profile: ${args.profile} is not valid JSON: ${e.message}`);
  process.exit(1);
}
if (profile.schemaVersion !== 1) {
  console.error(`embed-profile: profile schemaVersion ${profile.schemaVersion} is not supported by this page`);
  process.exit(1);
}

const page = fs.readFileSync(args.page, "utf8");
const block = /(<script type="application\/json" id="theme-profile">)([\s\S]*?)(<\/script>)/;
if (!block.test(page)) {
  console.error(`embed-profile: no <script id="theme-profile"> block in ${args.page}`);
  process.exit(1);
}

// "</" inside a JSON string would close the script element early. Nothing in the
// profile contains it today — the heading copy carries <strong> tags — but escaping
// it costs nothing and removes a way for a copy change to break the page silently.
const safe = JSON.stringify(profile, null, 2).replace(/<\//g, "<\\/");

fs.writeFileSync(args.page, page.replace(block, `$1\n${safe}\n$3`));
console.error(
  `embed-profile: embedded ${args.profile} (theme ${profile.source.themeName}, generated ${profile.generatedAt}) into ${args.page}`
);
