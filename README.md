# USA Peptides

A research-peptide storefront with a full admin dashboard, built to be reused as a
template for other businesses.

- **Live:** https://usapeptides-six.vercel.app
- **Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres, Auth, Storage) · Vercel

> **AI agents and new developers: read [CLAUDE.md](CLAUDE.md) first**, then
> [docs/TODO.md](docs/TODO.md). They cover the rules that keep this project from
> breaking — secrets, migrations, security and design.

---

## What is built

**Storefront**
- Catalogue, category pages, product pages and search, all read live from the
  database (the bundled `src/data/products.ts` is only a fallback)
- Certificate of Analysis viewer with downloadable PDF per product
- Tiered volume pricing (10% at 3+, 15% at 5+, 20% at 10+), cart, checkout
- Announcement bar controlled from the dashboard
- Optional Chatwoot live chat

**Dashboard** (`/admin`)
- Products: category dropdown, photo and COA uploads (2 MB cap), grouped by category
- Orders, customers, enquiries, reviews, carts, leads, prospects, deals,
  commissions, campaigns, subscribers, notifications, activity log
- **Users** — one tab with three kinds of people:
  - **Team** — staff with per-section permissions and base pay
  - **Sub-users** — sellers recruited by staff, capped at two levels
  - **Affiliates** — outside partners with a referral code
- Audit trail of every privileged action (append-only)

**Not yet working** — see [docs/TODO.md](docs/TODO.md): taking payments, sending
email, referral earnings tracking, the blog editor.

---

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the three Supabase values
npm run dev                  # http://localhost:3000
```

Other scripts: `npm run build`, `npm run seed` (load the catalogue into Supabase).

> Do not run `npm run build` while `npm run dev` is running — they share `.next/`
> and the dev server breaks.

### Environment variables

Only three are required. Everything else is optional and switches its feature off
cleanly when absent. Full list with comments in [.env.example](.env.example).

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Vercel type **Config** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Vercel type **Config** |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server only. Vercel type **Secret**. Never prefix `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_CHATWOOT_*`, `CHATWOOT_*` | no | Live chat — see [docs/CHATWOOT-SETUP.md](docs/CHATWOOT-SETUP.md) |
| `SMTP_*` | no | Email — not wired yet |
| `NEXT_PUBLIC_PAYPAL_*`, `PAYPAL_SECRET` | no | Payments — not wired yet |

Vercel only applies new variables after a redeploy. `/api/health` reports which
features are switched on without revealing any value.

### Database

Run each file in `supabase/migrations/` **in order** in the Supabase SQL editor.
They are safe to re-run. Then:

1. Create a user in Supabase → Authentication → Users.
2. Add that email to `admin_users` (instructions at the bottom of `0002_admin.sql`).
3. Run `0005_users.sql` — it promotes that first admin to super admin.

Details: [docs/SUPABASE-SETUP.md](docs/SUPABASE-SETUP.md).

---

## Reusing this for another business

1. Fork the repo and create a new Supabase project — **never share a database
   between businesses.**
2. Change `BUSINESS` in `src/lib/env.ts`.
3. Set the three Supabase variables, run the migrations, add your first admin.
4. Replace `public/vials/` artwork, the categories in `src/data/categories.ts`,
   and the policy page copy.

No business name, person or email is hardcoded outside `BUSINESS`.

---

## Deployment

Vercel builds a normal server-rendered Next.js app on every push to `main`.
**It is not a static export** — `output: 'export'` would disable every API route.

## Before launch

- Product artwork in `public/vials/` is generated placeholder SVG, not photography.
- Policy pages are drafts, **not legal advice** — this is a regulated product
  category and they need a lawyer's review.

## Documentation

| | |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Rules for anyone (or any AI) changing the code |
| [docs/TODO.md](docs/TODO.md) | Current status and next steps |
| [docs/USERS-AND-SECURITY.md](docs/USERS-AND-SECURITY.md) | Permissions and security model |
| [docs/SUPABASE-SETUP.md](docs/SUPABASE-SETUP.md) | Database and storage setup |
| [docs/CHATWOOT-SETUP.md](docs/CHATWOOT-SETUP.md) | Live chat setup |
