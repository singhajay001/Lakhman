# Theme files

Generated files for the SPIRITHAUS Shopify theme. **Do not edit them here** — they
are built from source elsewhere in this repo, and an edit made in the theme forks
the tool from the version the repo tests.

## `templates/page.scrim-proof.liquid`

Scrim Proof as a staff-gated page on the storefront.

```sh
node ../tools/build-theme-page.mjs      # regenerate after changing scrim-proof.html
```

The generator refuses to build if the tool has picked up an external URL or a
`fetch()` call — a theme page must not make the storefront reach the network on a
customer's behalf.

### What the gate does, and does not

It renders the tool only for a **logged-in customer tagged `staff`**. The check is
server side, so an ungated visitor is never sent the tool's markup: they receive
about 1 KB, and it contains none of it. Verified by rendering both branches.

What it cannot do: return an HTTP **404 status**. A page template always answers
200, so the blocked view *looks* like a dead end but does not tell a crawler it is
one. The template sends `noindex, nofollow, noarchive`, which is as far as a page
template goes. If a real 404 matters, the page has to move off the storefront.

The gate is a customer tag, not a staff permission. Shopify has no way for a theme
to see admin staff accounts, so anyone who needs the page needs a **customer**
account tagged `staff` — which is a separate thing from their admin login.

### Installing it

Theme writes to the live theme are blocked over the API, so this is a manual step:

1. **Online Store → Themes → ⋯ → Edit code** on the live theme.
2. Under **Templates**, *Add a new template* → type `page` → name it `scrim-proof`.
   Shopify creates `page.scrim-proof.liquid` (it may default to a JSON template —
   choose **liquid**).
3. Replace the whole file with this one and save.
4. **Content → Pages → Add page**. Title it *Scrim Proof*, set the theme template
   to `scrim-proof`, save. Leave it out of every navigation menu.
5. **Customers →** the person who needs access → add the tag `staff`. They sign in
   at `/account/login`, then open `/pages/scrim-proof`.

Test it signed out before you rely on it: the page should show the dead end.

### Weight

About 154 KB, loaded only on this page — the fonts and the theme profile are
inlined so the tool works with no requests of its own. It does not touch any other
template and adds nothing to the rest of the storefront.
