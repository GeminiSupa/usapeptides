# Supabase setup — what still needs doing by hand

Everything here is one paste into the Supabase SQL editor. Nothing else is
outstanding on the database side.

---

## 1. Run the migration (required — Products and Team will not load without it)

Supabase → **SQL Editor** → **New query** → paste the whole contents of
`supabase/migrations/0004_storefront.sql` → **Run**.

It is safe to run more than once.

What it adds:

| Thing | Why |
|---|---|
| `site_settings` table | Holds the announcement bar that runs above the header |
| `products.coa_url`, `coa_lot`, `coa_tested_at` | The certificate PDF customers download |
| `products.sort_order` | Lets you control the order products appear in |
| `team_members.job_title`, `phone`, `avatar_url`, `notes`, `started_on`, `has_dashboard_access` | The table only held name, email and role, which is why the Team tab looked empty |
| `product-media` storage bucket | Product photos and certificate PDFs |

If you open the dashboard before running it, Products and Team will show a
message telling you to run this file. That is expected, not a bug.

---

## 2. Storage bucket — already done

The `product-media` bucket has been created against the live project:

- **Public**: yes — public controls *reading*, which is what lets a customer
  open a certificate from a product page.
- **Per-file limit**: 2,097,152 bytes (2 MB exactly).
- **Allowed types**: JPEG, PNG, WEBP, AVIF, GIF, SVG, and PDF. Nothing else.

Writing to it is **not** open to the public. Uploads go through
`/api/admin/upload`, which requires an administrator session and uses the
service role key server-side. The browser never gets write access to the
bucket, because the key the browser holds ships inside every page.

Files land in two folders:

```
product-media/products/…   product photos
product-media/coa/…        certificate PDFs
```

Each upload gets a fresh timestamped filename, so replacing an image never
overwrites the old one and never serves a stale cached copy.

---

## 3. Where the admin login is

`https://usapeptides-six.vercel.app/admin/login`

Signing in needs **two** things, and this is the part that is easy to get
wrong:

1. a Supabase Auth account for the address, **and**
2. a row in the `admin_users` table.

Having only the account is a customer login — it will not open the dashboard.
Having only the allow-list row cannot sign in at all. A customer who registers
on the shop can never reach the dashboard, which is the point.

### Can he create more users himself?

**Yes, now.** Dashboard → **Team** → add the person → **Grant access** on their
card. That one button creates the Auth account and the allow-list row together.
Before today this could only be done by hand in the Supabase console, which is
why it looked like the feature did not exist.

- Set a starting password of at least 10 characters, pass it to them directly,
  and have them change it once they are in.
- **Remove access** deactivates the allow-list row. The account and its history
  survive, so access can be restored without recreating the login.
- You cannot remove your own access — that would need a second administrator to
  undo.

Note this is all-or-nothing for now: anyone granted access sees the whole
dashboard. Per-section permissions are not built.

---

## 4. Current state of the database

| Table | Rows |
|---|---|
| `products` | 20 |
| `admin_users` | 1 (the owner) |
| `team_members` | 0 |
| everything else | 0 |

The 20 products came from the seed script and their artwork is **generated
placeholder SVG, not photography**. Replace it with real photos before any real
traffic — Products → Edit → Product photo.
