# USA Peptide Depot admin portal — manual QA

Run this after deploying the current code and applying migrations `0009`,
`0010`, `0011`, and `0012`. Use test records prefixed with `zz.` so they are easy to find and
remove. Do not use real card information; no payment processor is connected.

## 1. System and access

1. Confirm **Admin login** appears in the desktop header and mobile menu. Open
   it and confirm it leads to `/admin/login` without signing anybody in.
2. Enter a password and test the eye button repeatedly. It must only change
   visibility; it must not clear or alter the password.
3. Sign in as a super admin.
4. Confirm the desktop dashboard sidebar has its own scrollbar and every item
   remains reachable at short window heights.
5. Open **Setup status**. Every database row must say `PASS`.
6. Confirm the page clearly says it checks schema/configuration and does not
   claim to show Vercel runtime or deployment logs.
7. Confirm unconfigured email, PayPal, card checkout or chat services say
   `OFF`, not an application error.
8. Open **My profile**, change the name or phone and save. A small branded
   tick notification must say **Saved** and disappear automatically. Reload and
   confirm the change persisted.
9. Test all three password eye buttons in My profile and the password field in
   user approval/reset dialogs.
10. Resize the window so the profile dialog is taller than the screen. The
    scrollbar must belong to the dialog and its Save button must be reachable.
11. Sign out and confirm `/admin` redirects to `/admin/login`.

## 2. Products and inventory

1. Open **Categories** and create `zz. QA Category`. Confirm the web address is
   generated when omitted, then edit its name, description and sort position.
2. Confirm the new category appears in the product editor and public category
   navigation. Hide it and confirm it disappears publicly.
3. Open **Products** and create `zz. QA Peptide` with a unique slug, price,
   stock `10`, category, image and COA PDF.
4. Confirm it appears in its public category and product page when **Live** is
   enabled, and disappears when disabled.
5. Change stock to `4` and click the visible **Save** button. Click **Refresh**
   and confirm the value remains `4`; then confirm Dashboard and Analytics count
   it as low stock.
6. Open Edit, change a product field, and confirm the modal has its own attached
   scrollbar plus a reachable **Save changes** button.
7. Try uploading a non-PDF as a COA and a file over 2 MB. Both must be refused.
8. Try deleting `zz. QA Category` while the product uses it. It must be refused.
   Move the product, then confirm the empty category can be deleted.

## 3. Orders, stock and fulfilment

1. In **Orders**, create a manual order for `zz.customer@example.com` with two
   units of the QA product, status `pending`.
2. Click **Detail**. It must open a separate scrollable popup, not expand the
   orders table. Verify customer, address, line quantities, prices, discounts,
   payment, attribution, notes, fulfilment, activity, shipping and totals.
3. Return to **Products**. Stock must have fallen from `4` to `2`.
4. Change the order to `paid`. Confirm one pending commission is generated if
   an agent owns it, and a row appears in **Fulfilment** at `queued`.
5. Move fulfilment through `picking`, `packed`, then `dispatched`. Reload after
   each change; the stage must persist.
6. Change the order to `cancelled`. Stock must return to `4` exactly once.
   Saving `cancelled` again must not add stock again.
7. Reopen it as `processing`. Stock must return to `2`. If stock is lower than
   the required quantity, reopening must be refused.
8. Confirm **Notifications** contains the new-order alert.

## 4. Sales agents and ownership

1. In **Users**, add `zz.agent@example.com` as a sales agent with Orders,
   Customers, Leads and Recruit sellers access. Set a direct commission rate.
2. Copy their referral link. In a private browser window, visit that link and
   submit a test order.
3. Sign in as the agent. They must see their order and customer, but not other
   agents' owned records, Users, Audit, Products or business-wide analytics.
4. Create an unclaimed order, then click **Claim** as the agent. A second agent
   attempting the same claim must lose cleanly and must not see the winner's
   identity.
5. Place another order with the same customer email but no referral link. It
   must stay attributed to the first agent through customer history.

## 5. Sub-users and commission override

