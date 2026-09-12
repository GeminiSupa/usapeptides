-- USA Peptides - admin access
--
-- Run this in the Supabase SQL editor after 0001_core_schema.sql.
--
-- Admin access is an allow-list of email addresses. Being able to sign in is
-- not enough: the address must also appear in admin_users, so a customer
-- account can never reach the dashboard.

create table if not exists public.admin_users (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  full_name  text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists admin_users_email_idx
  on public.admin_users (lower(email));

alter table public.admin_users enable row level security;

-- No anon policy at all. This table is readable only via the service role key
-- from server routes, so the allow-list itself is never exposed.

-- ---------------------------------------------------------------------------
-- ADD YOURSELF
--
-- Replace the address below with the email you will sign in with, then run:
--
--   insert into public.admin_users (email, full_name)
--   values ('you@example.com', 'Your Name')
--   on conflict do nothing;
--
-- You also need a Supabase Auth account for that same address:
--   Supabase > Authentication > Users > Add user  (set a password)
-- ---------------------------------------------------------------------------
