import { requireAdmin } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { featureUnavailable } from '@/lib/env';
import { slugify } from '@/lib/adminResources';
import { writeAudit } from '@/lib/audit';
import { ok, created, badRequest, notFound, serverError, readJson, clip } from '@/lib/api';

export const dynamic = 'force-dynamic';
const SELECT = 'id,name,slug,description,sort_order,is_active,created_at';
const ASSIGNMENT_SETUP = 'Product category assignment needs supabase/migrations/0020_product_category_assignments.sql to be run in Supabase first.';

async function authorize(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return { response: unavailable } as const;
  const auth = await requireAdmin(req, { permission: 'categories' });
  return auth.ok ? { auth } as const : { response: auth.response } as const;
}

export async function GET(req: Request) {
  const access = await authorize(req); if ('response' in access) return access.response;
  const db = getSupabaseAdmin();
  const [{ data: categories, error }, { data: products, error: productError }] = await Promise.all([
    db.from('product_categories').select(SELECT).order('sort_order').order('name'),
    db.from('products').select('id,name,sku,image,category,category_slug,is_active').order('name'),
  ]);
  if (error) return serverError(/product_categories|schema cache/i.test(error.message) ? 'Run migration 0011_product_categories.sql, then reload.' : error.message);
  if (productError) return serverError(productError.message);

  const assignmentResult = await db.from('product_category_assignments').select('product_id,category_id,is_primary');
  const assignmentsReady = !assignmentResult.error;
  const assignments = assignmentsReady
    ? assignmentResult.data ?? []
    : (products ?? []).map((product) => ({
        product_id: product.id,
        category_id: (categories ?? []).find((category) => category.slug === product.category_slug || category.name === product.category)?.id,
        is_primary: true,
      })).filter((row) => row.category_id);

  const categoryProducts = new Map<string, string[]>();
  const productCategories = new Map<string, string[]>();
  for (const row of assignments) {
    const byCategory = categoryProducts.get(String(row.category_id)) ?? [];
    byCategory.push(String(row.product_id)); categoryProducts.set(String(row.category_id), byCategory);
    const byProduct = productCategories.get(String(row.product_id)) ?? [];
    byProduct.push(String(row.category_id)); productCategories.set(String(row.product_id), byProduct);
  }

  return ok({
    assignmentsReady,
    categories: (categories ?? []).map((category) => ({
      ...category,
      product_ids: categoryProducts.get(category.id) ?? [],
      product_count: (categoryProducts.get(category.id) ?? []).length,
    })),
    products: (products ?? []).map((product) => ({ ...product, category_ids: productCategories.get(product.id) ?? [] })),
  });
}

export async function POST(req: Request) {
  const access = await authorize(req); if ('response' in access) return access.response;
  const body = await readJson<Record<string, unknown>>(req);
  const name = clip(body?.name, 120); const slug = slugify(clip(body?.slug, 120) || name);
  if (!name || !slug) return badRequest('Name is required.');
  const db = getSupabaseAdmin();
  const { data, error } = await db.from('product_categories').insert({ name, slug, description: clip(body?.description, 1000), sort_order: Number(body?.sort_order) || 0, is_active: body?.is_active !== false }).select(SELECT).single();
  if (error) return error.code === '23505' ? badRequest('A category with that name or web address already exists.') : serverError(error.message);
  await writeAudit(access.auth.admin, { action: 'category.create', targetType: 'product_category', targetId: data.id, targetLabel: name });
  return created({ category: data });
}

