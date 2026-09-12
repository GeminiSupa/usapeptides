-- USA Peptides - fixes and additions to the Users area
--
-- Run in the Supabase SQL editor after 0005_users.sql. Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. BUG FIX: a user with audit history could not be deleted
--
-- 0005 gave admin_audit_log.actor_id a foreign key to admin_users with
-- ON DELETE SET NULL, and also a trigger making the table append-only.
-- Those two cannot both hold: deleting a user makes Postgres UPDATE the log
-- rows to null the actor, the trigger refuses the update, and the delete fails
-- with "The audit log cannot be changed or deleted." Every user who had ever
-- done anything became undeletable.
--
-- The foreign key was the mistake. An audit entry is a record of what happened
-- at a moment in time; it must survive the deletion of the person who did it,
-- and it already stores actor_email alongside the id for exactly that reason.
-- So the column stays and the reference goes.
-- ---------------------------------------------------------------------------

alter table public.admin_audit_log
  drop constraint if exists admin_audit_log_actor_id_fkey;

comment on column public.admin_audit_log.actor_id is
  'admin_users.id at the time of the action. Deliberately NOT a foreign key: '
  'the log is append-only, so an ON DELETE action could never run against it, '
  'and the entry has to outlive the account anyway. actor_email is the durable label.';

-- ---------------------------------------------------------------------------
-- 2. Pay
--
-- Commission was the only money on a person. Most staff are paid a wage as
-- well, and the dashboard had nowhere to record it.
-- ---------------------------------------------------------------------------

alter table public.admin_users add column if not exists base_salary     numeric(12,2);
alter table public.admin_users add column if not exists salary_period   text not null default 'monthly';
alter table public.admin_users add column if not exists salary_currency text not null default 'USD';

do $$ begin
  alter table public.admin_users add constraint admin_users_salary_check
    check (base_salary is null or base_salary >= 0);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.admin_users add constraint admin_users_salary_period_check
    check (salary_period in ('hourly', 'weekly', 'fortnightly', 'monthly', 'annual'));
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 3. Referral attribution
--
-- Nothing currently records which referral link brought an order in, which is
-- why neither an affiliate nor a sub-user can be shown what they have earned.
-- These columns are that plumbing. Adding them now so the storefront can start
-- capturing the code; the earnings screens follow.
-- ---------------------------------------------------------------------------

alter table public.orders add column if not exists referral_code text;
alter table public.orders add column if not exists affiliate_id  uuid references public.affiliates (id) on delete set null;
alter table public.orders add column if not exists referred_by   uuid;

create index if not exists orders_referral_idx on public.orders (upper(referral_code));
create index if not exists orders_affiliate_idx on public.orders (affiliate_id, created_at desc);

comment on column public.orders.referred_by is
  'admin_users.id of the staff member or sub-user credited, when the referral '
  'came from an internal link rather than an affiliate. Not a foreign key so an '
  'order keeps its attribution if the person later leaves.';

-- An affiliate may be given a login of their own to see their own figures.
alter table public.affiliates add column if not exists user_id uuid references auth.users (id) on delete set null;
create index if not exists affiliates_user_idx on public.affiliates (user_id);
