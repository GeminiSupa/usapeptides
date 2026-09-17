-- USA Peptide Depot - product and quantity based promotion engine
-- Run after 0013_order_contact_sync.sql. Safe to re-run.

alter table public.deals add column if not exists discount_type text not null default 'percent';
alter table public.deals add column if not exists discount_value numeric(10,2);
alter table public.deals add column if not exists min_quantity integer not null default 1;
alter table public.deals add column if not exists max_quantity integer;
alter table public.deals add column if not exists applies_to_all boolean not null default false;
alter table public.deals add column if not exists banner_text text;
alter table public.deals add column if not exists banner_href text;
alter table public.deals add column if not exists updated_at timestamptz not null default now();

update public.deals set discount_value = discount_percent
where discount_value is null and discount_percent is not null;

do $$ begin
  alter table public.deals add constraint deals_discount_type_check check (discount_type in ('percent','fixed'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.deals add constraint deals_discount_value_check check (discount_value > 0);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.deals add constraint deals_quantity_check check (min_quantity >= 1 and (max_quantity is null or max_quantity >= min_quantity));
exception when duplicate_object then null; end $$;

create table if not exists public.deal_products (
  deal_id uuid not null references public.deals(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  primary key (deal_id, product_id)
);
alter table public.deal_products enable row level security;
revoke all on public.deal_products from anon, authenticated;
create index if not exists deal_products_product_idx on public.deal_products(product_id);
