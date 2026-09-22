-- CRM-only information: never put internal notes on customer-readable profiles.
-- Run after 0022. Safe to run again; no existing rows are changed.
create table if not exists public.customer_retention (
  customer_id uuid primary key references public.customer_profiles(id) on delete cascade,
  acquisition_source text not null default '' check (length(acquisition_source) <= 200),
  notes text not null default '' check (length(notes) <= 5000),
  reorder_days integer check (reorder_days between 1 and 365),
  follow_up_after date,
  updated_at timestamptz not null default now()
);
alter table public.customer_retention enable row level security;
revoke all on public.customer_retention from anon, authenticated;
grant all on public.customer_retention to service_role;
comment on table public.customer_retention is 'Staff-only purchasing cadence and follow-up notes. Not a medical supply estimate.';
