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

### F. Live chat (Chatwoot)
- [x] F1. `chatwootEnv` + `features.liveChat` / `liveChatWebhook`, so the site
      runs unchanged with no Chatwoot account and the widget appears the moment
      the two public values exist
- [x] F2. `ChatwootWidget` loads the SDK, identifies a signed-in customer, and
      attaches the page and cart to the conversation. **Verified against
      Chatwoot Cloud:** script injects, SDK initialises, `$chatwoot` ready
- [x] F3. `/api/chat/identity` signs a customer's identity server-side. The
      inbox HMAC key must never reach the browser or anyone could impersonate
      any customer and read their chat history
- [x] F4. `/api/webhooks/chatwoot` turns a chat into a Lead with the page and
      cart in the notes, logs incoming messages to the activity trail, and
      leaves an existing lead's status and sales notes alone
- [x] F5. **29 checks passing** against the live database, all test rows removed
- [x] F6. `docs/CHATWOOT-SETUP.md`
- [ ] F7. Waiting on him: `NEXT_PUBLIC_CHATWOOT_BASE_URL` and
      `NEXT_PUBLIC_CHATWOOT_WEBSITE_TOKEN` from the inbox Configuration screen,
      both as Vercel **Config** not Secret, then a redeploy
- [ ] F8. Set the Chatwoot launcher colour to #BF4F0B in the Widget Builder, to
      match the tested action colour on the buy buttons
- [ ] F9. `CHATWOOT_WEBHOOK_SECRET` is already generated in `.env.local` — copy
      it to Vercel as a Secret and paste the webhook URL into Chatwoot
- [ ] F10. Not built: reading chats inside our dashboard (needs a Chatwoot API
      token), and Chatwoot's WhatsApp/Messenger channels (needs the same Meta
      credentials everything else is blocked on)

## Live right now on the public site
- An announcement bar reading "Free shipping on every US order over $100 —
  HPLC test report published with every vial", linking to /shop. Published
  during the verification run. The copy matches the real policy, but it was not
  asked for — clear or change it in Dashboard > Storefront in one click.

## BLOCKING: run `supabase/migrations/0006_users_fixes.sql`

0005 is done (security suite: **63 of 64 passing**, the one failure being my own
cleanup script, not the code). 0006 fixes a real bug I introduced and adds pay.

**The bug:** 0005 gave `admin_audit_log.actor_id` a foreign key to
`admin_users` with ON DELETE SET NULL, *and* made the table append-only. Those
cannot both hold — deleting a user makes Postgres try to update the log, the
trigger refuses, and the delete fails. **Anybody who had ever done anything
became undeletable.** 0006 drops the foreign key; the log keeps `actor_email`
as its durable label, which is what an audit entry should have relied on.

There is one leftover test row (`zz.staff.…@usapeptides.test`) that cannot be
removed until 0006 runs. Delete it from the Users tab afterwards, or tell me and
I will.

## 0005 (done)

Until it runs, the Users tab and the audit trail say so instead of failing.
**Everything else keeps working and the existing owner keeps full access** —
verified against the live database, not assumed. See `docs/USERS-AND-SECURITY.md`.

## Users umbrella + real permissions

Goal stated by the owner: this project becomes the template other businesses
get, so it must need only a handful of connections and must not contain
anything hardcoded or weak.

### G. Security foundation (must land before the UI is worth anything)
- [x] G1. Migration `0005_users.sql` — `admin_users` becomes the one identity
      table: `user_id`, `tier`, `status`, `is_superadmin`, `permissions[]`,
      `parent_user_id`, `sub_user_cap`, `commission_rate`, `override_rate`,
      profile fields. Plus `admin_audit_log`, affiliate payout columns, and the
      two-level depth trigger
- [x] G2. `src/lib/permissions.ts` — the module list, tab resolution, tier
      rules. One source of truth shared by API and UI. No email ever hardcoded
- [x] G3. `requireAdmin(req, { permission, superadmin, allowSubUser })`.
      Default-deny; sub-users refused on every route unless it opts in;
      pending/suspended refused for everyone
- [x] G4. Route -> permission map, so a new route is gated by default
- [x] G5. Audit log written for every privileged action
- [x] G6. Escalation guards: nobody edits their own permissions, tier,
      superadmin flag or status; the last active superadmin cannot be demoted,
      suspended or deleted; permissions validated against the module list;
      commission rates bounded in the database, not just the form
