# USA Peptides — working plan

Updated as work lands. `[x]` done and verified, `[~]` done in code but not yet
verified against the live database, `[ ]` not started, `[!]` blocked on
something outside the code.

## SEO audit and first fixes — 2026-09-21

- [x] Audited 13 production URLs and saved public-response evidence in
      `docs/seo-audit-before.json`; keyword map, priorities and measurement plan
      are in `docs/SEO-AUDIT-AND-PLAN.md`.
- [x] Fixed seven pages inheriting the homepage canonical/title; added editable
      metadata, accurate sitemap dates, shared server product data for initial
      HTML/schema, stock-aware offer markup and contextual purchasing links.
- [x] Three fixture tests cover changed database details, zero stock, missing
      products and unavailable-database fallback.
- [x] TypeScript and production build pass. Local HTTP checks verify all seven
      metadata fixes, product schema/HTML, unknown-product HTTP 404 and sitemap
      dates. Before/after audit saved; purchasing links fit the 390px browser DOM.
- [x] Deployed as `61af3bd` and verified on the live www domain: all 13 sampled
      canonical paths and hosts match; metadata, product markup, missing-product
      HTTP 404 and sitemap regression checks pass.
- [!] Owner confirmed Search Console exists, but the available browser has no
      signed-in property session. Query/click/ranking analysis needs that session
      or a Performance export. No keyword volumes or ranking gains are claimed.

## Installable mobile app status — 2026-09-21

- [x] Researched and implemented browser installation; plan and official sources
      in `docs/PWA-PLAN.md`. No app-store submission or database migration.
- [x] Added manifest, branded Android/maskable/Apple icons, standalone launch,
      `/install` instructions and optional browser install button, footer link,
      header and mobile menu **Mobile app** link, sitemap entry, and mobile
      bottom safe-area spacing.
- [x] Production worker caches only the generic offline document. API calls,
      order submissions and private data are never added to its cache. Updates
      wait for old tabs to close rather than interrupting checkout.
- [x] TypeScript and production build pass (62 pages). Five worker tests pass.
      HTTP checks verify manifest, icon dimensions, worker headers and pages.
      Phone-width DOM checked at 390px; real browser offline fallback verified
      by stopping the local production server on isolated port 3107.
- [ ] Deploy, then test actual Android Chrome and iPhone Safari installation,
      standalone launch, sign-in/cart behavior and app updates on real phones.

## Entry notice logo — 2026-09-21

- [x] Replaced the warning icon in the research-use entry notice with the
      website logo on a forest background, above the existing notice heading.

## Migration status

- [x] Owner ran 0021; service-role table/RPC checks returned 200 and anonymous
      access returned 401 on 2026-09-19.

## No live payment methods — 2026-09-20

- [x] Owner: "we have no payment setup right now, all of them are fake."
      Checkout offered Card, Zelle, Bitcoin/USDT and Bank Wire and printed
      instructions for each — an address to Zelle money to, a promised crypto
      QR code, promised wire instructions. A customer could have sent money
      into a dead end. All four are gone, replaced by one "Online payment —
      coming soon" notice saying the team will email within one business day
      to arrange payment.
- [x] Orders are still recorded and still reach the dashboard, with
      `payment_provider` null. Nothing is charged and no card or bank details
      are collected anywhere on the site.
- [x] **The success page was inventing a random order number** with
      `Math.random()` instead of reading the real one from the redirect, so
      the number a customer wrote down matched nothing in the dashboard. It
      now shows the real number. Verified end to end: placed an order, screen
      showed `USP-MU9MO1IM-K1CE`, the database row matched, then deleted.
- [x] The FAQ claimed card, debit, Zelle, wire and crypto "with instant
      processing". Corrected.
- [x] Resend delivery confirmed by the owner: the test arrived in the Gmail
      inbox, not spam, showing "USA Peptide Depot (do not reply)". Owner has
      set `RESEND_FROM` in Vercel and redeployed.
- [!] Owner: the affiliate page still promises "Monthly payouts via Crypto or
      Bank Wire". Left alone because it is money going out and arranged by
      hand, but say if that is not real either.
- [ ] No payment processing is built. This is the blocker before the store
      can take money on its own.

## Contact address, sender and card payment — 2026-09-20

- [x] **The only mailbox the business reads is `info@usapeptides.com`.** It is
      now the single source for the contact address, the Zelle address and the
      Reply-To on every automated email. `BUSINESS` in `src/lib/env.ts` holds it;
      no page hardcodes an address any more.
