-- USA Peptides - the Users umbrella: team, sub-users, affiliates
--
-- Run this in the Supabase SQL editor after 0004_storefront.sql.
-- Safe to run more than once.
--
-- admin_users was an allow-list of email addresses. It becomes the one identity
-- table for everyone who can sign in to the dashboard, because two tables
-- describing the same person is how an account ends up active in one place and
-- suspended in the other.
--
-- NOTHING here hardcodes a person. The first superadmin is promoted from the
-- allow-list row that already exists, which is why this file works unchanged
-- for the next business that deploys it.

-- ---------------------------------------------------------------------------
-- 1. Identity, tier and permissions
-- ---------------------------------------------------------------------------

alter table public.admin_users add column if not exists user_id    uuid references auth.users (id) on delete set null;
alter table public.admin_users add column if not exists tier       text not null default 'staff';
alter table public.admin_users add column if not exists status     text not null default 'active';
alter table public.admin_users add column if not exists is_superadmin boolean not null default false;
alter table public.admin_users add column if not exists permissions   text[] not null default '{}';

-- Sub-user tier. parent_user_id points at the staff member who owns them.
alter table public.admin_users add column if not exists parent_user_id  uuid references public.admin_users (id) on delete set null;
alter table public.admin_users add column if not exists sub_user_cap    integer not null default 5;
alter table public.admin_users add column if not exists commission_rate numeric(5,2) not null default 0;
alter table public.admin_users add column if not exists override_rate   numeric(5,2) not null default 0;

-- Profile.
alter table public.admin_users add column if not exists full_name  text;
alter table public.admin_users add column if not exists job_title  text;
alter table public.admin_users add column if not exists phone      text;
alter table public.admin_users add column if not exists avatar_url text;

-- Who did what to this account.
alter table public.admin_users add column if not exists invited_by   uuid references public.admin_users (id) on delete set null;
alter table public.admin_users add column if not exists approved_by  uuid references public.admin_users (id) on delete set null;
alter table public.admin_users add column if not exists approved_at  timestamptz;
alter table public.admin_users add column if not exists suspended_at timestamptz;
alter table public.admin_users add column if not exists last_seen_at timestamptz;
alter table public.admin_users add column if not exists updated_at   timestamptz not null default now();

