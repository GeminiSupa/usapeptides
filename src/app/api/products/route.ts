import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { featureUnavailable } from '@/lib/env';
import { ok, serverError } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * GET /api/products
 *   ?category=<category_slug>  filter by pathway
 *   ?featured=true             only featured/popular
 *   ?q=<text>                  name search
 *   ?limit=<n>                 default 100, max 200
 */
export async function GET(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const url = new URL(req.url);
  const category = url.searchParams.get('category');
  const featured = url.searchParams.get('featured');
  const q = url.searchParams.get('q');
  const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 200);

  try {
    let query = getSupabaseAdmin()
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('is_featured', { ascending: false })
      .order('name', { ascending: true })
      .limit(limit);

    if (category) query = query.eq('category_slug', category);
    if (featured === 'true') query = query.or('is_featured.eq.true,is_popular.eq.true');
    if (q && q.trim()) query = query.ilike('name', `%${q.trim()}%`);

    const { data, error } = await query;
    if (error) return serverError(error.message);

    return ok({ products: data ?? [], count: data?.length ?? 0 });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
