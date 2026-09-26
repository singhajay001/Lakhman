#!/usr/bin/env node
/**
 * Builds the Organization JSON-LD snippet from ../social/profiles.json.
 *
 *   node build-social-jsonld.mjs
 *
 * sameAs is how Google is told that a set of profiles is one entity. That only
 * works if every URL in it resolves to a profile we actually control. A sameAs
 * pointing at a 404, or at one of the unrelated US businesses also called Spirit
 * Haus, does not merely fail to help -- it feeds the wrong entity.
 *
 * This snippet publishes the shop name, URL, email, slogan, logo and sameAs, and
 * nothing else. It deliberately carries no legal entity name, ABN or ACN: the shop's
 * instruction is that the licence number is the only such detail that goes out, and
 * those belong on the storefront policy pages rather than in every page's head. They
 * would sharpen the disambiguation from the US liquor retailer of the same name, but
 * that is not a reason to publish them here. Do not add them back.
 *
 * So the rule this tool enforces is: an account reaches sameAs only once its
 * status is "live", meaning the profile exists, is public, and is ours. Flip the
 * status in profiles.json as each account goes up, and regenerate. The tool
 * refuses to emit a placeholder, and refuses to emit nothing quietly.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, "..", "social", "profiles.json");
const OUT = path.join(HERE, "..", "theme", "snippets", "spirithaus-social-jsonld.liquid");

const die = (m) => { console.error("build-social-jsonld: " + m); process.exit(1); };

if (!fs.existsSync(SRC)) die(`cannot find ${SRC}`);

let profiles;
try { profiles = JSON.parse(fs.readFileSync(SRC, "utf8")); }
catch (e) { die(`${SRC} is not valid JSON: ${e.message}`); }

const brand = profiles.brand || die("profiles.json has no brand block");
for (const key of ["displayName", "url", "email"]) {
  if (!brand[key]) die(`brand.${key} is missing; it is required and has no sensible default`);
}

// Each platform's profile URL has a shape. A URL that does not match it is a typo
// or a paste of the wrong thing, and would put a bad URL in front of a crawler.
const SHAPE = {
  instagram: /^https:\/\/www\.instagram\.com\/[A-Za-z0-9._]+\/$/,
  pinterest: /^https:\/\/www\.pinterest\.com\/[A-Za-z0-9_]+\/$/,
  youtube:   /^https:\/\/www\.youtube\.com\/@[A-Za-z0-9._-]+$/,
  tiktok:    /^https:\/\/www\.tiktok\.com\/@[A-Za-z0-9._]+$/,
  x:         /^https:\/\/x\.com\/[A-Za-z0-9_]+$/,
  facebook:  /^https:\/\/www\.facebook\.com\/[A-Za-z0-9.]+$/,
  snapchat:  /^https:\/\/www\.snapchat\.com\/add\/[A-Za-z0-9._-]+$/,
  tumblr:    /^https:\/\/[A-Za-z0-9-]+\.tumblr\.com$/,
  vimeo:     /^https:\/\/vimeo\.com\/[A-Za-z0-9_-]+$/,
};

const accounts = profiles.accounts || [];
const live = accounts.filter((a) => a.status === "live");
const pending = accounts.filter((a) => a.status !== "live");

for (const a of live) {
  if (!a.url) die(`${a.platform} is marked live but has no url`);
  const shape = SHAPE[a.platform];
  if (!shape) die(`${a.platform} is marked live but this tool does not know its URL shape -- add one to SHAPE`);
  if (!shape.test(a.url)) die(`${a.platform} url does not match the expected shape:\n  got      ${a.url}\n  expected ${shape}`);
}

const dupes = live.map((a) => a.url).filter((u, i, all) => all.indexOf(u) !== i);
if (dupes.length) die(`the same url is listed twice: ${[...new Set(dupes)].join(", ")}`);

if (!live.length) {
  die(
    `no account in profiles.json is marked "live" yet, so there is nothing to put in sameAs.\n` +
    `  Create each account, then set its status to "live" and run this again.\n` +
    `  Still unclaimed: ${pending.map((a) => a.platform).join(", ")}\n` +
    `  Emitting a sameAs of profiles that do not exist would point Google at nothing,\n` +
    `  or worse at the unrelated US "Spirit Haus" accounts. That is why this is an error.`
  );
}

const sameAs = live.map((a) => `    ${JSON.stringify(a.url)}`).join(",\n");


const liquid = `{% comment %}
  Organization JSON-LD with sameAs — tells search engines that these profiles and
  this shop are one entity.

  GENERATED FILE. Built from docs/spirithaus/social/profiles.json by
  docs/spirithaus/tools/build-social-jsonld.mjs. Edit profiles.json and
  regenerate; an edit made here is lost on the next build.

  Live accounts at build time: ${live.map((a) => a.platform).join(", ")}
  Not yet claimed, so deliberately absent: ${pending.length ? pending.map((a) => a.platform).join(", ") : "none"}

  Include once, in the <head> of layout/theme.liquid, on every page:
    {% render 'spirithaus-social-jsonld' %}
{% endcomment %}
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": ${JSON.stringify(brand.displayName)},
  "url": ${JSON.stringify(brand.url)},
  "email": ${JSON.stringify(brand.email)},
  "areaServed": ${JSON.stringify(brand.areaServed || "AU")},
  "slogan": ${JSON.stringify(brand.tagline || "")},
{%- if settings.logo %}
  "logo": {{ settings.logo | image_url: width: 500 | prepend: 'https:' | json }},
{%- endif %}
  "sameAs": [
${sameAs}
  ]
}
</script>
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, liquid);
console.log(`build-social-jsonld: wrote ${path.relative(process.cwd(), OUT)}`);
console.log(`  in sameAs (${live.length}): ${live.map((a) => a.platform).join(", ")}`);
if (pending.length) console.log(`  held back (${pending.length}): ${pending.map((a) => a.platform).join(", ")}`);
