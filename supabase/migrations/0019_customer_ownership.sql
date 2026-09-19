-- USA Peptide Depot - completed orders and durable customer ownership
-- Run after 0018_visitor_analytics.sql. Safe to re-run.

-- "Completed" is the final commercial state: this is when the customer's
-- original sales owner is fixed and commission becomes due.
alter type public.order_status add value if not exists 'completed';

alter table public.orders
  add column if not exists completed_at timestamptz;

alter table public.customer_profiles
  add column if not exists owner_id uuid references public.admin_users (id) on delete set null,
  add column if not exists owner_assigned_at timestamptz,
  add column if not exists owner_source text;

alter table public.visitor_sessions
  add column if not exists customer_id uuid references public.customer_profiles (id) on delete set null;

do $$ begin
  alter table public.customer_profiles
    add constraint customer_profiles_owner_source_check
    check (owner_source is null or owner_source in ('first_completed_order', 'legacy_first_order', 'superadmin'));
exception when duplicate_object then null;
end $$;

create index if not exists customer_profiles_owner_idx
  on public.customer_profiles (owner_id, created_at desc);

create index if not exists visitor_sessions_customer_idx
  on public.visitor_sessions (customer_id, first_seen desc);

-- Preserve the established relationship for existing customers. Older orders
-- pre-date the Completed state, so use their earliest valid assigned order.
with first_orders as (
  select distinct on (lower(email))
    lower(email) as email_key, referred_by, agent_claimed_at, created_at
  from public.orders
  where referred_by is not null
    and status::text not in ('cancelled', 'refunded')
  order by lower(email), created_at asc
)
update public.customer_profiles customer
set owner_id = first_order.referred_by,
    owner_assigned_at = coalesce(first_order.agent_claimed_at, first_order.created_at),
    owner_source = 'legacy_first_order'
from first_orders first_order
where customer.owner_id is null
  and lower(customer.email) = first_order.email_key;

-- The first agent to complete an owned order becomes the customer's durable
-- owner. Later completions cannot silently move the customer; only the
-- confirmed super-admin API can do that.
create or replace function public.lock_customer_owner_on_completion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status::text = 'completed' and (tg_op = 'INSERT' or old.status::text is distinct from 'completed') then
    new.completed_at := coalesce(new.completed_at, now());
  end if;
  return new;
end $$;

drop trigger if exists order_completion_timestamp on public.orders;
create trigger order_completion_timestamp before insert or update of status on public.orders
for each row execute function public.lock_customer_owner_on_completion();

create or replace function public.assign_customer_owner_from_completed_order()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status::text = 'completed' and new.referred_by is not null then
    update public.customer_profiles
    set owner_id = new.referred_by,
        owner_assigned_at = coalesce(new.completed_at, now()),
        owner_source = 'first_completed_order',
        updated_at = now()
    where owner_id is null
      and (id = new.customer_id or lower(email) = lower(new.email));
  end if;
  return new;
end $$;

drop trigger if exists completed_order_customer_owner on public.orders;
drop trigger if exists zz_completed_order_customer_owner on public.orders;
-- "zz" intentionally runs after 0013's new_order_contact_sync on inserts, so
-- a manual order can create the customer profile before ownership is locked.
create trigger zz_completed_order_customer_owner after insert or update of status on public.orders
for each row execute function public.assign_customer_owner_from_completed_order();

-- A confirmed owner correction moves only open work. Historical completed,
-- cancelled and refunded orders keep their original agent and commission.
-- Keeping this in the same transaction as the profile update prevents a
-- partial reassignment if any related write fails.
create or replace function public.sync_customer_owner_to_open_work()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.owner_id is distinct from old.owner_id then
    update public.orders
    set referred_by = new.owner_id,
        agent_source = case when new.owner_id is null then null else 'assigned' end,
        agent_claimed_at = case when new.owner_id is null then null else now() end
    where (customer_id = new.id or lower(email) = lower(new.email))
      and status::text not in ('completed', 'cancelled', 'refunded');

    update public.leads
    set owner_id = new.owner_id
    where lower(email) = lower(new.email);
  end if;
  return new;
end $$;

drop trigger if exists customer_owner_open_work_sync on public.customer_profiles;
create trigger customer_owner_open_work_sync after update of owner_id on public.customer_profiles
for each row execute function public.sync_customer_owner_to_open_work();
