-- USA Peptides - CRM, marketing and operations tables
--
-- Run after 0002_admin.sql. These back the admin sections beyond the core
-- storefront: leads, prospects, CRM activity, deals, affiliates, campaigns,
-- fulfilment and internal notifications.
--
-- Every table here is server-side only. None carries an anon policy, so the
-- public key cannot read or write any of it.

-- ---------------------------------------------------------------------------
-- Leads and prospects
-- ---------------------------------------------------------------------------

create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  email         text,
  phone         text,
  full_name     text,
  institution   text,
  source        text,                       -- catalog form, chat, import, ads
  status        text not null default 'new',-- new | working | qualified | lost | converted
  assigned_to   text,
  score         integer not null default 0,
  notes         text,
  last_contacted_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists leads_status_idx on public.leads (status, created_at desc);
create index if not exists leads_assigned_idx on public.leads (assigned_to);

create table if not exists public.sales_prospects (
  id           uuid primary key default gen_random_uuid(),
  company      text not null,
  contact_name text,
  email        text,
  phone        text,
  website      text,
  segment      text,
  stage        text not null default 'identified', -- identified | contacted | meeting | proposal | won | lost
  owner        text,
  next_action  text,
  next_action_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists prospects_stage_idx on public.sales_prospects (stage);

create table if not exists public.crm_activity (
  id          uuid primary key default gen_random_uuid(),
  subject_type text not null,               -- lead | prospect | customer | order
  subject_id   uuid,
  activity     text not null,               -- note | call | email | status_change
  body         text,
  actor        text,
  created_at   timestamptz not null default now()
);

create index if not exists crm_activity_subject_idx
  on public.crm_activity (subject_type, subject_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Fulfilment
-- ---------------------------------------------------------------------------

create table if not exists public.fulfillment_queue (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete cascade,
  stage       text not null default 'queued', -- queued | picking | packed | dispatched
  assigned_to text,
  picked_at   timestamptz,
  packed_at   timestamptz,
  dispatched_at timestamptz,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists fulfillment_order_idx
  on public.fulfillment_queue (order_id);

-- ---------------------------------------------------------------------------
-- Promotions
-- ---------------------------------------------------------------------------

create table if not exists public.deals (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  product_slug  text,
  discount_percent integer check (discount_percent between 0 and 90),
  coupon_code   text,
  starts_at     timestamptz,
  ends_at       timestamptz,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists deals_active_idx on public.deals (is_active, ends_at);

-- ---------------------------------------------------------------------------
-- Affiliates
-- ---------------------------------------------------------------------------

create table if not exists public.affiliates (
  id             uuid primary key default gen_random_uuid(),
  email          text not null,
  full_name      text,
  referral_code  text not null,
  commission_rate numeric(5,2) not null default 10.00,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

create unique index if not exists affiliates_code_idx on public.affiliates (referral_code);
create unique index if not exists affiliates_email_idx on public.affiliates (lower(email));

create table if not exists public.affiliate_commissions (
  id           uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates (id) on delete cascade,
  order_id     uuid references public.orders (id) on delete set null,
  amount       numeric(10,2) not null default 0,
  status       text not null default 'pending', -- pending | approved | paid | void
  created_at   timestamptz not null default now(),
  paid_at      timestamptz
);

create index if not exists commissions_affiliate_idx
  on public.affiliate_commissions (affiliate_id, status);

-- ---------------------------------------------------------------------------
-- Campaigns and broadcasts
-- ---------------------------------------------------------------------------

create table if not exists public.campaigns (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  channel      text not null default 'email', -- email | whatsapp | messenger
  subject      text,
  body         text,
  audience     text not null default 'subscribers',
  status       text not null default 'draft', -- draft | scheduled | sending | sent | paused
  scheduled_at timestamptz,
  sent_count   integer not null default 0,
  failed_count integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists campaigns_status_idx on public.campaigns (status, scheduled_at);

create table if not exists public.campaign_events (
  id          bigserial primary key,
  campaign_id uuid references public.campaigns (id) on delete cascade,
  recipient   text,
  event       text not null,   -- queued | sent | delivered | opened | clicked | failed
  detail      text,
  created_at  timestamptz not null default now()
);

create index if not exists campaign_events_idx
  on public.campaign_events (campaign_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Internal
-- ---------------------------------------------------------------------------

create table if not exists public.admin_notifications (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null,          -- order | inquiry | review | stock | system
  title      text not null,
  body       text,
  link       text,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists admin_notifications_unread_idx
  on public.admin_notifications (is_read, created_at desc);

create table if not exists public.team_members (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  full_name  text,
  role       text not null default 'staff', -- owner | manager | staff
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists team_email_idx on public.team_members (lower(email));

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'leads', 'sales_prospects', 'fulfillment_queue', 'campaigns'
  ] loop
    execute format(
      'drop trigger if exists %I_touch on public.%I; '
      'create trigger %I_touch before update on public.%I '
      'for each row execute function public.touch_updated_at();',
      t, t, t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Row level security: enabled with no anon policies, so these are reachable
-- only through server routes holding the service role key.
-- ---------------------------------------------------------------------------

alter table public.leads                  enable row level security;
alter table public.sales_prospects        enable row level security;
alter table public.crm_activity           enable row level security;
alter table public.fulfillment_queue      enable row level security;
alter table public.deals                  enable row level security;
alter table public.affiliates             enable row level security;
alter table public.affiliate_commissions  enable row level security;
alter table public.campaigns              enable row level security;
alter table public.campaign_events        enable row level security;
alter table public.admin_notifications    enable row level security;
alter table public.team_members           enable row level security;
