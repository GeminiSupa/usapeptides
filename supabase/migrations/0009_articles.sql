-- USA Peptide Depot - dashboard-managed research articles
-- Run after 0008_commissions.sql. Safe to re-run.
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(), slug text not null, title text not null,
  excerpt text not null default '', content text not null default '',
  category text not null default 'Research', author text not null default 'Research team',
  image text, tags text[] not null default '{}', read_time text not null default '5 min read',
  is_published boolean not null default false, published_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists articles_slug_idx on public.articles (slug);
create index if not exists articles_published_idx on public.articles (is_published, published_at desc);
alter table public.articles enable row level security;
drop policy if exists "published articles are publicly readable" on public.articles;
create policy "published articles are publicly readable" on public.articles for select
  using (is_published = true and published_at is not null and published_at <= now());
