#!/usr/bin/env node
/**
 * Wraps scrim-proof.html in a staff-gated Liquid page template.
 *
 *   node build-theme-page.mjs
 *
 * The tool is one self-contained file and must stay that way: a copy pasted into
 * the theme and then edited there would drift from the source with nothing to
 * catch it. So the template is GENERATED, and regenerating is the only supported
 * way to update the page.
 *
 * Gate: the page renders only for a logged-in customer whose tags include the
 * one named below. Everyone else gets a dead end. This is a real server-side
 * gate -- the tool's markup is never sent to an ungated visitor -- but note it
 * cannot return an HTTP 404 status, because a page template always responds 200.
 * It looks like a not-found page; it is not one to a crawler. The template asks
 * robots not to index it, which is the most a page template can do.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, "..", "scrim-proof.html");
const OUT = path.join(HERE, "..", "theme", "templates", "page.scrim-proof.liquid");
const STAFF_TAG = "staff";

const die = (m) => { console.error("build-theme-page: " + m); process.exit(1); };

if (!fs.existsSync(SRC)) die(`cannot find ${SRC}`);
const html = fs.readFileSync(SRC, "utf8");

// The tool must be self-contained before it can be a theme page: the template
// inlines it verbatim, so anything it fetches at runtime would be a request the
// storefront makes on a customer's behalf, from a page that is meant to be inert.
const external = html.match(/(?:src|href)="https?:\/\/[^"]+"/g) || [];
if (external.length) die(`the tool references external URLs and cannot be inlined:\n  ${external.join("\n  ")}`);
if (/\bfetch\s*\(/.test(html)) die("the tool calls fetch(); a theme page must not reach the network");
if (!/window\.scrimProof/.test(html)) die("the tool does not expose window.scrimProof -- wrong file?");

// Liquid only reacts to opening delimiters, but a future edit could introduce one
// and break the page with no error anywhere. raw makes that impossible.
if (html.includes("{% endraw %}")) die("the tool contains a literal {% endraw %}, which would close the raw block early");

const body = html
  .replace(/^[\s\S]*?<body[^>]*>/i, "")     // the template supplies its own document
  .replace(/<\/body>[\s\S]*$/i, "");
const head = (html.match(/<head[^>]*>([\s\S]*?)<\/head>/i) || [, ""])[1]
  .replace(/<title[\s\S]*?<\/title>/i, "");

const liquid = `{% comment %}
  Scrim Proof — internal creative QA tool.

  GENERATED FILE. Built from docs/spirithaus/scrim-proof.html by
  docs/spirithaus/tools/build-theme-page.mjs. Edit the source and regenerate;
  editing here forks the tool from the version the repo tests and publishes.

  Access: logged-in customers tagged "${STAFF_TAG}" only. The gate is server
  side, so the tool's markup is never sent to anyone else. It cannot return a
  real 404 status — a page template always answers 200 — so it renders a dead
  end and asks robots not to index.

  Built ${new Date().toISOString()}
{% endcomment %}
{% layout none %}<!DOCTYPE html>
<html lang="{{ request.locale.iso_code }}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow, noarchive">
{%- if customer and customer.tags contains '${STAFF_TAG}' -%}
<title>{{ page.title | default: 'Scrim Proof' }}</title>
{% raw %}${head.trim()}{% endraw %}
{%- else -%}
{%- comment -%}
  The title is inside the gate too. Outside it, page.title would put the tool's
  name in the browser tab of anyone who finds the URL -- not an exposure, but it
  tells them what they found.
{%- endcomment -%}
<title>Not available</title>
{%- endif -%}
</head>
<body>
{%- if customer and customer.tags contains '${STAFF_TAG}' -%}
{% raw %}${body.trim()}{% endraw %}
{%- else -%}
<style>
  :root{color-scheme:dark}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
    background:#0B0B0A;color:#8C877C;font:400 15px/1.6 "Helvetica Neue",Arial,sans-serif;padding:24px}
  .b{max-width:44ch;text-align:center}
  h1{font:600 19px/1.3 inherit;color:#F2EFE9;margin:0 0 10px}
  a{color:#CF1C29}
</style>
<div class="b">
  <h1>Not available</h1>
  <p>This page is for SPIRITHAUS staff. If that is you, sign in with the account
     that has access and open it again.</p>
  <p><a href="{{ routes.account_login_url }}?return_url={{ request.path | url_encode }}">Sign in</a>
     &middot; <a href="{{ routes.root_url }}">Back to the shop</a></p>
</div>
{%- endif -%}
</body>
</html>
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, liquid);
const kb = (Buffer.byteLength(liquid) / 1024).toFixed(0);
console.error(`build-theme-page: wrote ${path.relative(process.cwd(), OUT)} (${kb} KB, gate tag "${STAFF_TAG}")`);