- [x] **Mail must be sent from `usapeptidedepot.com`, not `usapeptides.com`.**
      Tested against Resend on 2026-09-20: `noreply@usapeptidedepot.com` is
      accepted (200), `info@usapeptides.com` is refused (403, "domain is not
      verified"). So the From address stays on the verified domain and
      Reply-To carries the real mailbox — a customer who replies still reaches
      a person.
- [x] `RESEND_FROM` changed to `noreply@usapeptidedepot.com` in `.env.local`,
      and the sender name is now "USA Peptide Depot (do not reply)".
- [x] Owner set `RESEND_FROM=noreply@usapeptidedepot.com` in Vercel and
      redeployed on 2026-09-20.
- [x] Moot: Zelle was removed from checkout entirely — see "No live payment
      methods" above. `PAYMENTS_EMAIL` stays available for when payment is set
      up.
- [x] Card payment now says "coming soon". The three card inputs are gone, so
      the site no longer collects card numbers it silently discarded. Checkout
      defaults to Zelle and the order button is disabled while Card is
      selected, explaining why.
- [ ] Card processing itself is still not built. Nothing on the site can
      charge a card.
- [x] Deployed and checked live on 2026-09-20 (commit 6be907a). Every page
      shows `info@usapeptides.com`; the only `usapeptidedepot.com` left is the
      site URL in canonical/OG/schema tags, which is correct. Live checkout
      serves zero `cc-*` inputs. `https://usapeptidedepot.com/my-account`
      returns 200, so the links in verification emails resolve.

## Signup failure found and fixed — 2026-09-20

- [x] **Root cause.** Both addresses the owner tried, `omerforce3@gmail.com`
      and `omerforce@gmail.com`, are rows in `admin_users`. `/api/customer/auth/register`
      short-circuited on any staff address and answered "a verification email
      has been sent" while sending nothing and creating nothing. Proven on
      production: the live endpoint returned HTTP 200 with that message and no
      Auth user was created. The rate-limit table shows both addresses were
      tried (hashes `29b8239…` and `0981cb5…`) on 2026-09-19 and 2026-09-20.
- [x] Register and recover now email the address itself explaining the outcome
      — "this address is a dashboard account", "you already have an account",
      "no account for this address" — so the on-screen reply is never a lie.
      The reply shown in the browser is still identical for every address, so
      the form still cannot be used to discover who has an account.
- [!] Owner: a staff dashboard login and a customer account cannot share an
      email address. To test the customer flow, sign up with a third address.
      `omerforce3@gmail.com` also has an unlinked `customer_profiles` row
      ("Omer Test 1") left from earlier testing — say the word and it goes.
- [ ] Inbox delivery is still unconfirmed. The Resend key is send-only, so
      delivery history cannot be read; no test mail has been sent from here.

## Form validation — 2026-09-20

- [x] New `src/lib/validate.ts` holds every field rule once, with no
      `server-only` import, so the browser and the route handler run the same
      checks. Nothing business-specific in it.
- [x] Checkout and the contact form now show the problem under the field that
      caused it instead of one line at the bottom.
- [x] The footer newsletter form used to throw away the address it collected.
      It now posts to `/api/newsletter`.
- [x] `/api/orders` stored the client's `shippingAddress` object verbatim; any
      caller could write arbitrary JSON into the column. Only our six fields
      are kept now, each capped. Also: full name and phone required, order
      lines capped at 50, quantity at 999, duplicate slugs rejected.
- [x] Order lookup and newsletter used `ilike` on a caller-supplied address. A
      `%` is legal in an email address but is a wildcard to `ilike`, so it
      could match another row. Both now compare exactly.
- [x] Tighter email rule: rejects `a@b`, `a@b..co`, trailing dots, over-long
      local parts. Phone, postal code and name rules added. Passwords reject
      the address itself and the obvious guesses on top of the 12-character
      minimum.
- [x] Reviews must name a real product; unknown slugs no longer fill the
      moderation queue.
- [x] 44 validation unit tests pass. `npx tsc --noEmit` clean. `npx next build`
      clean. All test rows deleted from the live database.
- [ ] Not yet deployed.

## Customer account follow-up — 2026-09-20

- [x] Work isolated on `codex/customer-account-flow`. Added independent
      confirm-password visibility, visible 12-character requirement, clearer
      sign-in/reset wording and network-failure feedback.
- [x] Supabase lookup found no Auth user for the reported test address. The
      screenshot password is below the minimum, which blocks signup before
      sending. Resend delivery-history reads are unavailable with the current
      sending-only key; delivery is not confirmed.
- [x] Signup retries no longer delete Auth users. Profile linking explicitly
      requires verified email, fails closed on staff lookup errors, and only
      claims profiles still unlinked at update time. Repeated completion does
      not overwrite a linked customer's details or marketing consent.
- [ ] Verify delivery and complete signup/reset end-to-end with a permitted
      test mailbox after branch review/deployment. No claim of inbox delivery
      or complete security certification is made by these code checks.
- [x] Live disposable-account checks: signup retry issues a fresh link for the
      same account; customer A can read its own profile but cannot read B's;
      direct profile UPDATE is denied. All test records removed. TypeScript
      passes.

- [ ] `supabase/migrations/0021_customer_account_security.sql` must be run
      before customer self-registration is deployed. It removes customers'
      broad profile-update permission and adds durable, hashed signup/recovery
      rate limits using keyed hashes for serverless deployments.
- [x] `supabase/migrations/0019_customer_ownership.sql` run and verified against
      Supabase on 2026-09-19. It adds Order
      completed, completion timestamps, durable customer ownership, legacy
      ownership backfill, and atomic reassignment of open work.
- [x] `supabase/migrations/0004_storefront.sql` run against the live project.
      Confirmed present: `site_settings`, `products.coa_url`,
      `products.sort_order`, `team_members.job_title`, and the `product-media`
      bucket at a 2 MB cap.
- [x] Full suite re-run after the migration: **38 passed, 0 failed.**

## Storefront on mobile — 2026-09-20

- [x] Form fields are 16px on phones so iPhone Safari no longer zooms the
      page when a field is tapped (checkout, contact, sign-in, calculator,
      newsletter). Checked on 20 pages at 375px.
- [x] Micro-labels (10px, 0.625rem, 0.6875rem, eyebrows, chips) floor at
      0.75rem on phones; they were 8.75-9.6px.
- [x] Bigger tap targets: header search, product quantity +/-, product tabs,
      wishlist hearts, cart drawer and cart page +/- and remove, footer links.
- [x] COA database shows cards on phones instead of a sideways-scrolling table.
- [x] Checkout and contact fields tell the phone what they are (autofill for
      name, email, phone, address, card; number keypad for card and CVC).
- [x] No storefront page is wider than the screen. Desktop unchanged.
- [!] Owner: several product photos show "Peptides Costa Rica" on the vial
      label. Replace them in Dashboard > Products.

## Dashboard on mobile — 2026-09-20

- [x] Phones and tablets get a slim top bar (menu button, section name,
      notification bell). The section list opens as a slide-out drawer instead
      of a sideways-scrolling strip that hid most sections. Checked at 375px
      and 390px wide.
- [x] Orders, Enquiries, Leads and the other generic lists, plus Customers,
      Commissions, Campaigns and Audit trail, show one card per record on
      phones instead of wide tables. Products always uses tiles on phones.
- [x] Fixed pages that spilled sideways: Categories (long names) and
      Analytics (report cards stretched to fit their tables). Every responsive
      grid in the dashboard now has a shrinkable single column on phones.
- [x] The Analytics toolbar is sticky on desktop only. The help text now
      says "tap or hover" for the ⓘ icons.
- [x] Desktop layout checked at 1280px and is unchanged. Type-check is clean.
- [ ] Not yet deployed. Check on a real phone after deploy.

## Orders workflow — 2026-09-19

- [~] Added the **Order completed** state. Commission is generated at
      completion, and completed orders cannot be claimed or have their
      historical agent silently changed.
- [~] Sales agents see their own orders/customers plus unassigned incomplete
      work, never another agent's customers. They can claim only unassigned,
      incomplete orders.
- [~] Returning customers keep the original agent who completed their first
      owned order. A super admin can make a confirmed owner correction from
      either the customer profile or the sales-agent profile; open work moves,
      historical commission records do not.
- [~] Replaced the separate order Edit action and instant-saving fields with
      one editable Details screen. The Save changes button activates only when
      the draft changes and opens a sensitive-change confirmation. Tracking
      number, payment reference, notes, status and (super admin only) agent are
      saved together.
- [~] Customer profiles now include order/product history, linked page and
      product-view history, CRM activity, and storefront sign-in status.
      Customer sign-in already uses browser credential autocomplete; a Remember
      me choice now controls whether the session survives closing the browser.
- [ ] Do role-based browser QA against the live
      database (super admin, two agents, unassigned customer, returning
      customer, completed commission and tracking-number save).

## Customer accounts and email — 2026-09-19

- [~] Resend HTTP API is integrated and a real delivery from
      `notifications@usapeptidedepot.com` was accepted after the root domain
      was verified. Vercel still needs a redeploy with the confirmed variables.
- [~] Customers can create their own account, verify their address through a
      one-use Resend link, sign in, and request a secure password-reset link.
      A verified address links to its existing customer profile and order
      history, or creates a new customer profile when the buyer has not ordered
      yet. Dashboard-user addresses remain refused. Tokens are kept in the URL
      fragment (out of request/referrer logs), responses do not reveal whether
      an address exists, and provider/database errors are not exposed.
- [~] Account security hardening is in code: migration `0021` removes the
      over-broad customer profile UPDATE policy and provides atomic rate limits
      keyed by HMAC-SHA-256 email/IP identifiers. Next.js is upgraded to the patched
      15.5.24 maintenance release and its nested PostCSS is overridden to
      8.5.28. Production audit has no high or critical advisories; the remaining
      moderate ExcelJS/uuid advisory concerns UUID variants this project does
      not call.
- [x] Public contact phone set to `831-471-5559` in the shared defaults and the
      live `site_content` record.
- [ ] Browser-test signup, verification, recovery and existing-order linking
      after deployment with a disposable customer address, then remove the
      disposable user/profile.

## Products and categories — 2026-09-19

- [x] The standalone Fulfilment dashboard tab was retained after the owner
      changed the request. Its operational data remains available there and
      inside order details.
- [~] Reworked Products into a clearer catalogue workspace with health cards,
      larger product cards, stronger hierarchy, category labels, search,
      filters and list/tile views.
- [~] Categories can manage their products directly. Migration
      `0020_product_category_assignments.sql` adds secondary category
      memberships while preserving each product's existing primary category.
      Assigning a product that already belongs elsewhere produces a specific
      warning; the admin can go back or explicitly choose **Add anyway**.
- [x] Migration `0020` run and its table/columns verified against Supabase on
      2026-09-19.
- [ ] Verify primary/secondary category membership
      on the Categories screen, category storefront pages, Shop filters and
      the COA database.

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

## 0006 (done, 2026-09-13)

- [x] Owner ran it. **Verified via REST:** `admin_users.base_salary/salary_period/
      salary_currency`, `orders.referral_code/affiliate_id/referred_by` and
      `affiliates.user_id` all present.
- [x] Leftover test row `zz.staff.…@usapeptides.test` deleted — the delete that
      used to fail on the audit trigger now succeeds, which confirms the fix.

## Users round 2 (2026-09-13)

- [x] **BUG: a team member with no permissions still opened the Dashboard home**,
      which shows revenue and the latest customers' emails. `home` was
      `always: true` in `permissions.ts`. Now it opens only for somebody holding
      at least one section, and `/api/admin/summary` returns only the figures for
      sections that person can open (`recentOrders` is null without Orders).
      **Verified against the live DB:** no permissions -> 403 and no home tab;
      Leads only -> just the open-leads figure, no revenue, no emails.
- [x] J4 done: **My profile** (click your name in the sidebar). Name, phone,
      photo, change password. `/api/admin/profile` writes only those three
      columns on the caller's own row and never takes an id;
      `/api/admin/profile/password` checks the current password first.
      Photo upload (`kind=avatar`, `avatars/` folder, no SVG) is open to every
      active user; other upload kinds still need a section permission.
      `src/lib/media.ts` adds the own-bucket URL check that CLAUDE.md said
      existed but did not.
      **Verified: 34 API checks passed**, including posted `is_superadmin`,
      `permissions`, email, job title, pay and commission all ignored, outside
      photo links refused, wrong current password refused, audit rows written
      with no password in them. Test users, rows and files deleted.
      Not checked: the modal while signed in in a browser.
- [x] Sidebar said "owner"; now "super admin".
- [ ] **Sales agent role** — owner decision 2026-09-13: a team member who sees
      only their own leads, customers and orders, gets a referral link, and earns
      a commission % set per person. `supabase/migrations/0007_sales_agents.sql`
      written (role, referral_code, leads/customers owner_id) — **not run yet,
      and no code uses it yet.** How peptidecosta does it (read from its source):
        1. First order arrives with no agent, unless it came through an agent's
           referral link/QR (the link always wins).
        2. Unclaimed orders sit in a shared queue; an agent clicks "Claim this
           order". The claim writes only while the order is still unclaimed, so
           two agents cannot both win (`claimOrder.js`).
        3. Every later order from that customer (matched on email/phone) is
           credited automatically to the agent who closed their first order
           (`customerHistoryAttributionServer.js`).
        4. Sub-users sit under a sales agent as their parent: the sub-user earns
           8% of their own orders, the parent earns a 2% override on those same
           orders (`subUserCommission.mjs`). Two levels only.
      So an agent must see unclaimed orders plus their own, not other agents'.
      **Owner confirmed. Built 2026-09-13, not committed yet:**
      - `0007_sales_agents.sql` rewritten (never run, so editing was allowed):
        `admin_users.role/referral_code`, `orders.agent_source/agent_claimed_at`,
        `leads.owner_id`. Customers have no owner column — derived from orders.
      - `src/lib/attribution.ts`: checkout credits link first, then customer
        history; else unclaimed. `src/lib/referralCodes.ts`: crypto codes,
        unique across agents and affiliates.
      - `/api/admin/claim`: agent claims only while unclaimed (conditional
        update, 409 to the loser, no colleague name leaked); super admin
        assigns/clears. Audit: order/lead claim/assign.
      - `[resource]` route: agents see own + unclaimed orders/leads, customers
        only from own orders; cannot edit unclaimed or others' rows, cannot
        change ownership columns, cannot delete. Agent permissions capped to
        orders/customers/leads/my_team (`SALES_AGENT_MODULES`).
      - Users: Team member / Sales agent choice (hidden until 0007), code
        generated on creation, or at first sign-in via `/api/admin/me` for
        anyone older (sub-users too). Sub-user link now uses the code — it
        used the account id, which credited nobody.
      - Dashboard: Agent column (Claim button / assign dropdown), agent's
        referral link and "waiting to be claimed" on home.
      - `ReferralCapture` remembers `?ref=` for 30 days.
      **BUG FOUND AND FIXED: checkout never saved an order.** It waited 1.5s and
      showed the success page. Now posts to `/api/orders`; card details are
      never sent (nothing can charge a card).
      **Verified before 0007 (15 checks):** checkout saves a pending unclaimed
      order; orders/leads/customers/home/users all still load; claim refused for
      staff, sub-users and no session; creating an agent names 0007. Test rows
      deleted. **Not yet tested: anything after 0007 is run** (claiming race,
      agent scoping, link and history attribution).
      Still open: 8%/2% sub-user earnings maths, agent earnings screen.
- [ ] Checkout shows shipping $9.95 but `/api/orders` charges $12 flat, so the
      saved total can differ from what the customer saw. Owner to say which.
- [ ] Checkout still shows card number boxes that go nowhere. Remove or keep
      until payments exist — owner decision.
- [~] Product photos: owner said (2026-09-13) use peptidecosta's vial photos
      even with the "PEPTIDES COSTA RICA" label. Three single-vial shots copied
      from its `public/` folder (files only, no data connection), resized to
      800px JPEG in `public/products/` (50–68 KB), rotated across the 20
      products. `src/data/products.ts` fallback already points at them.
      **Database still points at `/vials/*.svg`**: I switched it early, the live
      site 404'd the photos because the files were not deployed, so I reverted
      it (live confirmed 200 on the svgs). After the push is live, re-run the
      switch: only rows still on `/vials/` are changed.

## (history) run `supabase/migrations/0006_users_fixes.sql`

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

## Admin completion programme (started 2026-09-15)

- [x] Deep source inventory completed against `peptidecosta/` without reading
      its environment files or connecting to its data. Its major admin areas
      are orders/fulfilment, CRM, team selling, commissions, analytics,
      marketing, inboxes, website controls and operational notifications.
- [x] Commission foundation built: affiliate links now resolve at checkout;
      paid orders create affiliate commission; attributed salespeople receive
      direct commission; a sub-user's parent receives the configured override;
      duplicate/retried paid events cannot create duplicate earnings.
- [x] Real My earnings screen built for sales agents and sub-users with pending,
      approved and paid totals plus a private transaction list.
- [x] `0007_sales_agents.sql` and `0008_commissions.sql` confirmed against the
      live database on 2026-09-15: `sales_commissions`, agent identity fields
      and order attribution fields are all present and readable through REST.
- [ ] Verify claim races and end-to-end commission amounts with disposable test
      orders before considering the money workflow production-tested.
- [ ] Replace the generic Orders table with an operations screen: order detail,
      payment state, fulfilment actions, refunds, proof/receipt actions and
      customer timeline, with integrations gated when unconfigured.
- [ ] Replace generic CRM sections with customer/lead workspaces, notes,
      assignments, follow-ups, saved filters and export.
- [ ] Add analytics, inventory/low-stock controls, notification centre and
      global dashboard search.
- [~] Dashboard-managed research articles built: drafts, tag list, images,
      dates and public publishing. Public pages read only published articles
      and keep the bundled library as an offline fallback. Requires migration
      `0009_articles.sql` before it can be used live.
- [ ] Complete structured product fields, including bulk tiers and COA data.
- [ ] Build campaigns, broadcasts and abandoned-cart recovery around optional
      email/Chatwoot/Meta providers; drafting and audience selection must work
      when sending providers are absent.
- [ ] Add affiliate self-service login/portal. Internal seller earnings are now
      available, but outside affiliates still have no login by design.
- [~] Admin operations completion pass (2026-09-17): production build passes;
      added 90-day analytics, unified seller/affiliate commission approval and
      settlement, system-health diagnostics, automatic inventory reservation
      and restoration, automatic fulfilment creation/stage timestamps, and
      new-order notifications. Migration `0010_order_operations.sql` must be
      applied before the lifecycle automation is live. Manual QA checklist is
      in `docs/ADMIN-MANUAL-QA.md`.
- [~] Admin QA feedback pass (2026-09-17): added a public Admin login link
      without weakening server authorization; password visibility controls;
      scrollable sidebar and dialogs; branded profile-save confirmation;
      dedicated full order-detail dialog; explicit product Save/Refresh; and
      editable product categories with storefront linkage. Production build and
      TypeScript pass. Category management requires
      `0011_product_categories.sql`; live/manual QA remains with the owner.
- [~] Notifications rebuilt as an operational inbox matching the useful
      PeptideCosta behaviour: automatic order/enquiry/review/low-stock alerts,
      unread bell count, one-minute refresh, mark-one/mark-all read, and
      click-through to the related dashboard section. Read state is private per
      administrator after `0012_notification_center.sql`; external email and
      WhatsApp delivery remain gated by their providers. TypeScript passes;
      database and browser QA remain.
- [~] Fixed the checkout CRM gap: `0013_order_contact_sync.sql` links every new
      order to a customer profile and creates or converts the matching lead,
      preserving agent ownership. It also backfills existing orders, so orders
      placed before the fix appear in Customers and Leads after migration.
- [~] Deals rebuilt as a scheduled promotion engine: product multi-select,
      minimum/maximum eligible unit counts, percentage or fixed-value discount,
      automatic server-side checkout calculation, and optional storefront
      banner copy that expires with the deal. Requires
      `0014_deal_engine.sql`; browser/database QA remains.

## Blocked — needs an account he has not opened
- [x] Resend API support is wired for campaign and account-email delivery, with
      SMTP retained as a fallback. The owner added the variables locally and in
      Vercel, verified the sending domain, and a real send was accepted.
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

## USA Peptide Depot frontend rebrand (2026-09-13)

- [x] Brand name changed across storefront copy, metadata, fallback content and
      shared `BUSINESS` identity. Existing domain and support email remain until
      replacements are supplied.
- [x] UPD SVG logo used in the storefront header and footer.
- [x] Forest `#1F4233`, cream `#FDFBF0` and navy `#233049` applied through the
      shared theme tokens. Conversion-tested action orange and WhatsApp green
      remain separate and unchanged.
- [x] Verified on branch `testing`: TypeScript clean; `/`, `/shop`, `/about-us`,
      `/contact-us` and `/admin/login` return 200; desktop and 390px layouts
      inspected.
- [x] Cera Pro webfonts are included for production after the owner confirmed
      the supplied files are licensed for web deployment. Archivo and Manrope
      remain as fallbacks.

## Brand-kit colour balance (2026-09-17)

- [x] Owner: "the whole website is green, not the three colours". Owner picked
      the cream layout. Pages are now cream with forest headings and buttons and
      navy highlights; header, hero and mobile nav forest; footer and
      announcement bar navy. Dashboard follows the same cream theme.
- [x] `brand.*` tokens turned into CSS variables with `.theme-forest` and
      `.theme-navy` bands; hard-coded `text-white` / `text-gray-*` / cyan /
      emerald classes replaced with theme tokens. Action orange and WhatsApp
      green unchanged.
- [x] Verified locally: TypeScript clean; home, product, shop (375px), cart,
      compliance popup and dashboard login inspected, no console errors.
- [x] Signed-in dashboard inspected (overview, Products, Storefront, Users,
      Fulfillment): all on the cream theme. Storefront preview bar now navy
      like the real bar. `next build` clean.
- [x] Fixed an older bug found while checking: Dashboard > Products never
      loaded (it was wrongly listed as a self-loading screen, so no data and
      no save/delete). Now shows all 20 products.
- [ ] Pushed on branch `testing`; not merged to `main`, so not on the live site.

## Order on WhatsApp + banner removal (2026-09-17)

- [x] "Order on WhatsApp" button on product pages, the cart drawer and the cart
      page (greyed out until the research-use box is ticked). Opens WhatsApp
      with the items and total typed out. Number set in Dashboard > Storefront
      (`site_settings` row `whatsapp`, no migration); hidden until a number is
      saved and switched on. API `/api/admin/whatsapp`, storefront permission.
- [x] Verified: API refuses no login (401), bad numbers and "on with no
      number" (400); buttons render and build the right wa.me link (tested
      with a temporary local-only number, reverted). Build clean.
