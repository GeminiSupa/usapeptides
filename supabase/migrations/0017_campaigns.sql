-- USA Peptide Depot - email campaigns: builder, audiences, sending and reports
-- Run after 0016_prospector.sql. Safe to re-run.
--
-- Extends the campaigns table from 0003 and adds who each campaign went to,
-- and a do-not-email list that every campaign respects.

alter table public.campaigns add column if not exists preview_text    text;
alter table public.campaigns add column if not exists from_name       text;
alter table public.campaigns add column if not exists reply_to        text;
alter table public.campaigns add column if not exists design          jsonb not null default '{}'::jsonb;
alter table public.campaigns add column if not exists html            text;
alter table public.campaigns add column if not exists audience_filter text not null default 'none';
alter table public.campaigns add column if not exists recipient_count integer not null default 0;
alter table public.campaigns add column if not exists open_count      integer not null default 0;
alter table public.campaigns add column if not exists click_count     integer not null default 0;
alter table public.campaigns add column if not exists unsubscribe_count integer not null default 0;
alter table public.campaigns add column if not exists started_at      timestamptz;
alter table public.campaigns add column if not exists completed_at    timestamptz;
alter table public.campaigns add column if not exists last_test_at    timestamptz;
alter table public.campaigns add column if not exists created_by      uuid references public.admin_users (id) on delete set null;

-- One row per person a campaign is (or was) going to.
create table if not exists public.campaign_recipients (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references public.campaigns (id) on delete cascade,
  email         text not null,               -- always stored lower-case
  name          text,
  source        text,                                  -- subscriber | customer | lead
  status        text not null default 'queued',        -- queued | sending | sent | failed | skipped
  error         text,
  claimed_at    timestamptz,
  sent_at       timestamptz,
  opened_at     timestamptz,
  open_count    integer not null default 0,
  clicked_at    timestamptz,
  click_count   integer not null default 0,
  unsubscribed_at timestamptz,
  created_at    timestamptz not null default now()
);

create unique index if not exists campaign_recipients_unique on public.campaign_recipients (campaign_id, email);
create index if not exists campaign_recipients_queue on public.campaign_recipients (campaign_id, status);
create index if not exists campaign_recipients_email on public.campaign_recipients (lower(email));

-- Addresses that must never get marketing email again: unsubscribes, bounces,
-- complaints. Checked on every send, whichever list the address came from.
create table if not exists public.email_suppressions (
  email       text primary key,
  reason      text not null default 'unsubscribed',  -- unsubscribed | bounced | complained | manual
  campaign_id uuid references public.campaigns (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Server-only, like the rest of the marketing tables.
alter table public.campaign_recipients enable row level security;
alter table public.email_suppressions  enable row level security;

-- Counters bumped by the open/click tracker without a read-modify-write race.
create or replace function public.campaign_track(p_recipient uuid, p_kind text)
returns void language plpgsql security definer set search_path = public as $$
declare
  camp uuid;
  first_time boolean;
begin
  if p_kind = 'open' then
    update public.campaign_recipients
      set open_count = open_count + 1, opened_at = coalesce(opened_at, now())
      where id = p_recipient
      returning campaign_id, open_count = 1 into camp, first_time;
    if camp is not null and first_time then
      update public.campaigns set open_count = open_count + 1 where id = camp;
    end if;
  elsif p_kind = 'click' then
    update public.campaign_recipients
      set click_count = click_count + 1, clicked_at = coalesce(clicked_at, now()),
          -- A click proves the email was opened even when images were blocked.
          opened_at = coalesce(opened_at, now()), open_count = greatest(open_count, 1)
      where id = p_recipient
      returning campaign_id, click_count = 1 into camp, first_time;
    if camp is not null and first_time then
      update public.campaigns set click_count = click_count + 1 where id = camp;
      update public.campaigns c set open_count = (
        select count(*) from public.campaign_recipients r where r.campaign_id = camp and r.opened_at is not null
      ) where c.id = camp;
    end if;
  end if;
end $$;

revoke all on function public.campaign_track(uuid, text) from public, anon, authenticated;
