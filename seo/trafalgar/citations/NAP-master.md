# NAP master — the single source of truth

Copy from here. Never retype. Every character matters: a directory that receives
`Pl` instead of `Place` becomes another contradictory signal.

Both profiles verified. **Each entity has its own phone number** — confirmed by
owner 2026-09-02. A distinct number per business is a deliberate strength here:
Google treats phone as an entity signal, so it reinforces the two-listing case.

---

## Entity 1 — the supermarket

```
Trafalgar Supermarket and Cellars
Shop 5, 1 Trafalgar Place
Marsfield NSW 2122
Australia
(02) 9868 1070
https://trafalgarsupermarketandcellars.com.au/supermarket
```

| Field | Value |
|---|---|
| Name | `Trafalgar Supermarket and Cellars` |
| Street | `Shop 5, 1 Trafalgar Place` |
| Suburb / State / Postcode | `Marsfield` · `NSW` · `2122` |
| Phone (local) | `(02) 9868 1070` |
| Phone (international) | `+61 2 9868 1070` |
| Coordinates | `-33.767749, 151.108628` |
| Primary category | Supermarket |
| Google profile | https://maps.app.goo.gl/wyZ4GMVoe18M1fkK6 |

**Hours** — Mon–Wed 8:00am–9:00pm · Thu–Sat 8:00am–10:00pm · Sun 8:00am–9:00pm

---

## Entity 2 — the bottle shop

```
Local Liquor Marsfield
5A, 1 Trafalgar Place
Marsfield NSW 2122
Australia
0452 480 487
https://trafalgarsupermarketandcellars.com.au/local-liquor
```

| Field | Value |
|---|---|
| Name | `Local Liquor Marsfield` |
| Street | `5A, 1 Trafalgar Place` |
| Suburb / State / Postcode | `Marsfield` · `NSW` · `2122` |
| Phone (local) | `0452 480 487` — **the bottle shop's own line, not the supermarket's** |
| Phone (international) | `+61 452 480 487` |
| Coordinates | `-33.767734, 151.107974` |
| Plus code | `64J5+R5 Marsfield` |
| Store code | `03435376679661119338` |
| Primary category | Liquor Store |
| Google profile | https://g.page/r/CenxQG-m-gUkEBI |
| Liquor licence | `LIQP700301260` — Packaged Liquor Licence (Bottle Shops & Delivery) |
| Licence name | **Trafalgar Cellars of Marsfield** — the legal name, not the trading name |
| Licensee / ABN | Ajaypaul Singh · ABN 62 685 087 110 |
| Licensed premises | **Shop 5/1 Trafalgar Place** — ⚠️ differs from the GBP address, see below |

**Hours** — Mon–Wed 8:00am–9:00pm · Thu–Sat 8:00am–10:00pm · Sun 10:00am–9:00pm

**Closed for liquor sales: Good Friday and Christmas Day.** A licence condition,
not a choice. Set these as special hours on the Google Business Profile every
year — a "hours may differ" label on a public holiday costs visits.

**Licensed** hours are wider than trading hours: Mon–Sat 5:00am–midnight, Sun
10:00am–10:00pm, 24 Dec 8:00am–midnight, 31 Dec 10:00am–midnight. The shop trades
shorter. Publish the *trading* hours; the licensed hours belong only on the
compliance notice.

**Social accounts are split by entity, and must stay that way.**

| Entity | Accounts |
|---|---|
| Local Liquor Marsfield | Instagram `@localliquormarsfield` |
| Trafalgar Supermarket and Cellars | Facebook, Instagram, TikTok, Threads — all `trafalgarsupermarket` |

`sameAs` carries the account to its own entity only. Putting the supermarket's
Facebook on the LiquorStore would tell Google they are one business, undoing the
separation the distinct suites, names and phone numbers establish. The bottle
shop's site links the group accounts as the parent brand's, in plain HTML, not
in its schema.

> Sunday opens at 10:00am, two hours after the supermarket. This is NSW
> packaged-liquor trading restriction, not an error. Never "correct" it to match.
>
> Sunday is the **only** day the two differ. Every other day both trade
> identically, so a mismatch on any other day is a data error.

---

## ⚠️ Two conflicts introduced by the licence document

### ~~The licensed premises is Shop 5/1, not Shop 5A~~ — SETTLED

Owner confirmed 2026-09-02: **use 5A everywhere, no compliance issue.** The
trading address matches the Google profile; the licence document keeps its own
wording on the compliance notice, quoted verbatim. Nothing further to resolve.

Original note kept below for the record.

### Original: the licensed premises is Shop 5/1, not Shop 5A

| Source | Address |
|---|---|
| Google Business Profile | Shop **5A**, 1 Trafalgar Place |
| Liquor licence LIQP700301260 | Shop **5/1** Trafalgar Place |

Shop 5/1 is the *supermarket's* unit in the model this workspace has been built
on. The whole two-listing case rests on the bottle shop occupying a distinct
suite, so this needs resolving — and it is a **compliance question before it is
an SEO one**. Liquor must be sold from the licensed premises.

Three possibilities, only the licensee can say which:

1. The bottle shop genuinely trades from Shop 5 and the GBP address is wrong.
2. It trades from 5A and the licence needs a variation with L&GA.
3. 5A is a sub-unit within the licensed premises and both are correct.

Until it is settled: quote the licence address **verbatim** in the compliance
notice, keep `Shop 5A` as the trading address everywhere else, and do not
"harmonise" the two. Raise it with the NSW Independent Liquor & Gaming Authority.

### "Trafalgar Cellars" is the licensed name, not a stale citation

The retire list below still stands **for directories**, because Google resolves
the entity on trading name and the GBP says Local Liquor Marsfield. But
"Trafalgar Cellars of Marsfield" is the **legal licence name** and must appear
on the compliance notice exactly as issued. Trading as one name and licensed
under another is ordinary; do not delete the licensed name from legal contexts.

## Names to retire

| Retire | Replace with |
|---|---|
| Trafalgar Cellars *(in directories only)* | Local Liquor Marsfield |
| Trafalgar Cellars Of Marsfield *(in directories only)* | Local Liquor Marsfield |
| Friendly Grocer Marsfield *(as a business name)* | Trafalgar Supermarket and Cellars |
| Trafalgar Supermarket *(without "and Cellars")* | Trafalgar Supermarket and Cellars |

Friendly Grocer is the **banner**, not the business name. It belongs in the page
body ("a proud Friendly Grocer store"), never in the name field.

## Address formats to never use

`Shop 5/1 Trafalgar Place` · `1 Trafalgar Pl, 5A` · `Shiop 5/1` · `1 Trafalgar Place`
without a suite number. The suite is what separates the two businesses.
