import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { featureUnavailable } from '@/lib/env';
import { ok, created, badRequest, serverError, readJson, isNonEmpty, clip } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** GET /api/reviews?product=<slug> - approved reviews only. */
export async function GET(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const slug = new URL(req.url).searchParams.get('product');
  if (!isNonEmpty(slug)) return badRequest('A "product" slug is required.');

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('product_reviews')
      .select('author_name, institution, rating, body, created_at')
      .eq('product_slug', slug)
      .eq('is_approved', true)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return serverError(error.message);

    const reviews = data ?? [];
    const average =
      reviews.length > 0
        ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
        : null;

    return ok({ reviews, count: reviews.length, average });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}

/**
 * POST /api/reviews - submit a review.
 *
 * Always stored unapproved. Nothing a visitor writes appears on the site until
 * it is moderated, which keeps this endpoint from becoming a spam vector.
 */
export async function POST(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const body = await readJson<Record<string, unknown>>(req);
  if (!body) return badRequest('Request body must be valid JSON.');

  const rating = Math.floor(Number(body.rating));
  const fields: Record<string, string> = {};
  if (!isNonEmpty(body.productSlug)) fields.productSlug = 'Product slug is required.';
  if (!isNonEmpty(body.authorName)) fields.authorName = 'Name is required.';
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    fields.rating = 'Rating must be between 1 and 5.';
  }
  if (Object.keys(fields).length) return badRequest('Review rejected.', fields);

  try {
    const db = getSupabaseAdmin();

    const { data: product } = await db
      .from('products')
      .select('id')
      .eq('slug', clip(body.productSlug, 200))
      .maybeSingle();

    const { error } = await db.from('product_reviews').insert({
      product_id: product?.id ?? null,
      product_slug: clip(body.productSlug, 200),
      author_name: clip(body.authorName, 200),
      institution: clip(body.institution, 200) || null,
      rating,
      body: clip(body.body, 4000) || null,
      is_approved: false,
    });

    if (error) return serverError(error.message);
    return created({ submitted: true, pendingModeration: true });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
