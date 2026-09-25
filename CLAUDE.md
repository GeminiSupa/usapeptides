# CLAUDE.md — read this before touching anything

USA Peptide Depot: a research-peptide storefront with an admin dashboard, on Next.js 14
(App Router) + Supabase, deployed on Vercel. It is also meant to become a
**template other businesses reuse**, so nothing business-specific may be
hardcoded.

Live: https://usapeptides-six.vercel.app · Repo: `GeminiSupa/usapeptides`, branch `main`

**First thing every session:** read `docs/TODO.md`. It is the running plan — what
is done, what is blocked, what is waiting on the owner. Update it when you finish
something.

---

## Hard rules — breaking any of these has already cost real time

1. **Never commit secrets.** `.env.local` holds live Supabase and Chatwoot keys.
   Before every commit run `git diff --cached --name-only` and confirm no `.env`
   file and nothing under `peptidecosta/` is staged.

2. **`peptidecosta/` is a read-only reference copy of a different business.** It
   is still in this folder and it holds 37 live production credentials. Never
   read its `.env*` files, never import from it, never copy its keys, never
   point this project at its database, its API or its storage. The owner's
   words: *there must be no data connection between peptidecosta and USA
   Peptide Depot.* Read its source only to learn how a feature was built, and
   bring across the idea, never the code or the keys.
   Nothing in this codebase depends on it - checked 2026-09-25: no import, no
   file read, no script, no asset path. The `peptidecosta/` lines in
   `.gitignore` and in the `exclude` list of `tsconfig.json` are guards, so a
   copy can never be committed or compiled; leave them in place whether or not
   the folder is here. The owner started deleting the folder on 2026-09-25 and
   cancelled part way (nothing was lost). Deleting it is his call, not yours.

3. **This is NOT a static export.** Never add `output: 'export'` to
   `next.config.mjs`. It disables every API route: the dashboard, checkout,
   uploads and webhooks all stop working.

4. **Never run `next build` while the dev server is running.** They share
   `.next/`, and the dev server breaks — pages render unstyled and APIs return
   spurious 401s. This has happened twice. Stop the dev server, `rm -rf .next`,
   build, then restart.

5. **The service role key is server-only.** Code using it imports
   `'server-only'` (see `src/lib/supabaseAdmin.ts`). Never give it a
   `NEXT_PUBLIC_` prefix and never use it in a client component.

6. **Do not remove `cache: 'no-store'` from `src/lib/supabaseAdmin.ts`.** Next 14
   caches `fetch` inside route handlers; without it an empty query result is
   replayed forever (the catalogue showed 0 products after seeding).

7. **Never edit a migration that has been applied. Add a new numbered one.**
   See Migrations below.

8. **Destructive or outward-facing actions need the owner's explicit yes:**
   force-push, history rewrites, dropping tables, deleting real rows, deleting
   `peptidecosta/`, publishing content on the live site. "Push it" means push,
   not rewrite.

9. **The brand is "USA Peptide Depot".** Never use the name "Battle Born" or copy text
   or images from its site. It is only the UI reference (see below).

---

## Reference projects

- **UI:** we are recreating the look of **https://battlebornresearch.com**.
- **Features:** modelled on the **`peptidecosta/`** project (rule 2). Same
  features, in our design, on our own Supabase, with no data connection of any
  kind.

---

## Migrations

Applied **by hand** in the Supabase SQL editor, in number order:
`supabase/migrations/0001` … `0017`.

- You cannot run DDL: `SUPABASE_DB_URL` is blank. Write the file, tell the owner
  to run it, then verify by querying the REST API.
- Every migration must be idempotent (`if not exists`, `on conflict do nothing`,
  `do $$ … exception when duplicate_object`).
- **Code must keep working when the newest migration has not been run yet.**
  Either degrade (read the older column set, hide the new fields) or return a
  message naming what to run. Never let the screen that would tell the owner to
  run the SQL be the screen that refuses to load.
- Status at last check (2026-09-17): 0001–0017 applied.
- Unicode escape sequences (backslash, u, four hex digits) written through the
  file tools arrive as the real characters. Build them with chr() in a script,
  and re-test anything that escapes output: this once silently disabled the
  JSON-LD script-tag escaping.

---

## Security model — do not weaken

Written up in full in `docs/USERS-AND-SECURITY.md`. The invariants:

- `src/lib/permissions.ts` is the **single source** of modules and access rules,
  imported by the API and the sidebar. Never copy the list elsewhere.
- `src/lib/routePermissions.ts` maps API paths to permissions. **An unmapped
  `/api/admin/*` path requires super admin** — the safe failure.
- `requireAdmin()` (`src/lib/adminAuth.ts`) checks: valid session → row in
  `admin_users` → status active → permission. **Sub-users are refused on every
  route unless it passes `allowSubUser`.**
- Posted permissions are filtered through `sanitizePermissions`. `users` and
  `audit` are never grantable.
- Nobody may change their own role, status or permissions — super admin
  included. The last active super admin cannot be demoted, suspended or deleted
  (API **and** database trigger).
