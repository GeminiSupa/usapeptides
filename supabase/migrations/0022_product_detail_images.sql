-- A second product image is used on the product detail page while `image`
-- remains the card/category image. Safe to run after older deployments.
alter table public.products add column if not exists detail_image text;
