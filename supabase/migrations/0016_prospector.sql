-- USA Peptide Depot - Prospector: find businesses on the map and work them as a pipeline
-- Run after 0015_blog_seo.sql. Safe to re-run.
--
-- Extends sales_prospects (0003) rather than adding a second table, so the
-- rows already there keep working. Before this runs the Prospector can still
-- search the map; saving the map details needs these columns.

alter table public.sales_prospects add column if not exists source_provider    text not null default 'manual';
alter table public.sales_prospects add column if not exists source_external_id text;
alter table public.sales_prospects add column if not exists category           text;
alter table public.sales_prospects add column if not exists formatted_address  text;
alter table public.sales_prospects add column if not exists city               text;
alter table public.sales_prospects add column if not exists region             text;
alter table public.sales_prospects add column if not exists country            text;
alter table public.sales_prospects add column if not exists latitude           double precision;
alter table public.sales_prospects add column if not exists longitude          double precision;
alter table public.sales_prospects add column if not exists map_url            text;
alter table public.sales_prospects add column if not exists whatsapp           text;
alter table public.sales_prospects add column if not exists fit_score          integer not null default 0;
alter table public.sales_prospects add column if not exists fit_reasons        text[] not null default '{}';
alter table public.sales_prospects add column if not exists notes              text;
alter table public.sales_prospects add column if not exists tags               text[] not null default '{}';
alter table public.sales_prospects add column if not exists owner_id           uuid references public.admin_users (id) on delete set null;
alter table public.sales_prospects add column if not exists last_contacted_at  timestamptz;
alter table public.sales_prospects add column if not exists lead_id            uuid references public.leads (id) on delete set null;

-- The same map place is saved once, however many searches find it.
create unique index if not exists sales_prospects_source_idx
  on public.sales_prospects (source_provider, source_external_id)
  where source_external_id is not null;

create index if not exists sales_prospects_owner_idx on public.sales_prospects (owner_id);
create index if not exists sales_prospects_next_idx on public.sales_prospects (next_action_at) where next_action_at is not null;

-- The updated_at trigger and row level security (no public access) already
-- come from 0003_crm_marketing.sql.
