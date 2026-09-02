# Lakhman — SEO command centre

This repository is the SEO workspace for **two separate businesses**. It holds
the Claude SEO toolkit (`.claude/`), each business's profile and priorities
(`seo/`), drift baselines, and reports.

## The two businesses are not one project

| | Trafalgar Supermarket and Cellars | Spirithaus |
|---|---|---|
| Model | Supermarket + bottle shop, Marsfield NSW, with online grocery | Online spirits retail |
| Wins in | **Google map pack / local pack** | **Product & collection organic + Shopping** |
| Beaten by | Nearby stores within a few km | National AU spirits retailers |
| Primary metric | Calls, direction requests, store visits | Sessions → add-to-cart → revenue |
| Lead skills | `seo-local`, `seo-maps`, `seo-schema` | `seo-ecommerce`, `seo-schema`, `seo-technical` |
| Platform | MyFoodLink (hosted AU grocery/liquor SaaS) | Shopify, Dawn 16.0.0 |
| Code lives | not in git — hosted platform | `singhajay001/spirithaus-theme` |

**Routing rule.** Before running any SEO command, establish which business it is
for and read that profile first. A recommendation that is correct for one is
frequently wrong for the other — national keyword strategy is near-worthless to
Trafalgar, and map-pack tactics are near-worthless to Spirithaus.

**Never merge their identities.** If they share an owner, phone, or address, that
is a NAP hazard to manage deliberately, not a convenience. See each profile.

## Layout

| Path | Purpose |
|---|---|
| `seo/<business>/profile.md` | Business facts, priorities, constraints. Read before acting. |
| `seo/<business>/baselines/` | `seo drift` snapshots — the record of what changed |
| `seo/<business>/reports/` | Audit output, dated |
| `.claude/skills/`, `.claude/agents/` | Claude SEO v2.2.5, vendored |
| `.claude/seo-toolkit/VENDORED.md` | Provenance, security review, opt-in hook |

## Runtime

Prompt-driven skills work immediately. Python-backed commands (GSC, PageSpeed,
rendering, drift) need a one-time provision per session:

```bash
"$CLAUDE_PROJECT_DIR/.claude/seo-toolkit/bin/claude-seo" setup --skip-browser
```

## Alcohol retail constraint

Both businesses sell alcohol. This restricts paid and free Shopping surfaces,
requires age-gating, and shapes what schema and content are appropriate.
Verify current Google Merchant Center alcohol policy for Australia before
building any Shopping strategy — do not assume a general e-commerce playbook
applies. Treat this as a live constraint, not a footnote.

## Domain decisions — SETTLED

**Trafalgar.** `trafalgarsupermarketandcellars.com.au` is canonical.
`trafalgar.net.au` is a permanent 301 into it and is never published on.
`trafalgar-grocery.myfoodlink.com` is `noindex` while under construction, then
301s to canonical at launch.

**Spirithaus.** `spirithaus.com.au` with **`www` as the primary host**. Schema
uses `canonical_url` / `request.origin` rather than a hardcoded host, so this
can change later without touching markup.

**Bottle shop — platform constraint.** MyFoodLink cannot host a separate liquor
site: it is integrated to the POS via Friendly Grocer. The `/local-liquor` path
plan is dead. Local Liquor Marsfield gets its own small non-ecommerce site,
recommended at `localliquormarsfield.com.au`. A redirect-only domain was
considered and rejected — it adds no indexable content, which is the entire
deficit. See `seo/trafalgar/liquor-site-decision.md`.

Note the name collision: **IGA Trafalgar, 5 McCrorey St, Trafalgar VIC 3824** is
an unrelated business. Never merge their data.

## Spirithaus is tracked separately

Owner's instruction, 2026-09-02: keep Spirithaus separate from the Trafalgar
work. Its product-schema change is open as a pull request on
`singhajay001/spirithaus-theme` and is not a dependency of anything here.

## Environment limitation in remote sessions

This session's egress proxy blocks direct page fetches (`EGRESS_BLOCKED`), so
any command that loads a live URL — `seo audit`, `seo page`, `seo drift`,
PageSpeed, rendering — cannot run here. Web search works. Run live-fetch
commands from Claude Code in a **local terminal** instead; use remote sessions
for planning, schema generation, and strategy.