- Two levels only: staff → sub-user. Enforced in a DB trigger, the API and the UI.
- A staff invite creates **no login**; only super-admin approval creates one.
- `admin_audit_log` is append-only (trigger refuses UPDATE/DELETE). **Never add a
  foreign key into it** — an ON DELETE action cannot run against an append-only
  table and makes the referenced rows undeletable (that exact bug was fixed in
  0006).
- Passwords: minimum 12 characters, never logged, never returned, redacted from
  the audit log.
- Referral codes: `crypto.randomInt`, never `Math.random`.
- Upload route only stores URLs from our own Supabase storage; bucket
  `product-media`, 2 MB cap.

**Adding a dashboard section:** add it to `MODULES` in `permissions.ts`, then add
its route pattern to `routePermissions.ts`. Skip the second and it is super-admin
only.

"Owner" in older code means **super admin** (column `is_superadmin`). The UI says
"Super admin".

---

## Design rules — the owner has rejected violations of these

- **No decorative "AI slop":** no gradients, glows, drop shadows, star/emoji
  ornaments, flag stripes, two-tone headlines. Flat surfaces, hairline borders,
  near-square corners.
- Fonts: Archivo (display, 800, uppercase) over Manrope (body). Root font-size
  steps 14px → 15px at 768px → 16px at 1280px (`globals.css`). Do not shrink it.
- **Brand colours come from `brandkit.PDF`: Forest #1F4233, Cream #FDFBF0,
  Navy #233049.** Pages are cream with forest headings and buttons and navy
  highlights; the header, hero and mobile nav are forest, the footer and
  announcement bar navy. The `brand.*` Tailwind tokens are CSS variables
  (`globals.css`): wrap a band in `.theme-forest` or `.theme-navy` rather than
  hard-coding colours. Never use `text-white` or `text-gray-*` for page text;
  use `text-brand-heading/body/textMuted`, and `text-brand-onAccent` on a
  `bg-brand-accent` fill. The owner rejected an all-green site.
- **Action colours** are separate tokens in
  `tailwind.config.ts`: `action` #BF4F0B (white text) for add-to-cart, checkout
  and place-order; `whatsapp` #25D366 (dark `whatsapp-ink` text, never white) for
  WhatsApp buttons. These are the owner's conversion-tested colours — do not
  change them without asking.
- Copy must be original. Never paste text from battlebornresearch.com or any
  other site. No fabricated testimonials, labs or reviews.

---

## Reusability

- Business identity lives in `BUSINESS` in `src/lib/env.ts`. No business name,
  email or domain hardcoded anywhere else.
- Every integration is optional and gated by `features` in `env.ts`. Missing
  credentials must mean "feature off with a clear message", never a crash.
- No person is hardcoded. The first super admin is promoted by migration 0005
  from whoever is already on the allow-list.

---

## Verify before you claim anything works

```bash
npx tsc --noEmit          # must be clean
npx next build            # only with the dev server STOPPED (rule 4)
```

- The dev server is started through `.claude/launch.json` (name `usa-peptides`).
- API tests need an admin session. Mint one without anybody's password using the
  service role: `POST /auth/v1/admin/generate_link {type:'magiclink',email}`,
  then `POST /auth/v1/verify {type:'magiclink', token_hash}`. Note the field is
  `token_hash`, not `token`.
- Test rows use a `zz.` email prefix and **must be deleted afterwards**. The
  owner's database holds real data.
- A pushed commit is not a deployed site. Check the live URL before saying
  "it's live" — the owner has judged stale deployments before.
- `NEXT_PUBLIC_*` variables in Vercel must be type **Config**, not Secret, and
  Vercel only applies new variables after a redeploy.

---

## Talking to the owner

- **Plain English, short.** They have said "what???? plain english" when answers
  got technical. Lead with what changed and what they need to do.
- Say clearly what is verified versus assumed, and what is waiting on them.
- If you made a mistake, say so in one line and fix it.
- Commit messages explain *why*; end them with the attribution line.

---

## Where things are

| Path | What |
|---|---|
| `docs/TODO.md` | Running plan and status — **read first** |
| `docs/USERS-AND-SECURITY.md` | Permission and security model |
| `docs/SUPABASE-SETUP.md` | Database, storage bucket, admin login |
| `docs/CHATWOOT-SETUP.md` | Live chat and chat-to-lead webhook |
| `docs/CLIENT-MESSAGE.md` | Message for the owner's client |
| `src/lib/env.ts` | Business identity, env vars, feature flags |
| `src/lib/permissions.ts` | Modules and access rules (shared) |
| `src/lib/adminAuth.ts` | `requireAdmin` |
| `src/lib/routePermissions.ts` | API path → permission |
| `src/lib/catalogue.ts`, `src/hooks/useCatalogue.ts` | Storefront reads the DB; `src/data/products.ts` is only a fallback |
| `src/app/admin/page.tsx` | Dashboard shell |
| `src/components/admin/` | Dashboard panels |
| `src/app/api/admin/` | Admin API |
| `supabase/migrations/` | Schema, applied by hand in order |
