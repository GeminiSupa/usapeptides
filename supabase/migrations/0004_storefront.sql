-- USA Peptides - storefront settings, media storage, richer team records
--
-- Run this in the Supabase SQL editor after 0003_crm_marketing.sql.
-- It is safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1. Site settings
--
-- One row per setting, keyed by a text id. The announcement banner lives here
-- under the id 'announcement_banners'. Readable by the public because the
-- storefront renders it; only the service role can write it.
-- ---------------------------------------------------------------------------

create table if not exists public.site_settings (
  id         text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

drop policy if exists "site settings readable" on public.site_settings;
create policy "site settings readable" on public.site_settings
  for select using (true);

-- No insert/update/delete policy: writes go through the admin API, which holds
-- the service role key and bypasses RLS.

drop trigger if exists site_settings_touch on public.site_settings;
create trigger site_settings_touch before update on public.site_settings
  for each row execute function public.touch_updated_at();

insert into public.site_settings (id, value)
values ('announcement_banners', '[]'::jsonb)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Product media
--
-- `image` already held a path. These add the certificate of analysis PDF that
-- the product page offers for download, and a record of when it was uploaded.
-- ---------------------------------------------------------------------------

alter table public.products add column if not exists coa_url        text;
alter table public.products add column if not exists coa_lot        text;
alter table public.products add column if not exists coa_tested_at  date;
alter table public.products add column if not exists sort_order     integer not null default 0;

create index if not exists products_sort_idx on public.products (sort_order, name);

-- ---------------------------------------------------------------------------
-- 3. Team members
--
-- The table only held email/name/role. A team page needs more than that.
-- ---------------------------------------------------------------------------

alter table public.team_members add column if not exists phone       text;
alter table public.team_members add column if not exists job_title   text;
alter table public.team_members add column if not exists avatar_url  text;
alter table public.team_members add column if not exists notes       text;
alter table public.team_members add column if not exists started_on  date;
alter table public.team_members add column if not exists has_dashboard_access boolean not null default false;

-- ---------------------------------------------------------------------------
-- 4. Storage bucket for product images and COA certificates
--
-- One public bucket. Public governs READING - anyone with the link can view an
-- image or open a certificate, which is the point. WRITING still goes through
-- the admin API using the service role key, so the bucket is not open to the
-- internet.
--
-- The 2 MB cap is enforced here AND in the upload route, so an oversized file
-- is refused with a message that names its actual size.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-media',
  'product-media',
  true,
  2097152,                                    -- 2 MB
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif',
    'image/svg+xml', 'application/pdf'
  ]
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
