-- USA Peptide Depot - reliable order, inventory and fulfilment lifecycle
-- Run after 0009_articles.sql. Safe to re-run.

alter table public.orders add column if not exists inventory_released boolean not null default false;

create or replace function public.apply_order_item_inventory()
returns trigger language plpgsql security definer set search_path = public as $$
declare available integer;
begin
  select stock_count into available from public.products where id = new.product_id for update;
  if available is null then raise exception 'Product no longer exists'; end if;
  if available < new.quantity then raise exception 'Insufficient stock for %', new.product_name; end if;
  update public.products
     set stock_count = stock_count - new.quantity,
         in_stock = (stock_count - new.quantity) > 0,
         updated_at = now()
   where id = new.product_id;
  return new;
end $$;

drop trigger if exists order_item_inventory_insert on public.order_items;
create trigger order_item_inventory_insert after insert on public.order_items
for each row execute function public.apply_order_item_inventory();

create or replace function public.sync_order_operations()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('paid','processing') then
    insert into public.fulfillment_queue (order_id, stage)
    values (new.id, 'queued') on conflict (order_id) do nothing;
  end if;

  if new.status in ('cancelled','refunded') and old.status not in ('cancelled','refunded') and not new.inventory_released then
    update public.products p
       set stock_count = p.stock_count + i.quantity,
           in_stock = true,
           updated_at = now()
      from (
        select product_id, sum(quantity)::integer as quantity
        from public.order_items where order_id = new.id group by product_id
      ) i where i.product_id = p.id;
    new.inventory_released := true;
  elsif new.status not in ('cancelled','refunded') and old.status in ('cancelled','refunded') and new.inventory_released then
    if exists (
      select 1 from (
        select product_id, sum(quantity)::integer as quantity
        from public.order_items where order_id = new.id group by product_id
      ) i join public.products p on p.id = i.product_id where p.stock_count < i.quantity
    ) then raise exception 'Cannot reopen order: insufficient stock'; end if;
    update public.products p
       set stock_count = p.stock_count - i.quantity,
           in_stock = (p.stock_count - i.quantity) > 0,
           updated_at = now()
      from (
        select product_id, sum(quantity)::integer as quantity
        from public.order_items where order_id = new.id group by product_id
      ) i where i.product_id = p.id;
    new.inventory_released := false;
  end if;
  return new;
end $$;

drop trigger if exists order_operations_update on public.orders;
create trigger order_operations_update before update of status on public.orders
for each row execute function public.sync_order_operations();

create or replace function public.start_fulfillment_for_new_order()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('paid','processing') then
    insert into public.fulfillment_queue (order_id, stage)
    values (new.id, 'queued') on conflict (order_id) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists new_order_fulfillment on public.orders;
create trigger new_order_fulfillment after insert on public.orders
for each row execute function public.start_fulfillment_for_new_order();

create or replace function public.stamp_fulfillment_stage()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if new.stage = 'picking' and old.stage is distinct from new.stage then new.picked_at := now(); end if;
  if new.stage = 'packed' and old.stage is distinct from new.stage then new.packed_at := now(); end if;
  if new.stage = 'dispatched' and old.stage is distinct from new.stage then new.dispatched_at := now(); end if;
  return new;
end $$;

drop trigger if exists fulfillment_stage_stamp on public.fulfillment_queue;
create trigger fulfillment_stage_stamp before update of stage on public.fulfillment_queue
for each row execute function public.stamp_fulfillment_stage();

create or replace function public.notify_new_order()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.admin_notifications (kind, title, body, link)
  values ('order', 'New order ' || new.order_number, coalesce(new.full_name, new.email) || ' · $' || new.grand_total, '/admin?section=orders');
  return new;
end $$;

drop trigger if exists new_order_notification on public.orders;
create trigger new_order_notification after insert on public.orders
for each row execute function public.notify_new_order();
