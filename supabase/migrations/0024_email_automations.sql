-- USA Peptide Depot - email automations: drip sequences, plus the sending
-- policy that keeps a brand-new domain out of the spam folder.
-- Run after 0023_customer_retention.sql. Safe to re-run.
--
-- Three parts:
--   1. automations and their ordered steps (the sequence builder)
--   2. enrollments - one row per person moving through a sequence
--   3. a single sending policy row and a per-day counter, so no automation or
--      campaign can burn the domain reputation by sending too much too soon.

/* ------------------------------------------------------- 1. the sequence -- */

create table if not exists public.email_automations (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  description     text,
  -- manual | lead_created | newsletter_signup | order_placed
  -- | customer_created | abandoned_cart
  trigger_type    text not null default 'manual',
  trigger_config  jsonb not null default '{}'::jsonb,
  status          text not null default 'draft',   -- draft | active | paused
  -- Re-entry is off by default: nobody should get the welcome series twice.
  allow_reentry   boolean not null default false,
  -- Stop everything the moment somebody buys, for cart and nurture sequences.
  stop_on_order   boolean not null default true,
  enrolled_count  integer not null default 0,
  completed_count integer not null default 0,
  sent_count      integer not null default 0,
  created_by      uuid references public.admin_users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists email_automations_trigger
  on public.email_automations (trigger_type, status);

-- One card in the vertical builder. Position is the order shown and run.
create table if not exists public.email_automation_steps (
  id              uuid primary key default gen_random_uuid(),
  automation_id   uuid not null references public.email_automations (id) on delete cascade,
  position        integer not null default 0,
  kind            text not null,            -- email | wait | condition | goal
  -- email
  subject         text,
  preview_text    text,
  from_name       text,
  reply_to        text,
  design          jsonb not null default '{}'::jsonb,
  -- wait
  wait_minutes    integer not null default 0,
  -- condition: opened_previous | clicked_previous | has_ordered | not_ordered
  condition_type  text,
  -- what happens when the answer is no: continue | skip_next | exit
  on_fail         text not null default 'continue',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists email_automation_steps_order
  on public.email_automation_steps (automation_id, position);

/* ---------------------------------------------------- 2. the enrollments -- */

create table if not exists public.email_automation_enrollments (
  id               uuid primary key default gen_random_uuid(),
  automation_id    uuid not null references public.email_automations (id) on delete cascade,
  email            text not null,                  -- always stored lower-case
  name             text,
  source           text,                           -- lead | customer | subscriber | manual
  subject_type     text,                           -- lead | order | customer | cart
  subject_id       text,
  -- active | completed | stopped | failed
  status           text not null default 'active',
  current_position integer not null default 0,
  next_run_at      timestamptz not null default now(),
  claimed_at       timestamptz,
  stopped_reason   text,
  enrolled_at      timestamptz not null default now(),
  completed_at     timestamptz
);

-- One pass per person per automation. Re-entry, where the automation allows
-- it, is handled in code by reopening the finished row - never by a second
-- live row, which would send the same person two copies of every step.
create unique index if not exists email_automation_enrollments_once
  on public.email_automation_enrollments (automation_id, email);

create index if not exists email_automation_enrollments_due
  on public.email_automation_enrollments (status, next_run_at);

create index if not exists email_automation_enrollments_email
  on public.email_automation_enrollments (lower(email));

-- One row per email an automation actually sent. Mirrors campaign_recipients
-- so opens and clicks are tracked the same way, with the same signed links.
create table if not exists public.email_automation_sends (
  id              uuid primary key default gen_random_uuid(),
  enrollment_id   uuid not null references public.email_automation_enrollments (id) on delete cascade,
  automation_id   uuid not null references public.email_automations (id) on delete cascade,
  step_id         uuid references public.email_automation_steps (id) on delete set null,
  email           text not null,
  name            text,
  status          text not null default 'sent',    -- sent | failed | skipped
  error           text,
  sent_at         timestamptz not null default now(),
  opened_at       timestamptz,
  open_count      integer not null default 0,
  clicked_at      timestamptz,
  click_count     integer not null default 0,
  unsubscribed_at timestamptz
);

create index if not exists email_automation_sends_enrollment
  on public.email_automation_sends (enrollment_id, sent_at desc);
create index if not exists email_automation_sends_automation
  on public.email_automation_sends (automation_id);

/* ------------------------------------------------- 3. the sending policy -- */

-- Exactly one row. The check constraint on a constant primary key is what
-- makes a second row impossible.
create table if not exists public.email_sending_policy (
  id                 boolean primary key default true,
  warmup_enabled     boolean not null default true,
  warmup_started_on  date,
  -- Set to override the warm-up schedule. Null = follow the schedule.
  daily_cap_override integer,
  max_daily_cap      integer not null default 2000,
  updated_at         timestamptz not null default now(),
  constraint email_sending_policy_single check (id)
);

insert into public.email_sending_policy (id) values (true) on conflict (id) do nothing;

create table if not exists public.email_send_counters (
  day   date primary key,
  sent  integer not null default 0
);

-- Hand out send permits for today, never more than the cap. Returns how many
-- of p_want were granted. Locking the row is the point: two workers asking at
-- the same moment can never both be told yes for the last permit.
create or replace function public.email_reserve_sends(p_cap integer, p_want integer)
returns integer language plpgsql security definer set search_path = public as $$
declare
  used    integer;
  granted integer;
begin
  if p_want is null or p_want <= 0 then return 0; end if;

  insert into public.email_send_counters (day, sent) values (current_date, 0)
    on conflict (day) do nothing;

  select sent into used from public.email_send_counters where day = current_date for update;

  granted := least(p_want, greatest(0, coalesce(p_cap, 0) - coalesce(used, 0)));
  if granted > 0 then
    update public.email_send_counters set sent = used + granted where day = current_date;
  end if;
  return granted;
end $$;

revoke all on function public.email_reserve_sends(integer, integer) from public, anon, authenticated;

-- Give a permit back when the send did not happen after all.
create or replace function public.email_release_sends(p_count integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_count is null or p_count <= 0 then return; end if;
  update public.email_send_counters
    set sent = greatest(0, sent - p_count) where day = current_date;
end $$;

revoke all on function public.email_release_sends(integer) from public, anon, authenticated;

-- How much of today is left. Read-only, for the dashboard.
create or replace function public.email_sends_today()
returns integer language sql security definer set search_path = public as $$
  select coalesce((select sent from public.email_send_counters where day = current_date), 0);
$$;

revoke all on function public.email_sends_today() from public, anon, authenticated;

-- Opens and clicks for automation email, counted without a read-modify-write
-- race, exactly like campaign_track from 0017.
create or replace function public.automation_track(p_send uuid, p_kind text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_kind = 'open' then
    update public.email_automation_sends
      set open_count = open_count + 1, opened_at = coalesce(opened_at, now())
      where id = p_send;
  elsif p_kind = 'click' then
    update public.email_automation_sends
      set click_count = click_count + 1, clicked_at = coalesce(clicked_at, now()),
          -- A click proves it was opened even when images were blocked.
          opened_at = coalesce(opened_at, now()), open_count = greatest(open_count, 1)
      where id = p_send;
  end if;
end $$;

revoke all on function public.automation_track(uuid, text) from public, anon, authenticated;

/* ------------------------------------------------------------ lockdown --- */

-- Server-only, like every other marketing table. No policies are created, so
-- the anon and authenticated keys can read nothing here.
alter table public.email_automations             enable row level security;
alter table public.email_automation_steps        enable row level security;
alter table public.email_automation_enrollments  enable row level security;
alter table public.email_automation_sends        enable row level security;
alter table public.email_sending_policy          enable row level security;
alter table public.email_send_counters           enable row level security;

do $$
begin
  if exists (select 1 from pg_proc where proname = 'touch_updated_at') then
    drop trigger if exists email_automations_touch on public.email_automations;
    create trigger email_automations_touch before update on public.email_automations
      for each row execute function public.touch_updated_at();

    drop trigger if exists email_automation_steps_touch on public.email_automation_steps;
    create trigger email_automation_steps_touch before update on public.email_automation_steps
      for each row execute function public.touch_updated_at();

    drop trigger if exists email_sending_policy_touch on public.email_sending_policy;
    create trigger email_sending_policy_touch before update on public.email_sending_policy
      for each row execute function public.touch_updated_at();
  end if;
end $$;
