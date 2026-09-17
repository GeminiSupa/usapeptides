-- USA Peptide Depot - visitor analytics: who visits, from where, what they look at
-- Run after 0017_campaigns.sql. Safe to re-run.
--
-- One row per browsing session (a visit), plus the individual events
-- (page views, product views, add to cart, checkout, purchase) in the
-- analytics_events table that 0001 created but nothing ever wrote to.
-- No names or emails are stored here; a visitor is an anonymous random id.

create table if not exists public.visitor_sessions (
  session_id      text primary key,
  visitor_id      text not null,
  first_seen      timestamptz not null default now(),
  last_seen       timestamptz not null default now(),
  landing_path    text,
  current_path    text,
  exit_path       text,
  referrer        text,
  source          text,          -- google, instagram, email, direct …
  medium          text,          -- organic, cpc, social, email, referral, direct
  campaign        text,
  device          text,          -- mobile | tablet | desktop
  browser         text,
  country         text,
  region          text,
  city            text,
  is_returning    boolean not null default false,
  page_views      integer not null default 0,
  product_views   integer not null default 0,
  add_to_carts    integer not null default 0,
  reached_checkout boolean not null default false,
  purchased       boolean not null default false,
  order_number    text,
  order_value     numeric(10,2),
  cart_value      numeric(10,2) not null default 0
);

create index if not exists visitor_sessions_first_seen on public.visitor_sessions (first_seen desc);
create index if not exists visitor_sessions_last_seen on public.visitor_sessions (last_seen desc);
create index if not exists visitor_sessions_visitor on public.visitor_sessions (visitor_id);

alter table public.analytics_events add column if not exists visitor_id   text;
alter table public.analytics_events add column if not exists product_slug text;
alter table public.analytics_events add column if not exists value        numeric(10,2);

create index if not exists analytics_events_name_time on public.analytics_events (event_name, created_at desc);
create index if not exists analytics_events_product on public.analytics_events (product_slug, created_at desc) where product_slug is not null;

-- Server-only: written by /api/track, read by the dashboard.
alter table public.visitor_sessions enable row level security;
alter table public.analytics_events enable row level security;

-- Bump a session's counters atomically, so two tabs never lose a count.
create or replace function public.track_session(
  p_session text, p_visitor text, p_path text, p_page_view int, p_product_view int,
  p_add_to_cart int, p_checkout boolean, p_cart_value numeric
) returns void language plpgsql security definer set search_path = public as $$
begin
  update public.visitor_sessions set
    last_seen = now(),
    current_path = coalesce(p_path, current_path),
    exit_path = coalesce(p_path, exit_path),
    page_views = page_views + p_page_view,
    product_views = product_views + p_product_view,
    add_to_carts = add_to_carts + p_add_to_cart,
    reached_checkout = reached_checkout or p_checkout,
    cart_value = coalesce(p_cart_value, cart_value)
  where session_id = p_session and visitor_id = p_visitor;
end $$;

revoke all on function public.track_session(text, text, text, int, int, int, boolean, numeric) from public, anon, authenticated;
