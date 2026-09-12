# USA Peptides — working plan

Updated as work lands. `[x]` done and verified, `[~]` done in code but not yet
verified against the live database, `[ ]` not started, `[!]` blocked on
something outside the code.

## Migration status

- [x] `supabase/migrations/0004_storefront.sql` run against the live project.
      Confirmed present: `site_settings`, `products.coa_url`,
      `products.sort_order`, `team_members.job_title`, and the `product-media`
      bucket at a 2 MB cap.
- [x] Full suite re-run after the migration: **38 passed, 0 failed.**

## Today's scope: products + team + storefront linkage

### A. Front-end reads from the dashboard
- [x] A1. Migration `0004_storefront.sql` written — `site_settings`,
      `products.coa_url/coa_lot/coa_tested_at/sort_order`, six team columns,
      storage bucket
- [x] A2. `src/lib/catalogue.ts` — single mapper from DB row -> storefront `Product`
- [x] A3. `useCatalogue()` — one fetch per page load, shared; bundled catalogue
      as fallback so a network blip never empties the shop
- [x] A4. Shop, category, product detail, home, search and COA database all read
      it. **Verified: shop renders 20 products out of the database.**
- [x] A5. Announcement strip above the header, read with the anon key.
      **Verified in the browser:** published from the dashboard, appears at the top
      of the public shop, scrolling, at 11.4px so it is actually readable
- [x] A6. Dashboard > Storefront writes it, with a live preview

### B. Products tab
- [x] B1. Category dropdown, ten fixed options, slug derived automatically
- [x] B2. Image upload. **Verified against live storage:** public URL returned,
      publicly readable, 2 MB cap refuses a 3 MB file and names its real size,
      401 without a token
- [x] B3. COA PDF upload. **Verified:** a PNG sent as a certificate is refused.
      Download button wired on the product page and in the COA modal — replaces
      the `alert()` that pretended to download a file
- [x] B4. Full new-product form, grouped Basics / Price and stock / Media /
      Details / Visibility. Slug, category slug, in-stock and live all derived.
      **Verified in the browser:** all five sections render, two file pickers,
      category dropdown with its ten options
- [x] B5. Category-wise grouping plus a category filter, and a count of how many
      products are missing a photo or a certificate

### C. Team tab
- [x] C1. Wider `team_members` record: phone, job title, avatar, notes, start date
- [x] C2. Cards with photo, title, contact and two status chips
- [x] C3. **Grant access** creates the Supabase Auth account and the
      `admin_users` row together. **Verified:** short passwords refused, you
      cannot revoke your own access, and the tab correctly reports 1 address
      with access plus an allow-list entry that has no team record

### D. Handover
- [x] D1. `docs/SUPABASE-SETUP.md` — the one SQL paste, where the admin login is,
      and how to create users
- [x] D2. `docs/CLIENT-MESSAGE.md` — short message to send with the link, plus
      the full list of what he still owes us

### E. Conversion colours (asked for mid-session)
- [x] E1. `action` #BF4F0B and `whatsapp` #25D366 added as tokens, kept separate
      from the brand red so a test is one edit
- [x] E2. Add to cart, cart checkout, drawer checkout, place order and the
      certificate download all use the orange. **Verified in the DOM:**
      `rgb(191, 79, 11)` with white text on all 20 shop buttons
- [ ] E3. Nowhere on this site opens a WhatsApp chat yet, so the green is only
      on the "Added" confirmation. It is ready for real WhatsApp buttons when
      that integration lands.

## Live right now on the public site
- An announcement bar reading "Free shipping on every US order over $100 —
  HPLC test report published with every vial", linking to /shop. Published
  during the verification run. The copy matches the real policy, but it was not
  asked for — clear or change it in Dashboard > Storefront in one click.

## Next
- [ ] Blog written in the dashboard, published to the website
- [ ] Remaining product detail fields in the form: specs table, bulk pricing
      tiers, tags, the structured `coa` JSON
- [ ] Per-section dashboard permissions — right now access is all-or-nothing
- [ ] Real product photography to replace the generated placeholder SVGs

## Blocked — needs an account he has not opened
- [!] Email (SMTP): no order confirmations, no enquiry notifications, campaigns
      can be drafted but not sent
- [!] Payments: checkout collects the order but cannot take money. This is the
      real blocker to selling
- [!] Meta / WhatsApp / Messenger campaigns

## Open decisions he never answered
- [ ] Delete the `peptidecosta/` copy inside this repo. It is gitignored and a
      full copy already exists at `H:/Joe Webster/peptidecosta`. It contains 37
      live production credentials, so it should not sit here indefinitely.
- [ ] Commit `8e3649d` has a stray `@` in its subject line. Fixing it rewrites
      history and needs a force-push.

## Known gaps worth naming
- Policy pages are drafts, **not legal advice** — regulated product class
- The bundled `src/data/products.ts` is now only a fallback. It will drift from
  the database over time; that is fine, but it is not the catalogue any more.
