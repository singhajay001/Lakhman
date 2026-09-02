# Live profile audit — Local Liquor Marsfield

Observed 2026-09-02 from the owner's own Google search result. This is what is
**live**, not what we assumed.

| Field | Live value | Matches our build? |
|---|---|---|
| Name | Local Liquor Marsfield | ✅ |
| Category | Bottle Shop and Liquor Store | ✅ correct type |
| Address | `5A, 1 Trafalgar Pl, Marsfield NSW 2122` | ⚠️ format |
| **Phone** | **0452 480 487** | ✅ resolved — site now matches |
| Rating | **5.0 from 4 reviews** | new information |
| Website | **empty** — button falls through to Instagram | ⚠️ set at launch |
| Mon–Wed | 8am–9pm | ✅ |
| Thu–Sat | 8am–10pm | ✅ |
| Sun | 10am–9pm | ✅ |
| Ownership | "You manage this Business Profile" | ✅ verified |

## ✅ Correction to earlier advice

**The hours on this profile are already right.** Earlier this workspace listed
"fix 09:00 → 08:00 on both profiles" as the top action. That was wrong for the
liquor profile: it correctly shows an 8am open, seven days, matching the
owner-confirmed hours exactly.

The 9am error is real but lives in the **third-party directories** — aussie-hours,
Shopfully, openinghoursau. The action is theirs to fix, not the profile's. The
supermarket profile has not been observed and may still need checking.

## 🔴 Phone number conflict

| Source | Number |
|---|---|
| Live Google Business Profile | **0452 480 487** |
| Everything built in this workspace | (02) 9868 1070 |

The owner stated the bottle shop shares 02 9868 1070. The live profile says
otherwise. 28 occurrences of the landline across the site, plus 19 in `tel:`
links and schema, are affected.

**Resolved 2026-09-02.** The owner confirmed 0452 480 487 is the bottle shop's
line. The site, the LiquorStore schema, the NAP master, the two bottle-shop
correction drafts and the pre-launch check now all use it. The supermarket and
the parent Organization keep (02) 9868 1070.

### If the mobile is correct, that is good news

A distinct phone number per entity **strengthens** the two-listing case. Google
uses phone as an entity signal, so:

- Trafalgar Supermarket and Cellars → (02) 9868 1070
- Local Liquor Marsfield → 0452 480 487

...gives the two businesses genuinely separate identities, on top of the distinct
suites. A shared number pulls the other way, inviting Google to treat them as one.

So if 0452 480 487 is really answered at the bottle shop, keep it, and update the
site, the schema and every citation to match.

## ⚠️ Address format on the profile

Live: `5A, 1 Trafalgar Pl` — abbreviated, no "Shop", "Pl" not "Place".

Every directory that scrapes the profile copies that string. Change it to
**`5A, 1 Trafalgar Place`** so it matches the site, the schema and the NAP
master byte-for-byte.

## Owner actions completed — 2026-09-02

- ✅ **Website field set** on the Google Business Profile. It previously fell
  through to Instagram; the profile now points at `localliquormarsfield.com.au`.
- ✅ **All four reviews replied to.** Response rate is itself a ranking signal
  and the base was 5.0 from four reviews.

✅ **Resolved 2026-09-02.** The 404 was Cloudflare's `html_handling` set to
`none`, which stops `/` mapping to `index.html`. Redeployed with
`auto-trailing-slash` and the site serves correctly. The profile's website field
now points at a working page.

## 🚀 SITE IS LIVE — 2026-09-02

`https://localliquormarsfield.com.au` is deployed on Cloudflare Workers static
assets, custom domain connected, apex canonical. The deficit the ranking
diagnosis identified — a verified profile with nothing on the web corroborating
the business — is closed.

**The remaining action is one field.** See below.

## ✅ No website is set — the button falls through to Instagram

Owner confirmed the website field is **empty**. The Website button on the
listing resolves to the Instagram account, which is Google's fallback, not a
configured link.

So this is an **add**, not a replace. The moment
`localliquormarsfield.com.au` is live, put it in the website field. Until then
the profile is sending its most motivated visitors to a social feed instead of a
page with hours, address, range and click-to-call.

This is the single most valuable thing the new site unlocks.

## 4 reviews at 5.0 — the real lever

A perfect rating on a thin base. Four reviews is not enough to compete: rivals in
Marsfield and Macquarie Park carry far more, and review count feeds prominence
directly.

This is the single highest-return action available, and it needs no website, no
developer and no waiting:

- QR code to `g.page/r/CenxQG-m-gUkEBI/review` at the register and on receipts
- ask every customer, in person, at the counter
- reply to all four existing reviews today — response rate is itself a signal

Going from 4 to 40 genuine reviews would move ranking further than anything else
outstanding in this workspace.

Do not gate by expected rating, offer anything in exchange, or post reviews
yourself. Each risks removal of every review on the profile.