-- Values are checked here and not only in the form, so a crafted request that
-- skips the UI still cannot write a tier or status the code does not handle.
do $$ begin
  alter table public.admin_users add constraint admin_users_tier_check
    check (tier in ('staff', 'sub_user'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.admin_users add constraint admin_users_status_check
    check (status in ('pending', 'active', 'suspended'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.admin_users add constraint admin_users_rates_check
    check (
      commission_rate >= 0 and commission_rate <= 100
      and override_rate >= 0 and override_rate <= 100
    );
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.admin_users add constraint admin_users_cap_check
    check (sub_user_cap >= 0 and sub_user_cap <= 200);
exception when duplicate_object then null; end $$;

-- A superadmin is staff by definition; the combination is refused rather than
-- left to the API alone.
do $$ begin
  alter table public.admin_users add constraint admin_users_superadmin_is_staff
    check (not (is_superadmin and tier = 'sub_user'));
exception when duplicate_object then null; end $$;

create index if not exists admin_users_user_id_idx on public.admin_users (user_id);
create index if not exists admin_users_parent_idx  on public.admin_users (parent_user_id);
create index if not exists admin_users_tier_idx    on public.admin_users (tier, status);

-- ---------------------------------------------------------------------------
-- 2. is_active follows status
--
-- is_active predates this file and older code still reads it. Rather than keep
-- two flags that can disagree, status is authoritative and a trigger keeps
-- is_active in step.
-- ---------------------------------------------------------------------------

create or replace function public.admin_users_sync_active()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.is_active := (new.status = 'active');
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists admin_users_sync_active on public.admin_users;
create trigger admin_users_sync_active
  before insert or update on public.admin_users
  for each row execute function public.admin_users_sync_active();

-- Bring existing rows into line with the flag they already carry.
update public.admin_users
   set status = case when is_active then 'active' else 'suspended' end
 where status is null or (is_active and status <> 'active') or (not is_active and status = 'active');

-- ---------------------------------------------------------------------------
-- 3. The two-level cap
--
-- Staff -> sub-user, and no further. Enforced here as well as in the API,
-- because the cost of getting this wrong is commission paid on commission.
-- ---------------------------------------------------------------------------

create or replace function public.admin_users_enforce_depth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_tier text;
  child_count integer;
begin
  if new.parent_user_id is not null then
    if new.parent_user_id = new.id then
      raise exception 'A user cannot be their own supervisor.';
    end if;

    select tier into parent_tier from public.admin_users where id = new.parent_user_id;

    if parent_tier is null then
      raise exception 'That supervisor does not exist.';
    end if;

    if parent_tier = 'sub_user' then
      raise exception 'A sub-user cannot supervise other sub-users. Only two levels are allowed.';
    end if;
  end if;

  -- The other direction: turning somebody who already has sub-users into a
  -- sub-user would push their people down to a third level.
  if new.tier = 'sub_user' then
    select count(*) into child_count
      from public.admin_users
     where parent_user_id = new.id and id <> new.id;

    if child_count > 0 then
      raise exception 'That person supervises % sub-user(s), so they cannot become a sub-user.', child_count;
    end if;
  end if;

  return new;
end $$;

drop trigger if exists admin_users_enforce_depth on public.admin_users;
create trigger admin_users_enforce_depth
  before insert or update on public.admin_users
  for each row execute function public.admin_users_enforce_depth();

-- ---------------------------------------------------------------------------
-- 4. The last superadmin cannot be removed
--
-- Losing the only superadmin means nobody can grant permissions again, and the
-- only fix is a visit to this SQL editor. Blocked in the database so it holds
-- even for a direct write.
-- ---------------------------------------------------------------------------

create or replace function public.admin_users_protect_last_superadmin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining integer;
begin
  if tg_op = 'DELETE' then
    if not (old.is_superadmin and old.status = 'active') then return old; end if;
  else
    -- Only care when this row is ceasing to be an active superadmin.
    if old.is_superadmin and old.status = 'active'
       and (new.is_superadmin is false or new.status <> 'active') then
      null;
    else
      return new;
    end if;
  end if;

  select count(*) into remaining
    from public.admin_users
   where is_superadmin and status = 'active' and id <> old.id;

  if remaining = 0 then
    raise exception 'This is the only active owner. Make somebody else an owner first.';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists admin_users_protect_last_superadmin on public.admin_users;
create trigger admin_users_protect_last_superadmin
  before update or delete on public.admin_users
  for each row execute function public.admin_users_protect_last_superadmin();

-- ---------------------------------------------------------------------------
-- 5. Bootstrap the first owner
--
-- Promotes the existing allow-list to owners, but ONLY when no owner exists
-- yet, so re-running this never re-promotes somebody who was deliberately
-- demoted. No address appears anywhere in this file or in the application code.
-- ---------------------------------------------------------------------------

do $$
declare
  owners integer;
  candidates integer;
begin
  select count(*) into owners from public.admin_users where is_superadmin;
  if owners > 0 then
    raise notice 'Owner already set. Leaving roles alone.';
    return;
  end if;

  select count(*) into candidates from public.admin_users where status = 'active';

  if candidates = 0 then
    raise notice 'No active admin_users row to promote. Add yourself, then re-run this block.';
  else
    update public.admin_users set is_superadmin = true where status = 'active';
    raise notice 'Promoted % existing active admin row(s) to owner.', candidates;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Audit log
--
-- Every privileged action, append-only. Granting a permission or changing a
-- commission rate with no record of who did it is how a dispute becomes
-- unanswerable.
-- ---------------------------------------------------------------------------

create table if not exists public.admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.admin_users (id) on delete set null,
  actor_email text,
  action      text not null,
  target_type text,
  target_id   text,
  target_label text,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists audit_created_idx on public.admin_audit_log (created_at desc);
create index if not exists audit_actor_idx   on public.admin_audit_log (actor_id, created_at desc);

alter table public.admin_audit_log enable row level security;
-- No policy: readable and writable only through the service role.

-- Append-only. An audit trail somebody can edit is not an audit trail.
create or replace function public.admin_audit_log_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'The audit log cannot be changed or deleted.';
end $$;

drop trigger if exists admin_audit_log_immutable on public.admin_audit_log;
create trigger admin_audit_log_immutable
  before update or delete on public.admin_audit_log
  for each row execute function public.admin_audit_log_immutable();

-- ---------------------------------------------------------------------------
-- 7. Affiliates
-- ---------------------------------------------------------------------------

alter table public.affiliates add column if not exists phone         text;
alter table public.affiliates add column if not exists company       text;
alter table public.affiliates add column if not exists payout_method text;
alter table public.affiliates add column if not exists payout_detail text;
alter table public.affiliates add column if not exists notes         text;
alter table public.affiliates add column if not exists managed_by    uuid references public.admin_users (id) on delete set null;
alter table public.affiliates add column if not exists updated_at    timestamptz not null default now();

do $$ begin
  alter table public.affiliates add constraint affiliates_rate_check
    check (commission_rate >= 0 and commission_rate <= 100);
exception when duplicate_object then null; end $$;

-- Referral codes are compared case-insensitively everywhere, so uniqueness has
-- to be too: without this, ABC123 and abc123 are two affiliates claiming the
-- same link.
drop index if exists affiliates_code_idx;
create unique index if not exists affiliates_code_lower_idx
  on public.affiliates (upper(referral_code));

alter table public.affiliate_commissions add column if not exists approved_by uuid references public.admin_users (id) on delete set null;
alter table public.affiliate_commissions add column if not exists approved_at timestamptz;
alter table public.affiliate_commissions add column if not exists settled_by  uuid references public.admin_users (id) on delete set null;
alter table public.affiliate_commissions add column if not exists reference   text;
alter table public.affiliate_commissions add column if not exists notes       text;

do $$ begin
  alter table public.affiliate_commissions add constraint commissions_amount_check
    check (amount >= 0);
exception when duplicate_object then null; end $$;

drop trigger if exists affiliates_touch on public.affiliates;
create trigger affiliates_touch before update on public.affiliates
  for each row execute function public.touch_updated_at();
