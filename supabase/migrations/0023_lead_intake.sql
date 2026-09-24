-- USA Peptide Depot - lead intake for the local lead-gen sites
-- Run after 0022_product_partner_sync.sql. Safe to re-run.
--
-- Adds the columns a local-site lead carries, the table of registered sites
-- (one row per domain: its key, the domains allowed to post with it, and the
-- tracking number printed on it), and a bell notification when a lead lands.

-- ---------------------------------------------------------------------------
-- Leads: what a lead-gen form sends beyond name, email and phone
-- ---------------------------------------------------------------------------

alter table public.leads add column if not exists lead_source     text;
alter table public.leads add column if not exists interest        text;
alter table public.leads add column if not exists goal            text;
alter table public.leads add column if not exists tracking_phone  text;
alter table public.leads add column if not exists meta            jsonb;

comment on column public.leads.lead_source is
  'Which site sent the lead, e.g. peptidesoklahomacity.com. The storefront''s own forms leave this null.';
comment on column public.leads.tracking_phone is
  'The phone number printed on that site, so the owner can see which number pulls.';
comment on column public.leads.meta is
  'Page URL, referrer, UTM values and user agent captured at submission.';

create index if not exists leads_lead_source_idx on public.leads (lead_source, created_at desc);
-- Dedupe looks a lead up by email or phone on every submission.
create index if not exists leads_email_lower_idx on public.leads (lower(email));
create index if not exists leads_phone_idx       on public.leads (phone);

-- ---------------------------------------------------------------------------
-- The registered lead-gen sites
-- ---------------------------------------------------------------------------

create table if not exists public.lead_sites (
  id             uuid primary key default gen_random_uuid(),
  site_key       text not null unique,        -- public; sits in the page HTML
  label          text not null,               -- "Oklahoma City"
  domains        text not null default '',    -- comma separated, no scheme
  tracking_phone text,
  post_secret    text,                        -- only for sites posting server-side
  is_active      boolean not null default true,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.lead_sites is
  'One row per lead-gen domain. The site_key is public; the domains list is what actually authorises a post.';

create index if not exists lead_sites_active_idx on public.lead_sites (is_active, label);

do $$
begin
  if exists (select 1 from pg_proc where proname = 'touch_updated_at') then
    drop trigger if exists lead_sites_touch on public.lead_sites;
    create trigger lead_sites_touch before update on public.lead_sites
      for each row execute function public.touch_updated_at();
  end if;
end $$;

-- Reachable only through server routes holding the service role key.
alter table public.lead_sites enable row level security;
revoke all on table public.lead_sites from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Bell notification for a lead-gen lead
-- ---------------------------------------------------------------------------
-- Only for leads captured by a local site. Storefront and chat leads already
-- have their own paths and would just double the noise.

create or replace function public.notify_new_local_lead()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.admin_notifications (kind, title, body, link)
  values (
    'lead',
    'New lead from ' || coalesce(nullif(new.lead_source, ''), 'a local site'),
    coalesce(nullif(new.full_name, ''), new.email, new.phone, 'Unnamed')
      || coalesce(' · ' || nullif(new.phone, ''), ''),
    '/admin?section=leads'
  );
  return new;
end $$;

drop trigger if exists new_local_lead_notification on public.leads;
create trigger new_local_lead_notification after insert on public.leads
for each row when (new.source = 'local_site')
execute function public.notify_new_local_lead();
