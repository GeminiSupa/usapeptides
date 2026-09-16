-- USA Peptide Depot - commission ledger
-- Run after 0007_sales_agents.sql. Safe to re-run.

create table if not exists public.sales_commissions (
  id              uuid primary key default gen_random_uuid(),
  beneficiary_id  uuid not null references public.admin_users (id) on delete restrict,
  order_id         uuid not null references public.orders (id) on delete restrict,
  source_user_id   uuid references public.admin_users (id) on delete set null,
  kind             text not null,
  rate             numeric(5,2) not null,
  amount           numeric(10,2) not null,
  status           text not null default 'pending',
  approved_by      uuid references public.admin_users (id) on delete set null,
  approved_at      timestamptz,
  settled_by       uuid references public.admin_users (id) on delete set null,
  paid_at          timestamptz,
  reference        text,
  notes            text,
  created_at       timestamptz not null default now(),
  unique (order_id, beneficiary_id, kind)
);

do $$ begin
  alter table public.sales_commissions add constraint sales_commissions_kind_check
    check (kind in ('direct', 'override'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.sales_commissions add constraint sales_commissions_status_check
    check (status in ('pending', 'approved', 'paid', 'void'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.sales_commissions add constraint sales_commissions_rate_check
    check (rate >= 0 and rate <= 100);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.sales_commissions add constraint sales_commissions_amount_check
    check (amount >= 0);
exception when duplicate_object then null; end $$;

create index if not exists sales_commissions_beneficiary_idx
  on public.sales_commissions (beneficiary_id, status, created_at desc);

alter table public.sales_commissions enable row level security;

-- Makes affiliate commission generation idempotent as well. This deliberately
-- does not delete historical duplicates; if any exist, review them before
-- applying the index rather than silently removing a money record.
create unique index if not exists affiliate_commissions_order_idx
  on public.affiliate_commissions (affiliate_id, order_id);
