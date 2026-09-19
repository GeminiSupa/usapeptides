-- USA Peptide Depot - products in more than one category
-- Run after 0019_customer_ownership.sql. Safe to re-run.

create table if not exists public.product_category_assignments (
  product_id uuid not null references public.products (id) on delete cascade,
  category_id uuid not null references public.product_categories (id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (product_id, category_id)
);

create index if not exists product_category_assignments_category_idx
  on public.product_category_assignments (category_id, product_id);
create unique index if not exists product_category_assignments_one_primary_idx
  on public.product_category_assignments (product_id) where is_primary = true;

-- Existing products keep their current category as their primary membership.
insert into public.product_category_assignments (product_id, category_id, is_primary)
select product.id, category.id, true
from public.products product
join public.product_categories category on category.slug = product.category_slug
on conflict (product_id, category_id) do update set is_primary = true;

-- A product edited through the existing product form still has exactly one
-- primary category. Explicit secondary memberships created in Categories stay.
create or replace function public.sync_product_primary_category()
returns trigger language plpgsql security definer set search_path = public as $$
declare next_category_id uuid;
begin
  if new.category_slug is null then return new; end if;
  select id into next_category_id from public.product_categories where slug = new.category_slug limit 1;
  if next_category_id is null then return new; end if;

  delete from public.product_category_assignments
  where product_id = new.id and is_primary = true and category_id <> next_category_id;

  insert into public.product_category_assignments (product_id, category_id, is_primary)
  values (new.id, next_category_id, true)
  on conflict (product_id, category_id) do update set is_primary = true;
  return new;
end $$;

drop trigger if exists product_primary_category_sync on public.products;
create trigger product_primary_category_sync after insert or update of category_slug on public.products
for each row execute function public.sync_product_primary_category();

alter table public.product_category_assignments enable row level security;
drop policy if exists "category memberships are publicly readable" on public.product_category_assignments;
create policy "category memberships are publicly readable"
on public.product_category_assignments for select using (true);