- [ ] Dashboard WhatsApp card not inspected in the browser (could not mint a
      browser session this time).
- [!] Owner to enter the real WhatsApp number in Dashboard > Storefront.
- [x] Owner asked to remove the banners: thin utility strip deleted from the
      header; scrolling announcement cleared in the database (was "Free
      shipping on every US order over $100 — HPLC test report published with
      every vial", linking to /shop). The announcement feature itself remains.

## Mobile usability pass (2026-09-17)

- [x] Pulled `testing` (already current) and tightened phone layouts: compact
      header that no longer overflows at 320–390px, scrollable mobile menu,
      safe-area-aware 44px bottom navigation targets, collapsible shop filters,
      two-column phone catalogue, larger form controls, calculator presets that
      wrap cleanly, and stacked product controls on narrow screens.
- [x] TypeScript clean. Browser-verified home, shop and a product page at
      375x812: no horizontal overflow; header and bottom navigation fit; shop
      shows a usable two-column grid; narrow product assurances stack cleanly.

## Owner feedback round (2026-09-17, evening)

- [x] 0015, 0016 and 0017 run by the owner (2026-09-17). **Verified via REST:** all new
      columns and tables present, `campaign_track` callable by the server only,
      recipients hidden from the public key. Prospector (11) and blog/content (17)
      checks re-run against them and pass; test rows deleted.

- [x] **Products: import / export.** Export the whole catalogue as Excel, CSV or
      a PDF price list; import CSV or Excel (old .xls is refused with a "save as
      .xlsx" message; a PDF cannot be imported reliably and says so). Two-step
      import: every row is checked on the server and shown as Add / Update /
      Skip / Problem before anything is written. Matches by SKU then web
      address; blank cells leave values alone; English and Spanish headings;
      new categories created; photo links from other sites are not copied.
      Blank template download. `/api/admin/products/import`.
      **Verified: 17 API checks.** Test rows deleted.
- [x] **Products: list / tiles view** in the dashboard (sortable list is the
      default, choice remembered) and **grid / list view on the shop and
      category pages**. QR code per product.
- [x] Fixed: category page called a React hook after an early return; category
      counts queried a column that does not exist (`is_live`) on every page.
- [x] **Customers**: own screen with WhatsApp / email / call on every row,
      one-click delete (removes their shop sign-in too; past orders kept),
      orders / spend / last order, export. Sales agents: no delete, no
      sign-ins. **Verified: 15 checks.**
- [x] **Client accounts**: "Sign-in" on a customer sets a password for the
      shop's My account page (Users > Customers is the same screen). My account
      was fake (any password "worked"); it is now a real sign-in showing only
      the customer's own orders (row-level security). A customer sign-in is
      refused by the dashboard; a dashboard user's email cannot be given one.
- [x] **Users > QR codes**: printable codes for every referral link plus any
      page of the site; PNG / SVG / print.
- [x] **Notifications**: separate tab removed; the bell opens a drop-down.
- [x] **Navbar** labels no longer wrap onto two lines (checked 1024 / 1280px).
- [x] **Storefront controls the website**: Website text & SEO, Blog,
      Announcement & WhatsApp. Editable: contact details, social links, home
      banner, page headings, full FAQ, footer, site-wide and per-page SEO,
      share image, Google/Bing verification, AI-answer facts. Stored in
      `site_settings.site_content` (no migration). The root layout now renders
      on the server, so titles, descriptions and structured data are in the
      HTML (Organization, FAQPage, BlogPosting, Product). Generated
      `sitemap.xml` and `robots.txt` (dashboard hidden from search).
      **Verified: 18 checks**, incl. unsafe links refused and a saved line
      appearing on the page immediately, then reset.
- [x] **Blog** inside Storefront: formatting toolbar, preview, picture library
      (upload, reuse, download), per-post SEO and Q&A (needs 0015), publish
      date scheduling. Posts render on the server.
- [x] Contact form now saves to Enquiries (it only pretended to).
- [x] **Prospector** (renamed): OpenStreetMap search (free, no Google fees),
      own map with pins, "search this area", fit score weighted to research
      buyers, pipeline with stages, owner, follow-up, notes timeline,
      WhatsApp / email / call templates, copy to Leads, import / export.
      **Verified:** live Boston search, 100 businesses in 11s; 11 pipeline
      checks. Test rows deleted.
- [x] **Campaigns** (Mailchimp-style): templates, block builder with live
      desktop / mobile preview, audiences (subscribers, opted-in customers, all
      customers, leads, everyone + engagement filters), test send, send now or
      schedule, batched sending, signed open / click tracking, one-click
      unsubscribe, do-not-email list, report with links and recipients. Own
      editor instead of Unlayer (no extra account).
      **Verified:** audience counts; forged click / unsubscribe links refused;
      hostile HTML escaped. **Not verified: a real send** (no SMTP account).
- [ ] **Owner to set in Vercel for sending:** `RESEND_API_KEY`, `RESEND_FROM`;
      `EMAIL_LINK_SECRET` (any long random string); `CRON_SECRET` for the daily
      scheduled-campaign check in `vercel.json`. All as Secret. Then redeploy.
- [ ] The owner said a picture of the products screen would follow; it did not
      arrive.
- [ ] Not checked while signed in to the real dashboard (a test session could
      not be put in the browser). Screens were checked with sample data on a
      temporary local page, since deleted; APIs against the live database.
- [x] Next.js upgraded from 14 to patched maintenance release 15.5.24. PostCSS
      is pinned/overridden to 8.5.28. Production audit: 0 critical, 0 high, 2
      moderate entries for one transitive ExcelJS/uuid advisory; the vulnerable
      UUID v3/v5/v6 buffer API is not used by the project or ExcelJS's workbook
      writer path.

- [x] Pushed as `2d52def` to `testing` and `main` (fast-forward). **Verified live** on
      usapeptides-six.vercel.app: new robots.txt, sitemap, page titles; new admin API
      answers 401 without a login.

## Dashboard vs Analytics rebuild (2026-09-17, night)

- [x] Dashboard home = daily to-do list: period picker (today, yesterday, 7/30/90
      days, this/last month, 12 months, all, custom), "Needs your attention"
      list, headline numbers with an (i) explanation and change vs the period
      before, sales and visitor charts. "Latest orders" table removed.
- [x] Analytics = the report: same picker, sections (overview, sales, visitors &
      sources, funnel, products, marketing, live now), export to Excel/CSV/PDF.
      All definitions in `src/lib/kpis.ts`; engine `src/lib/analyticsEngine.ts`.
- [x] Visitor tracking built (was none): `/api/track` + `VisitorTracker`. Visits,
      source (search/social/email/AI/direct, UTM), device, browser, country /
      region / city from Vercel headers (no IP stored), page and product views,
      add to cart, checkout, purchase, live visitors.
- [x] Fixed: carts were never saved, so Abandoned carts was always empty. The
      tracker now saves them (keyed by visitor) and marks them recovered on
      purchase; checkout email remembered for follow-up.
- [x] `0018_visitor_analytics.sql` run by the owner and its visitor-session
      schema verified through Supabase on 2026-09-19.
- [x] Verified: both APIs return for every range (2–4s from here; Vercel is
      nearer the database). Screens checked with sample data, page deleted.
      Build clean. Real tracking rows begin accumulating after deployment.

## Order editor fix (2026-09-17)

- [x] Fixed the blank Edit order modal. System-created records now have
      separate edit-form definitions from their intentionally empty create
      forms. Orders expose status, tracking number, payment reference and
      internal notes without enabling manual creation through the generic API.

## Analytics feedback pass (2026-09-19)

- [x] Rebuilt Analytics exports as actual reports instead of one flattened
      four-column table. Excel now has separate Overview, Sales, Traffic,
      Clicks and taps, Products and Marketing sheets plus embedded charts; PDF
      has branded section pages, charts and readable tables; CSV uses explicit
      section and metric/value columns.
- [x] Added privacy-safe click/tap tracking for storefront links and buttons.
      Analytics now shows the most-used controls, pages with the most
      interaction, mouse/touch/keyboard split, and a nine-zone page map. No
      form values, screenshots or IP addresses are recorded. Interaction data
      starts after deployment; migration 0018 is now present.
- [x] Made charts more obvious in Analytics: existing revenue/visitor/order
      time-series and bar/funnel charts remain, and device mix now has a clear
      donut chart. Exported PDF and Excel reports include chart images.
- [x] TypeScript and the production build pass. Static generation logged the
      expected blocked-network fetch warnings in this sandbox, then completed
      all 60 pages successfully. Browser QA of authenticated Analytics and the
      downloaded files remains to be done after deployment with real data.
