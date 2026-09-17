-- USA Peptide Depot - keep orders, customers and CRM leads synchronized
-- Run after 0012_notification_center.sql. Safe to re-run.

create or replace function public.sync_order_contact(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  order_row public.orders%rowtype;
  customer_uuid uuid;
  lead_uuid uuid;
begin
  select * into order_row from public.orders where id = p_order_id;
  if not found or nullif(trim(order_row.email), '') is null then return; end if;

  select id into customer_uuid from public.customer_profiles
  where lower(email) = lower(trim(order_row.email)) limit 1;

  if customer_uuid is null then
    begin
      insert into public.customer_profiles (email, full_name, institution, phone)
      values (lower(trim(order_row.email)), order_row.full_name, order_row.institution, order_row.phone)
      returning id into customer_uuid;
    exception when unique_violation then
      select id into customer_uuid from public.customer_profiles
      where lower(email) = lower(trim(order_row.email)) limit 1;
    end;
  else
    update public.customer_profiles
    set full_name = coalesce(order_row.full_name, full_name),
        institution = coalesce(order_row.institution, institution),
        phone = coalesce(order_row.phone, phone),
        updated_at = now()
    where id = customer_uuid;
  end if;

  if customer_uuid is not null and order_row.customer_id is distinct from customer_uuid then
    update public.orders set customer_id = customer_uuid, updated_at = now()
    where id = order_row.id;
  end if;

  select id into lead_uuid from public.leads
  where lower(email) = lower(trim(order_row.email))
  order by created_at desc limit 1;

  if lead_uuid is null then
    insert into public.leads
      (email, phone, full_name, institution, source, status, owner_id, notes)
    values
      (lower(trim(order_row.email)), order_row.phone, order_row.full_name,
       order_row.institution, 'checkout', 'converted', order_row.referred_by,
       'Converted by order ' || order_row.order_number);
  else
    update public.leads
    set phone = coalesce(order_row.phone, phone),
        full_name = coalesce(order_row.full_name, full_name),
        institution = coalesce(order_row.institution, institution),
        status = 'converted',
        owner_id = coalesce(owner_id, order_row.referred_by),
        updated_at = now()
    where id = lead_uuid;
  end if;
end $$;

create or replace function public.sync_new_order_contact()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.sync_order_contact(new.id);
  return new;
end $$;

drop trigger if exists new_order_contact_sync on public.orders;
create trigger new_order_contact_sync after insert on public.orders
for each row execute function public.sync_new_order_contact();

-- Repair existing orders, including orders placed before this migration.
do $$
declare order_record record;
begin
  for order_record in select id from public.orders order by created_at loop
    perform public.sync_order_contact(order_record.id);
  end loop;
end $$;
