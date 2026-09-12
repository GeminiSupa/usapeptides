import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { featureUnavailable } from '@/lib/env';
import { ok, serverError } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/summary - headline figures for the dashboard home.
 *
 * Note: "summary" is also a key in the [resource] whitelist namespace, but
 * this static segment takes precedence over the dynamic one in Next.js
 * routing, so it is reached first.
 */
export async function GET(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const db = getSupabaseAdmin();
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();

    const countOf = async (table: string, build?: (q: any) => any) => {
      let q = db.from(table).select('id', { count: 'exact', head: true });
      if (build) q = build(q);
      const { count } = await q;
      return count ?? 0;
    };

    const [
      orders30,
      pendingOrders,
      openInquiries,
      pendingReviews,
      subscribers,
      activeCarts,
      products,
      lowStock,
      leadsOpen,
      unreadNotifications,
    ] = await Promise.all([
      countOf('orders', (q) => q.gte('created_at', since)),
      countOf('orders', (q) => q.eq('status', 'pending')),
      countOf('customer_inquiries', (q) => q.eq('status', 'new')),
      countOf('product_reviews', (q) => q.eq('is_approved', false)),
      countOf('newsletter_subscribers', (q) => q.eq('is_subscribed', true)),
      countOf('abandoned_carts', (q) => q.eq('recovered', false)),
      countOf('products', (q) => q.eq('is_active', true)),
      countOf('products', (q) => q.lt('stock_count', 5).eq('is_active', true)),
      countOf('leads', (q) => q.in('status', ['new', 'working'])),
      countOf('admin_notifications', (q) => q.eq('is_read', false)),
    ]);

    // Revenue over the same window, excluding orders that never completed.
    const { data: revenueRows, error: revenueError } = await db
      .from('orders')
      .select('grand_total, status, created_at')
      .gte('created_at', since)
      .not('status', 'in', '("cancelled","refunded")');

    if (revenueError) return serverError(revenueError.message);

    const revenue30 = (revenueRows ?? []).reduce(
      (sum, r) => sum + Number(r.grand_total ?? 0),
      0
    );

    const { data: recentOrders } = await db
      .from('orders')
      .select('order_number, email, status, grand_total, created_at')
      .order('created_at', { ascending: false })
      .limit(8);

    return ok({
      metrics: {
        revenue30: Math.round(revenue30 * 100) / 100,
        orders30,
        pendingOrders,
        openInquiries,
        pendingReviews,
        subscribers,
        activeCarts,
        products,
        lowStock,
        leadsOpen,
        unreadNotifications,
      },
      recentOrders: recentOrders ?? [],
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
