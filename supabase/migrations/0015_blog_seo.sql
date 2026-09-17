-- USA Peptide Depot - SEO and AI-answer fields for blog posts
-- Run after 0014_deal_engine.sql. Safe to re-run.
--
-- Website text, contact details and site-wide SEO need no migration: they are
-- stored in site_settings (row 'site_content'), which 0004 created.

alter table public.articles add column if not exists meta_title       text;
alter table public.articles add column if not exists meta_description text;
alter table public.articles add column if not exists keywords         text[] not null default '{}';
alter table public.articles add column if not exists canonical_url    text;
alter table public.articles add column if not exists og_image         text;
alter table public.articles add column if not exists image_alt        text;
-- Question-and-answer pairs shown under the post and published as FAQ
-- structured data, which is what answer engines quote.
alter table public.articles add column if not exists faq              jsonb not null default '[]'::jsonb;
alter table public.articles add column if not exists noindex          boolean not null default false;

do $$
begin
  if exists (select 1 from pg_proc where proname = 'touch_updated_at') then
    drop trigger if exists articles_touch on public.articles;
    create trigger articles_touch before update on public.articles
      for each row execute function public.touch_updated_at();
  end if;
end $$;
