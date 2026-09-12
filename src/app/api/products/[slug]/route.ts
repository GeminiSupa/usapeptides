import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { featureUnavailable } from '@/lib/env';
import { ok, notFound, serverError } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** GET /api/products/<slug> - one product plus its approved reviews. */
export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  try {
    const db = getSupabaseAdmin();

    const { data: product, error } = await db
      .from('products')
      .select('*')
      .eq('slug', params.slug)
      .eq('is_active', true)
      .maybeSingle();

    if (error) return serverError(error.message);
    if (!product) return notFound(`No product with slug "${params.slug}"`);

    const { data: reviews } = await db
      .from('product_reviews')
      .select('author_name, institution, rating, body, created_at')
      .eq('product_slug', params.slug)
      .eq('is_approved', true)
      .order('created_at', { ascending: false })
      .limit(20);

    return ok({ product, reviews: reviews ?? [] });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