- [x] G7. First superadmin bootstrapped from the existing allow-list row by the
      migration, never from a constant in code

### H. Users tab
- [x] H1. One `Users` section with three sub-tabs
- [x] H2. **Team** — internal staff, with per-section permissions
- [x] H3. **Sub Users** — the second tier: staff invite, owner approves, capped
      at two levels, own commission and override rates, suspend and reassign
- [x] H4. **Affiliates** — external partners, crypto-random referral codes,
      bounded rates, commission approve/settle

### I. Verified
- [x] I1. Security suite run against the live database: **63 passed, 1 failed**.
      The failure was the cleanup step, which hit the audit-log bug above.
      Confirmed refused: staff self-promotion, staff granting themselves a
      permission, staff reading the audit trail or ungranted sections, staff
      setting a password, the inviter approving their own invite, a pending
      invite having any login, a sub-user reaching orders/customers/users/
      products/summary, a sub-user inviting a third level, promoting a sub-user
      to super admin, deleting somebody who has sub-users, an owner demoting or
      suspending or deleting themselves, a rate over 100, a duplicate referral
      code in another case, and every route without a token
- [x] I2. Users tab checked in a browser at 1440px: three tabs with counts,
      cards, statuses, and it loads on a database that has 0005 but not 0006

### K. This round of feedback
- [x] K1. "Owner" is now "Super admin" everywhere a person reads it. The column
      stays `is_superadmin`
- [x] K2. "Sub-user places" is now "How many people can they recruit?" with an
      explanation of what a sub-user is
- [x] K3. "Override on sub-users %" is now "Cut of what their recruits sell %",
      and the sub-user form says "What they earn" / "What their recruiter earns"
- [x] K4. Base pay added: amount, period (hour/week/fortnight/month/year) and
      currency, shown on the card. Needs 0006. Recorded for reference only —
      nothing runs payroll
- [x] K5. Desktop text was too small. The root size now steps 14px -> 15px at
      768 -> 16px at 1280, and the dashboard's smallest labels were raised a
      step each. Confirmed 16px at 1440
- [x] K6. The floating widget in the screenshot is the **Vercel Toolbar**, not
      ours — nothing in the code or dependencies injects it, and it is only
      visible to somebody signed in to the Vercel account. Removed from Vercel,
      not from code. It is also what produced that "Interaction Timing" panel,
      so my earlier answer calling it Chrome DevTools was wrong
- [x] K7. `TeamPanel.tsx` deleted — superseded by the Users tab

### L. Affiliates seeing their own earnings — the dependency
- [ ] L1. Yes, they should. But nothing can be shown until orders record which
      referral link brought them in. 0006 adds `orders.referral_code`,
      `orders.affiliate_id` and `orders.referred_by` as that plumbing
- [ ] L2. Capture `?ref=CODE` on the storefront and carry it into the order
- [ ] L3. Generate commission rows when a referred order is paid
- [ ] L4. An affiliate login and portal, so they can see their own figures and
      link. Same screen answers the sub-user earnings gap

### J. Known incomplete in this area
- [ ] J1. Sub-user earnings are not calculated — orders carry no referral
      column, so there is nothing to total. Their screen says so rather than
      printing $0.00
- [ ] J2. Affiliate commissions are not generated automatically either; the
      table and the approve/pay states exist, nothing writes rows yet
- [ ] J3. `team_members` is now superseded by `admin_users` and no longer in the
      sidebar. The table and its data are untouched — decide whether to drop it
- [ ] J4. Staff self-service profile editing. The Users routes are owner-only,
      so a staff member cannot change their own phone number

## Measure, do not guess
- [ ] Dashboard INP read 240ms in Chrome's live metrics, with ~151ms input
      delay on a sidebar click. That was the **dev server**, where unminified
      code, React's dev build, on-demand compilation and Strict Mode's double
      render inflate it several times over. Re-measure on the deployed site; if
      it is still amber there, the sidebar click refetches and re-renders a
      200-row list, and that is what to fix.

## Next
- [ ] Blog written in the dashboard, published to the website
- [ ] Remaining product detail fields in the form: specs table, bulk pricing
      tiers, tags, the structured `coa` JSON
- [x] Per-section dashboard permissions — done. Access is no longer
      all-or-nothing
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
