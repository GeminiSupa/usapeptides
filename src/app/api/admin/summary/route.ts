import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { featureUnavailable } from '@/lib/env';
import { canAccess, isSalesAgent } from '@/lib/permissions';
import { ok, serverError } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/summary - headline figures for the dashboard home.
 *
 * Each figure belongs to a section, and is only computed for somebody who may
 * open that section. Somebody granted Leads sees the open-leads count and
 * nothing about revenue or customers. Figures the person may not see are left
 * out of the response entirely rather than sent as zero.
 *
 * A sales agent's figures are their own: their orders, their revenue, their
 * leads, plus how many orders are waiting to be claimed.
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

  const may = (section: string) => canAccess(section, auth.admin.profile);
  const agentId = isSalesAgent(auth.admin.profile) ? auth.admin.id : null;

  try {
    const db = getSupabaseAdmin();
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();

    const countOf = async (table: string, build?: (q: any) => any) => {
      let q = db.from(table).select('id', { count: 'exact', head: true });
      if (build) q = build(q);
      const { count } = await q;
      return count ?? 0;
    };

    /** An agent's orders only; everybody else sees the whole business. */
    const mineOrders = (q: any) => (agentId ? q.eq('referred_by', agentId) : q);

    const jobs: Record<string, () => Promise<number>> = {};

    if (may('orders')) {
      jobs.orders30 = () => countOf('orders', (q) => mineOrders(q.gte('created_at', since)));
      jobs.pendingOrders = () => countOf('orders', (q) => mineOrders(q.eq('status', 'pending')));
      if (agentId) jobs.unclaimedOrders = () => countOf('orders', (q) => q.is('referred_by', null));
    }
    if (!agentId) {
      if (may('inquiries')) jobs.openInquiries = () => countOf('customer_inquiries', (q) => q.eq('status', 'new'));
      if (may('reviews')) jobs.pendingReviews = () => countOf('product_reviews', (q) => q.eq('is_approved', false));
      if (may('subscribers')) jobs.subscribers = () => countOf('newsletter_subscribers', (q) => q.eq('is_subscribed', true));
      if (may('carts')) jobs.activeCarts = () => countOf('abandoned_carts', (q) => q.eq('recovered', false));
      if (may('products')) {
        jobs.products = () => countOf('products', (q) => q.eq('is_active', true));
        jobs.lowStock = () => countOf('products', (q) => q.lt('stock_count', 5).eq('is_active', true));
      }
      if (may('notifications')) jobs.unreadNotifications = () => countOf('admin_notifications', (q) => q.eq('is_read', false));
    }
    if (may('leads')) {
      jobs.leadsOpen = () =>
        countOf('leads', (q) => {
          const open = q.in('status', ['new', 'working']);
          return agentId ? open.eq('owner_id', agentId) : open;
        });
    }

    const keys = Object.keys(jobs);
    const values = await Promise.all(keys.map((k) => jobs[k]()));
    const metrics: Record<string, number> = Object.fromEntries(keys.map((k, i) => [k, values[i]]));

    let recentOrders: unknown[] | null = null;

    if (may('orders')) {
      // Revenue over the same window, excluding orders that never completed.
      const { data: revenueRows, error: revenueError } = await mineOrders(
        db
          .from('orders')
          .select('grand_total, status, created_at')
          .gte('created_at', since)
          .not('status', 'in', '("cancelled","refunded")')
      );

      if (revenueError) return serverError(revenueError.message);

      const revenue30 = ((revenueRows ?? []) as { grand_total?: number }[]).reduce(
        (sum, r) => sum + Number(r.grand_total ?? 0),
        0
      );
      metrics.revenue30 = Math.round(revenue30 * 100) / 100;

      const { data } = await mineOrders(
        db
          .from('orders')
          .select('order_number, email, status, grand_total, created_at')
          .order('created_at', { ascending: false })
          .limit(8)
      );
      recentOrders = data ?? [];
    }

    return ok({
      metrics,
      // null, not [], when the person cannot see orders: "no orders yet" would
      // be a false statement about the business.
      recentOrders,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
