# Getting the site live — step by step

Written for someone who has not done this before. Roughly an hour, most of it
waiting for DNS.

You need two things: a **domain** (the address people type) and **hosting** (the
computer that serves the files). They are separate purchases and can come from
different companies.

---

## Part 1 — Buy the domain

### Can you buy it from Cloudflare?

**Almost certainly not, for a `.com.au`.** Cloudflare Registrar only sells a
limited list of extensions, and Australian `.au` domains have their own rules
administered by auDA — you must have an ABN and a genuine connection to the name.
Most overseas registrars do not handle that.

So: **buy the domain from an Australian registrar, host it free at Cloudflare.**
That split is normal and costs nothing extra.

*(I could not check Cloudflare's current supported-extension list from this
session — my network access to external sites is blocked. If `.com.au` does
appear when you search there, buying it from Cloudflare is fine and slightly
simpler. Just check.)*

### Where to buy

Any Australian registrar — GoDaddy AU, VentraIP, Netregistry, Crazy Domains.
Prices for `.com.au` are broadly $20–30 a year. Shop around briefly; do not agonise.

### What you will be asked

`.com.au` requires an **ABN** and that the domain relates to your business:

- **ABN:** 62 685 087 110
- **Registrant name:** the entity on the ABN
- **Eligibility:** the domain matches your trading name, Local Liquor Marsfield

That satisfies auDA's rules comfortably.

### ⚠️ What to decline at checkout

Registrars bundle add-ons at a cheap first year that renews expensive. You need
**none** of these:

| Upsell | Why not |
|---|---|
| Web hosting | Cloudflare Pages is free |
| SSL certificate | Cloudflare includes it free |
| Website builder | You already have a site |
| Email hosting | Only if you want a `@localliquormarsfield.com.au` address — decide separately |
| Domain privacy | `.com.au` registrant details are public by auDA rule; paying to hide them does not work the same way as `.com` |

**Buy the domain. Nothing else.**

---

## Part 2 — Put the site on Cloudflare

1. Go to `dash.cloudflare.com` and **create a free account**. No card needed for
   this.
2. In the left menu find **Workers & Pages**, then **Create** → **Pages** →
   **Upload assets** (sometimes called "Direct Upload").
3. Name the project `localliquormarsfield`.
4. Drag in **`localliquormarsfield-site.zip`** — or unzip it first and drag the
   folder. Either works.
5. **Expand "Advanced settings" and set HTML handling to `auto-trailing-slash`.**
   Do not use `none`: it stops `/` mapping to `index.html`, so the homepage
   returns 404 while `/index.html` still loads. This setting is baked into each
   deployment, so it must be set on every upload.
6. Click **Deploy**.

It will give you a temporary address like
`localliquormarsfield.pages.dev`. **Open it.** The site is already live there,
before you have touched the domain. Click through all seven pages and check them
on your phone.

If something looks wrong, fix it now — this is the free rehearsal.

---

## Part 3 — Connect your domain

1. In Cloudflare, still on your Pages project: **Custom domains** → **Set up a
   custom domain**.
2. Enter `localliquormarsfield.com.au` (no `www`).
3. Cloudflare will say the domain needs to use its DNS, and will show you **two
   nameservers** — something like `xxx.ns.cloudflare.com`. **Copy both.**
4. Log in to wherever you bought the domain. Find **Nameservers** (usually under
   DNS settings or "Manage domain"). Replace what is there with Cloudflare's two.
5. Save.

Now wait. Nameserver changes take anywhere from ten minutes to a few hours.
Cloudflare emails you when it is active.

6. Once active, go back to **Custom domains** and add `www.localliquormarsfield.com.au`
   as well, set to **redirect** to the apex. Every page on this site declares the
   apex as canonical, so `www` must point at it rather than serve a copy.

---

## Part 4 — Check it worked

Visit `https://localliquormarsfield.com.au`:

- [ ] the padlock shows — HTTPS is on
- [ ] typing `www.` in front redirects to the version without it
- [ ] all seven pages load, and the menu works
- [ ] it looks right on a phone
- [ ] `localliquormarsfield.com.au/sitemap.xml` shows a list of pages
- [ ] `localliquormarsfield.com.au/robots.txt` loads

Then paste the address into <https://validator.schema.org/> and confirm it finds
a **LiquorStore**.

---

## Part 5 — Tell Google (the part that matters)

The site earns nothing until Google and your customers know it exists.

1. **Google Business Profile** → edit → **Website** → paste
   `https://localliquormarsfield.com.au`.
   **This is the whole point of the exercise.** The field is currently empty and
   the profile's Website button falls through to Instagram — so your most
   motivated visitors land on a social feed instead of a page with your hours,
   address, range and a tap-to-call button.
2. **Google Search Console** (`search.google.com/search-console`) → add a
   **Domain** property (not URL prefix) → verify with the DNS record it gives
   you, which you add in Cloudflare → then submit `sitemap.xml`.
3. Add the address to your **Instagram bio** and the other social profiles.

---

## Updating it later

Change the files, then in Cloudflare Pages → your project → **Create deployment**
→ upload the new zip. It goes live in seconds. The address never changes.

To rebuild the two generated pages after a stock change:

```bash
python3 build/build.py
./check.sh
```

Never upload while `check.sh` says NOT READY.
