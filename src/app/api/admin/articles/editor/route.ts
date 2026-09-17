import { revalidateTag } from 'next/cache';
import { requireAdmin } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { featureUnavailable } from '@/lib/env';
import { slugify } from '@/lib/adminResources';
import { isOwnMediaUrl } from '@/lib/media';
import { ARTICLES_TAG } from '@/lib/siteContentServer';
import { ok, created, badRequest, notFound, serverError, readJson, clip } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * The blog editor.
 *
 *   GET    /api/admin/articles/editor           every post, drafts included
 *   POST   /api/admin/articles/editor  {...}    create
 *   PATCH  /api/admin/articles/editor  {id,...} update
 *   DELETE /api/admin/articles/editor?id=       delete
 *
 * The SEO fields arrive with 0015_blog_seo.sql. Before it runs the editor
 * still works for the post itself and says the SEO part is waiting.
 */

const BASE = 'id, slug, title, excerpt, content, category, author, image, tags, read_time, is_published, published_at, created_at';
const SEO = 'meta_title, meta_description, keywords, canonical_url, og_image, image_alt, faq, noindex';
const SEO_KEYS = ['meta_title', 'meta_description', 'keywords', 'canonical_url', 'og_image', 'image_alt', 'faq', 'noindex'];

const missingColumn = (e: { code?: string; message?: string } | null) =>
  Boolean(e && (e.code === '42703' || e.code === 'PGRST204' || /column .* does not exist|could not find the .* column/i.test(e.message ?? '')));

const storable = (url: string) => url.startsWith('/') && !url.startsWith('//') ? true : isOwnMediaUrl(url);
const list = (v: unknown) => (Array.isArray(v) ? v : String(v ?? '').split(','))
  .map((t) => String(t).trim()).filter(Boolean).slice(0, 30);

async function authorize(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return { response: unavailable } as const;
  const auth = await requireAdmin(req, { anyPermission: ['articles', 'storefront'] });
  return auth.ok ? ({ auth } as const) : ({ response: auth.response } as const);
}

