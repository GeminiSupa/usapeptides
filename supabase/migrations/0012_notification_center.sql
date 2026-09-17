-- USA Peptide Depot - operational notification centre
-- Run after 0011_product_categories.sql. Safe to re-run.

create table if not exists public.admin_notification_reads (
  admin_user_id uuid not null references public.admin_users(id) on delete cascade,
  notification_id uuid not null references public.admin_notifications(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (admin_user_id, notification_id)
);
alter table public.admin_notification_reads enable row level security;
revoke all on public.admin_notification_reads from anon, authenticated;

create or replace function public.notify_new_inquiry()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.admin_notifications (kind, title, body, link)
  values ('inquiry', 'New enquiry from ' || coalesce(new.name, new.email, 'customer'), coalesce(new.subject, 'Contact form enquiry'), '/admin?section=inquiries');
  return new;
end $$;
drop trigger if exists new_inquiry_notification on public.customer_inquiries;
create trigger new_inquiry_notification after insert on public.customer_inquiries
for each row execute function public.notify_new_inquiry();

create or replace function public.notify_new_review()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.admin_notifications (kind, title, body, link)
  values ('review', 'Review awaiting approval', coalesce(new.author_name, 'Customer') || ' · ' || coalesce(new.product_slug, 'Product'), '/admin?section=reviews');
  return new;
end $$;
drop trigger if exists new_review_notification on public.product_reviews;
create trigger new_review_notification after insert on public.product_reviews
for each row when (new.is_approved = false) execute function public.notify_new_review();

create or replace function public.notify_low_stock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.stock_count < 5 and old.stock_count >= 5 then
    insert into public.admin_notifications (kind, title, body, link)
    values ('stock', 'Low stock: ' || new.name, new.stock_count || ' unit(s) remaining', '/admin?section=products');
  end if;
  return new;
end $$;
drop trigger if exists product_low_stock_notification on public.products;
create trigger product_low_stock_notification after update of stock_count on public.products
for each row execute function public.notify_low_stock();