export async function PATCH(req: Request) {
  const access = await authorize(req); if ('response' in access) return access.response;
  const body = await readJson<Record<string, unknown> & { id?: string; product_ids?: unknown[]; assign_products?: boolean; allow_multiple?: boolean }>(req);
  if (!body?.id) return badRequest('Category id is required.');
  const db = getSupabaseAdmin();
  const { data: old } = await db.from('product_categories').select(SELECT).eq('id', body.id).maybeSingle();
  if (!old) return notFound('Category not found.');

  if (body.assign_products) {
    const requested = Array.from(new Set((Array.isArray(body.product_ids) ? body.product_ids : []).map(String))).slice(0, 5000);
    const { data: products, error: productsError } = await db.from('products').select('id,name,category_slug').in('id', requested.length ? requested : ['00000000-0000-0000-0000-000000000000']);
    if (productsError) return serverError(productsError.message);
    if ((products ?? []).length !== requested.length) return badRequest('One or more selected products no longer exist. Reload and try again.');

    const existing = requested.length
      ? await db.from('product_category_assignments').select('product_id,category_id,is_primary').in('product_id', requested)
      : await db.from('product_category_assignments').select('product_id,category_id,is_primary').eq('category_id', body.id);
    if (existing.error) return serverError(/product_category_assignments|schema cache/i.test(existing.error.message) ? ASSIGNMENT_SETUP : existing.error.message);

    const currentTarget = await db.from('product_category_assignments').select('product_id,is_primary').eq('category_id', body.id);
    if (currentTarget.error) return serverError(/product_category_assignments|schema cache/i.test(currentTarget.error.message) ? ASSIGNMENT_SETUP : currentTarget.error.message);
    const alreadyHere = new Set((currentTarget.data ?? []).map((row) => row.product_id));

    const otherRows = (existing.data ?? []).filter((row) => row.category_id !== body.id && !alreadyHere.has(row.product_id));
    const otherCategoryIds = Array.from(new Set(otherRows.map((row) => row.category_id)));
    const { data: otherCategories } = otherCategoryIds.length
      ? await db.from('product_categories').select('id,name').in('id', otherCategoryIds)
      : { data: [] as { id: string; name: string }[] };
    const names = new Map((otherCategories ?? []).map((category) => [category.id, category.name]));
    const productNames = new Map((products ?? []).map((product) => [product.id, product.name]));
    const conflicts = otherRows.map((row) => ({
      product_id: row.product_id,
      product_name: productNames.get(row.product_id) ?? 'Product',
      category_id: row.category_id,
      category_name: names.get(row.category_id) ?? 'another category',
    }));
    if (conflicts.length && body.allow_multiple !== true) {
      return Response.json({ error: 'multiple_categories', message: 'Some selected products already belong to another category.', conflicts }, { status: 409 });
    }

    const requestedSet = new Set(requested);
    const removable = (currentTarget.data ?? []).filter((row) => !row.is_primary && !requestedSet.has(row.product_id)).map((row) => row.product_id);
    if (removable.length) {
      const removed = await db.from('product_category_assignments').delete().eq('category_id', body.id).in('product_id', removable).eq('is_primary', false);
      if (removed.error) return serverError(removed.error.message);
    }
    if (requested.length) {
      const primary = new Set((products ?? []).filter((product) => product.category_slug === old.slug).map((product) => product.id));
      const added = await db.from('product_category_assignments').upsert(
        requested.map((productId) => ({ product_id: productId, category_id: body.id, is_primary: primary.has(productId) })),
        { onConflict: 'product_id,category_id', ignoreDuplicates: true }
      );
      if (added.error) return serverError(/product_category_assignments|schema cache/i.test(added.error.message) ? ASSIGNMENT_SETUP : added.error.message);
    }
    await writeAudit(access.auth.admin, { action: 'category.update', targetType: 'product_category', targetId: old.id, targetLabel: old.name, detail: { product_count: requested.length, allowed_multiple: body.allow_multiple === true } });
    return ok({ saved: true, product_count: requested.length });
  }

  const changes: Record<string, unknown> = {};
  if (body.name !== undefined) { changes.name = clip(body.name, 120); if (!changes.name) return badRequest('Name cannot be empty.'); }
  if (body.slug !== undefined) changes.slug = slugify(clip(body.slug, 120));
  if (body.description !== undefined) changes.description = clip(body.description, 1000);
  if (body.sort_order !== undefined) changes.sort_order = Number(body.sort_order) || 0;
  if (body.is_active !== undefined) changes.is_active = Boolean(body.is_active);
  const { data, error } = await db.from('product_categories').update(changes).eq('id', body.id).select(SELECT).single();
  if (error) return error.code === '23505' ? badRequest('That name or web address is already in use.') : serverError(error.message);
  if ((changes.name && changes.name !== old.name) || (changes.slug && changes.slug !== old.slug)) {
    const moved = await db.from('products').update({ category: changes.name ?? old.name, category_slug: changes.slug ?? old.slug }).eq('category', old.name);
    if (moved.error) return serverError(`Category changed but its products could not be moved: ${moved.error.message}`);
  }
  await writeAudit(access.auth.admin, { action: 'category.update', targetType: 'product_category', targetId: body.id, targetLabel: data.name });
  return ok({ category: data });
}

export async function DELETE(req: Request) {
  const access = await authorize(req); if ('response' in access) return access.response;
  const id = new URL(req.url).searchParams.get('id'); if (!id) return badRequest('Category id is required.');
  const db = getSupabaseAdmin(); const { data: category } = await db.from('product_categories').select('id,name').eq('id', id).maybeSingle();
  if (!category) return notFound('Category not found.');
  const assigned = await db.from('product_category_assignments').select('product_id', { head: true, count: 'exact' }).eq('category_id', id);
  const legacy = assigned.error ? await db.from('products').select('id', { head: true, count: 'exact' }).eq('category', category.name) : null;
  const count = assigned.error ? legacy?.count : assigned.count;
  if (count) return badRequest(`Move or remove the ${count} product(s) in this category first.`);
  const { error } = await db.from('product_categories').delete().eq('id', id); if (error) return serverError(error.message);
  await writeAudit(access.auth.admin, { action: 'category.delete', targetType: 'product_category', targetId: id, targetLabel: category.name });
  return ok({ deleted: true });
}