/** Validate a posted post. `partial` for an edit: absent keys are left alone. */
function clean(body: Record<string, unknown>, partial: boolean) {
  const row: Record<string, unknown> = {};
  const fields: Record<string, string> = {};
  const has = (k: string) => k in body;

  if (!partial || has('title')) {
    const title = clip(body.title, 200);
    if (!title) fields.title = 'Title is required.'; else row.title = title;
  }
  if (!partial || has('slug')) {
    const slug = slugify(clip(body.slug, 120) || clip(body.title, 200));
    if (!slug) fields.slug = 'Web address is required.'; else row.slug = slug;
  }
  for (const [key, max] of [['excerpt', 600], ['category', 120], ['author', 120], ['read_time', 40]] as const) {
    if (!partial || has(key)) row[key] = clip(body[key], max);
  }
  if (!partial || has('content')) row.content = typeof body.content === 'string' ? body.content.slice(0, 100_000) : '';
  if (!partial) {
    if (!row.category) row.category = 'Research';
    if (!row.author) row.author = 'Research team';
    if (!row.read_time) {
      const words = String(row.content ?? '').split(/\s+/).filter(Boolean).length;
      row.read_time = `${Math.max(1, Math.round(words / 220))} min read`;
    }
  }
  if (has('tags') || !partial) row.tags = list(body.tags);

  for (const key of ['image', 'og_image'] as const) {
    if (!has(key) && partial) continue;
    const url = clip(body[key], 1000);
    if (url && !storable(url)) fields[key] = 'Upload the picture with the button.';
    else row[key] = url || null;
  }

  if (has('is_published') || !partial) row.is_published = body.is_published === true;
  if (has('published_at')) {
    const text = clip(body.published_at, 40);
    const d = text ? new Date(text) : null;
    if (text && (!d || Number.isNaN(d.getTime()))) fields.published_at = 'That date cannot be read.';
    else row.published_at = d ? d.toISOString() : null;
  }
  if (row.is_published === true && !row.published_at && !has('published_at')) row.published_at = new Date().toISOString();

  // SEO
  if (has('meta_title')) row.meta_title = clip(body.meta_title, 120) || null;
  if (has('meta_description')) row.meta_description = clip(body.meta_description, 320) || null;
  if (has('keywords')) row.keywords = list(body.keywords);
  if (has('canonical_url')) {
    const url = clip(body.canonical_url, 500);
    if (url && !/^https:\/\//i.test(url)) fields.canonical_url = 'Use a full https:// address, or leave it blank.';
    else row.canonical_url = url || null;
  }
  if (has('image_alt')) row.image_alt = clip(body.image_alt, 300) || null;
  if (has('noindex')) row.noindex = body.noindex === true;
  if (has('faq')) {
    const faq = Array.isArray(body.faq) ? body.faq : [];
    row.faq = faq
      .map((f) => ({ question: clip((f as Record<string, unknown>)?.question, 500), answer: clip((f as Record<string, unknown>)?.answer, 3000) }))
      .filter((f) => f.question && f.answer)
      .slice(0, 30);
  }

  return { row, fields };
}

export async function GET(req: Request) {
  const access = await authorize(req);
  if ('response' in access) return access.response;
  const db = getSupabaseAdmin();
  let result = await db.from('articles').select(`${BASE}, ${SEO}`).order('created_at', { ascending: false });
  let seoReady = true;
  if (missingColumn(result.error)) {
    seoReady = false;
    result = await db.from('articles').select(BASE).order('created_at', { ascending: false }) as typeof result;
  }
  if (result.error) {
    return serverError(/articles|schema cache/i.test(result.error.message) ? 'Run migration 0009_articles.sql, then reload.' : result.error.message);
  }
  return ok({ articles: result.data ?? [], seoReady });
}

async function write(req: Request, mode: 'create' | 'update') {
  const access = await authorize(req);
  if ('response' in access) return access.response;
  const body = await readJson<Record<string, unknown>>(req);
  if (!body) return badRequest('Send the post as JSON.');
  if (mode === 'update' && !body.id) return badRequest('Which post?');

  const { row, fields } = clean(body, mode === 'update');
  if (Object.keys(fields).length) return badRequest('Some fields need fixing.', fields);

  const db = getSupabaseAdmin();
  const run = (values: Record<string, unknown>) => mode === 'create'
    ? db.from('articles').insert(values).select(BASE).single()
    : db.from('articles').update(values).eq('id', String(body.id)).select(BASE).maybeSingle();

  let { data, error } = await run(row);
  let seoSkipped = false;
  if (missingColumn(error)) {
    // 0015 not run yet: save the post and say the SEO part was not kept.
    const base = Object.fromEntries(Object.entries(row).filter(([k]) => !SEO_KEYS.includes(k)));
    seoSkipped = true;
    ({ data, error } = await run(base));
  }
  if (error) {
    if (error.code === '23505') return badRequest('Another post already uses that web address.', { slug: 'Choose a different web address.' });
    return serverError(error.message);
  }
  if (!data) return notFound('That post no longer exists.');

  revalidateTag(ARTICLES_TAG);
  const payload = {
    article: data,
    notice: seoSkipped ? 'Saved, but the SEO fields need migration 0015_blog_seo.sql before they can be stored.' : null,
  };
  return mode === 'create' ? created(payload) : ok(payload);
}

export const POST = (req: Request) => write(req, 'create');
export const PATCH = (req: Request) => write(req, 'update');

export async function DELETE(req: Request) {
  const access = await authorize(req);
  if ('response' in access) return access.response;
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return badRequest('Which post?');
  const { error } = await getSupabaseAdmin().from('articles').delete().eq('id', id);
  if (error) return serverError(error.message);
  revalidateTag(ARTICLES_TAG);
  return ok({ deleted: true, id });
}
