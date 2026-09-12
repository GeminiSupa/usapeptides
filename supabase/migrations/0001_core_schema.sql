-- USA Peptides - core commerce schema
--
-- Run this against YOUR OWN Supabase project. This deployment is standalone:
-- it shares no tables, rows or credentials with any other store.
--
-- Apply with:  supabase db push
-- or paste into the Supabase SQL editor.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------

create table if not exists public.products (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  name           text not null,
  category       text,
  category_slug  text,
  price          numeric(10,2) not null check (price >= 0),
  sale_price     numeric(10,2) check (sale_price >= 0),
  sku            text unique,
  purity         text,
  sequence       text,
  cas_number     text,
  molar_mass     text,
  formula        text,
  storage        text,
  appearance     text,
  description    text,
  details        jsonb not null default '[]'::jsonb,
  specs          jsonb not null default '[]'::jsonb,
  bulk_pricing   jsonb not null default '[]'::jsonb,
  coa            jsonb,
  image          text,
  tags           text[] not null default '{}',
  in_stock       boolean not null default true,
  stock_count    integer not null default 0 check (stock_count >= 0),
  is_featured    boolean not null default false,
  is_popular     boolean not null default false,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists products_category_slug_idx on public.products (category_slug);
create index if not exists products_active_idx on public.products (is_active) where is_active;

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------

create table if not exists public.customer_profiles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid unique references auth.users (id) on delete cascade,
  email         text not null,
  full_name     text,
  institution   text,
  phone         text,
  marketing_opt_in boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists customer_profiles_email_idx
  on public.customer_profiles (lower(email));

create table if not exists public.customer_addresses (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customer_profiles (id) on delete cascade,
  label        text,
  line1        text not null,
  line2        text,
  city         text not null,
  state        text,
  postal_code  text not null,
  country      text not null default 'US',
  is_default   boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists customer_addresses_customer_idx
  on public.customer_addresses (customer_id);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------

create type order_status as enum (
  'pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'
);

create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  order_number      text not null unique,
  customer_id       uuid references public.customer_profiles (id) on delete set null,
  email             text not null,
  full_name         text,
  institution       text,
  phone             text,
  status            order_status not null default 'pending',
  subtotal          numeric(10,2) not null default 0,
  discount_total    numeric(10,2) not null default 0,
  shipping_total    numeric(10,2) not null default 0,
  grand_total       numeric(10,2) not null default 0,
  currency          text not null default 'USD',
  coupon_code       text,
  shipping_address  jsonb,
  payment_provider  text,
  payment_reference text,
  tracking_number   text,
  notes             text,
  compliance_ack    boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists orders_email_idx on public.orders (lower(email));
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_created_idx on public.orders (created_at desc);

create table if not exists public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete cascade,
  product_id    uuid references public.products (id) on delete set null,
  product_slug  text not null,
  product_name  text not null,
  sku           text,
  unit_price    numeric(10,2) not null check (unit_price >= 0),
  quantity      integer not null check (quantity > 0),
  line_total    numeric(10,2) not null check (line_total >= 0),
  created_at    timestamptz not null default now()
);

create index if not exists order_items_order_idx on public.order_items (order_id);

-- ---------------------------------------------------------------------------
-- Engagement
-- ---------------------------------------------------------------------------

create table if not exists public.newsletter_subscribers (
  id             uuid primary key default gen_random_uuid(),
  email          text not null,
  source         text,
  is_subscribed  boolean not null default true,
  unsubscribed_at timestamptz,
  created_at     timestamptz not null default now()
);

create unique index if not exists newsletter_email_idx
  on public.newsletter_subscribers (lower(email));

create table if not exists public.customer_inquiries (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null,
  institution text,
  subject     text,
  message     text not null,
  status      text not null default 'new',
  created_at  timestamptz not null default now()
);

create index if not exists inquiries_status_idx on public.customer_inquiries (status, created_at desc);

create table if not exists public.product_reviews (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid references public.products (id) on delete cascade,
  product_slug text not null,
  author_name  text not null,
  institution  text,
  rating       integer not null check (rating between 1 and 5),
  body         text,
  is_approved  boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists reviews_product_idx
  on public.product_reviews (product_slug) where is_approved;

create table if not exists public.abandoned_carts (
  id          uuid primary key default gen_random_uuid(),
  session_id  text not null,
  email       text,
  items       jsonb not null default '[]'::jsonb,
  cart_total  numeric(10,2) not null default 0,
  recovered   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists abandoned_carts_session_idx
  on public.abandoned_carts (session_id);

create table if not exists public.analytics_events (
  id          bigserial primary key,
  event_name  text not null,
  session_id  text,
  path        text,
  referrer    text,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists analytics_created_idx on public.analytics_events (created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'products', 'customer_profiles', 'orders', 'abandoned_carts'
  ] loop
    execute format(
      'drop trigger if exists %I_touch on public.%I; '
      'create trigger %I_touch before update on public.%I '
      'for each row execute function public.touch_updated_at();',
      t, t, t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Row level security
--
-- Default posture: deny. The anon key may read the live catalogue and approved
-- reviews, and may submit enquiries / newsletter signups. Everything else is
-- reachable only through server routes using the service role key.
-- ---------------------------------------------------------------------------

alter table public.products              enable row level security;
alter table public.customer_profiles     enable row level security;
alter table public.customer_addresses    enable row level security;
alter table public.orders                enable row level security;
alter table public.order_items           enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.customer_inquiries    enable row level security;
alter table public.product_reviews       enable row level security;
alter table public.abandoned_carts       enable row level security;
alter table public.analytics_events      enable row level security;

-- Catalogue: world readable when active.
drop policy if exists "products readable" on public.products;
create policy "products readable" on public.products
  for select using (is_active);

-- Reviews: only approved ones are public; anyone may submit one for moderation.
drop policy if exists "approved reviews readable" on public.product_reviews;
create policy "approved reviews readable" on public.product_reviews
  for select using (is_approved);

drop policy if exists "anyone may submit a review" on public.product_reviews;
create policy "anyone may submit a review" on public.product_reviews
  for insert with check (is_approved = false);

-- Enquiries and newsletter: insert-only from the public site.
drop policy if exists "anyone may submit an enquiry" on public.customer_inquiries;
create policy "anyone may submit an enquiry" on public.customer_inquiries
  for insert with check (true);

drop policy if exists "anyone may subscribe" on public.newsletter_subscribers;
create policy "anyone may subscribe" on public.newsletter_subscribers
  for insert with check (true);

-- Signed-in customers may see their own profile and orders.
drop policy if exists "own profile readable" on public.customer_profiles;
create policy "own profile readable" on public.customer_profiles
  for select using (auth.uid() = user_id);

drop policy if exists "own profile updatable" on public.customer_profiles;
create policy "own profile updatable" on public.customer_profiles
  for update using (auth.uid() = user_id);

drop policy if exists "own addresses readable" on public.customer_addresses;
create policy "own addresses readable" on public.customer_addresses
  for select using (
    exists (
      select 1 from public.customer_profiles p
      where p.id = customer_addresses.customer_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "own orders readable" on public.orders;
create policy "own orders readable" on public.orders
  for select using (
    exists (
      select 1 from public.customer_profiles p
      where p.id = orders.customer_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "own order items readable" on public.order_items;
create policy "own order items readable" on public.order_items
  for select using (
    exists (
      select 1
      from public.orders o
      join public.customer_profiles p on p.id = o.customer_id
      where o.id = order_items.order_id and p.user_id = auth.uid()
    )
  );

-- abandoned_carts and analytics_events carry no anon policy on purpose:
-- they are written only by server routes holding the service role key.
