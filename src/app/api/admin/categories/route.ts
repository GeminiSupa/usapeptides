import { requireAdmin } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { featureUnavailable } from '@/lib/env';
import { slugify } from '@/lib/adminResources';
import { writeAudit } from '@/lib/audit';
import { ok, created, badRequest, notFound, serverError, readJson, clip } from '@/lib/api';

export const dynamic = 'force-dynamic';
const SELECT = 'id,name,slug,description,sort_order,is_active,created_at';

async function authorize(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return { response: unavailable } as const;
  const auth = await requireAdmin(req, { permission: 'categories' });
  return auth.ok ? { auth } as const : { response: auth.response } as const;
}

export async function GET(req: Request) {
  const access = await authorize(req); if ('response' in access) return access.response;
  const db = getSupabaseAdmin();
  const { data, error } = await db.from('product_categories').select(SELECT).order('sort_order').order('name');
  if (error) return serverError(/product_categories|schema cache/i.test(error.message) ? 'Run migration 0011_product_categories.sql, then reload.' : error.message);
  const { data: products } = await db.from('products').select('category');
  const counts: Record<string, number> = {};
  for (const product of products ?? []) counts[product.category] = (counts[product.category] ?? 0) + 1;
  return ok({ categories: (data ?? []).map((category) => ({ ...category, product_count: counts[category.name] ?? 0 })) });
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
  const body = await readJson<Record<string, unknown> & { id?: string }>(req); if (!body?.id) return badRequest('Category id is required.');
  const db = getSupabaseAdmin(); const { data: old } = await db.from('product_categories').select(SELECT).eq('id', body.id).maybeSingle();
  if (!old) return notFound('Category not found.');
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
  const { count } = await db.from('products').select('id', { head: true, count: 'exact' }).eq('category', category.name);
  if (count) return badRequest(`Move or delete the ${count} product(s) in this category first.`);
  const { error } = await db.from('product_categories').delete().eq('id', id); if (error) return serverError(error.message);
  await writeAudit(access.auth.admin, { action: 'category.delete', targetType: 'product_category', targetId: id, targetLabel: category.name });
  return ok({ deleted: true });
}