1. As the sales agent, invite `zz.subuser@example.com` from **Recruit sellers**.
2. Confirm the invite cannot sign in before super-admin approval.
3. Approve it as super admin and set the direct and parent override rates.
4. Place an order through the sub-user's referral link and mark it `paid`.
5. In **Commissions**, verify one direct row for the sub-user and one override
   row for the parent. Check both amounts against the configured percentages.
6. Approve the rows, mark them paid with a payment reference, and reload.
7. Sign in as the sub-user. **My earnings** must show only their own totals and
   rows, never their parent or another seller.

## 6. Affiliates

1. In **Users → Affiliates**, add `zz.affiliate@example.com`, copy the generated
   link, and place a test order through it.
2. Mark the order paid. **Commissions** must show the affiliate amount.
3. Approve and pay it. The affiliate card's owed and paid totals must update.
4. Regenerate the code and confirm the old link no longer attributes orders.
5. Confirm an affiliate with paid commission cannot be deleted; switching them
   off must preserve the payment history.

## 7. CRM and customer operations

1. Add a lead with a `zz.` email, notes, source and score.
2. Move it through `new`, `working`, `qualified`, then `converted` and reload.
3. Assign/claim it as a sales agent and verify other agents cannot edit it.
4. Add a prospect, set the next action and date, then move the pipeline stage.
5. Add Activity log notes against the lead/customer/order and confirm they
   remain after reload.
6. Submit the public contact form and confirm it appears in **Enquiries**.

## 8. Storefront and content

1. Change the announcement in **Storefront**, publish it, and confirm it on the
   public site. Disable it and confirm it disappears.
2. Open **Research articles**, create a `zz.` draft, and confirm it is not public.
3. Publish it with today's date. Confirm it appears at `/blog` and its detail
   page opens. Unpublish it and confirm it disappears after reload.
4. Check duplicate article slugs are refused.

## 9. Marketing, reviews and carts

1. Create a campaign draft and edit it. If email/Meta is not connected, no send
   action should pretend that delivery occurred.
2. Add a test review, confirm it stays hidden until approved, approve it, then
   verify the public product page.
3. Start a public cart with a test email and leave checkout. Confirm the cart
   appears in **Abandoned carts**; mark it recovered and reload.
4. Add/unsubscribe a `zz.` newsletter address and confirm the state persists.

## 10. Notifications

1. Confirm the header bell shows the same unread count as the **Notifications**
   tab and that both refresh without reloading the dashboard.
2. Create a manual order. Confirm an automatic order alert appears after
   refresh; click it and confirm it opens **Orders**.
3. Submit the public contact form and add an unapproved test review. Confirm
   enquiry and review alerts appear and open their correct sections.
4. Move a product's stock from 5 or more to below 5. Confirm one low-stock alert
   appears. Further changes while it remains below 5 must not create duplicates.
5. Mark one alert read, then mark all read. Reload and confirm the state remains
   correct for this administrator. Sign in as another permitted administrator
   and confirm their read state is independent.
6. Confirm the tab does not claim that in-app alerts were delivered through
   email, WhatsApp, or Vercel logs.

## 11. Security and audit

1. Create a staff account with only Products permission. It must see Dashboard
   and Products only; direct API/navigation attempts to Users and Audit must be
   refused.
2. Remove every permission. That account must no longer reach Dashboard.
3. Confirm nobody can change their own role, status, permissions or supervisor.
4. Confirm the last active super admin cannot be suspended, demoted or deleted.
5. Open **Audit trail** and verify user, affiliate, claim, assignment,
   commission, category and profile actions identify the actor without passwords.
6. While signed out, request `/api/admin/products`, `/api/admin/categories`,
   `/api/admin/users`, `/api/admin/audit`, and `/api/admin/system-health`.
   Every request must be refused. A visible Admin login link must never weaken
   these server-side checks.

## 12. Cleanup

Delete or deactivate every `zz.` test record created above. Keep audit rows;
they are intentionally append-only. Confirm no test product remains public and
no test account remains active.
