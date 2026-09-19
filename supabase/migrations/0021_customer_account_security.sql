-- Customer self-service account hardening.
-- Run after 0020_product_category_assignments.sql.

-- Customer profile changes go through authenticated server routes. The old
-- broad UPDATE policy also allowed a customer to alter ownership/commission
-- fields that were added to this table later.
drop policy if exists "own profile updatable" on public.customer_profiles;
revoke update on table public.customer_profiles from authenticated;

-- Durable, privacy-safe throttling for public signup and recovery requests.
-- Only keyed SHA-256 identifiers are stored; raw email addresses and IPs are not.
create table if not exists public.customer_auth_rate_limits (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  identifier_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists customer_auth_rate_limits_lookup_idx
  on public.customer_auth_rate_limits (scope, identifier_hash, created_at desc);

alter table public.customer_auth_rate_limits enable row level security;
revoke all on table public.customer_auth_rate_limits from anon, authenticated;

create or replace function public.customer_auth_rate_limit(
  p_scope text,
  p_identifier_hash text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count integer;
begin
  if p_scope is null or p_identifier_hash is null
     or p_limit < 1 or p_window_seconds < 1 then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_scope || ':' || p_identifier_hash, 0));

  select count(*) into recent_count
  from public.customer_auth_rate_limits
  where scope = p_scope
    and identifier_hash = p_identifier_hash
    and created_at >= now() - make_interval(secs => p_window_seconds);

  if recent_count >= p_limit then
    return false;
  end if;

  insert into public.customer_auth_rate_limits (scope, identifier_hash)
  values (p_scope, p_identifier_hash);

  -- Keep the table bounded without a separate scheduled job.
  if random() < 0.02 then
    delete from public.customer_auth_rate_limits
    where created_at < now() - interval '1 day';
  end if;

  return true;
end;
$$;

revoke all on function public.customer_auth_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.customer_auth_rate_limit(text, text, integer, integer) to service_role;
