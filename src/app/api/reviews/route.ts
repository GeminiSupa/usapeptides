import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { featureUnavailable } from '@/lib/env';
import { ok, created, badRequest, serverError, readJson, isNonEmpty, clip } from '@/lib/api';
import { cleanMultiline, cleanText, isPersonName } from '@/lib/validate';

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
  const productSlug = cleanText(body.productSlug, 200);
  const authorName = cleanText(body.authorName, 200);
  const reviewBody = cleanMultiline(body.body, 4000);

  const fields: Record<string, string> = {};
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(productSlug)) fields.productSlug = 'Product slug is required.';
  if (!isPersonName(authorName)) fields.authorName = 'Enter your name.';
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    fields.rating = 'Rating must be between 1 and 5.';
  }
  // Optional, but a one-word review is not worth moderating.
  if (reviewBody && reviewBody.length < 10) fields.body = 'Write at least 10 characters, or leave the review text blank.';
  if (Object.keys(fields).length) return badRequest('Review rejected.', fields);

  try {
    const db = getSupabaseAdmin();

    const { data: product } = await db
      .from('products')
      .select('id')
      .eq('slug', productSlug)
      .maybeSingle();

    // Reviews must hang off a real product, or the moderation queue fills with
    // rows for slugs that do not exist.
    if (!product) return badRequest('Review rejected.', { productSlug: 'Unknown product.' });

    const { error } = await db.from('product_reviews').insert({
      product_id: product.id,
      product_slug: productSlug,
      author_name: authorName,
      institution: cleanText(body.institution, 200) || null,
      rating,
      body: reviewBody || null,
      is_approved: false,
    });

    if (error) return serverError(error.message);
    return created({ submitted: true, pendingModeration: true });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
