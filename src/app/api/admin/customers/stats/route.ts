import { requireAdmin } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { featureUnavailable } from '@/lib/env';
import { isSalesAgent } from '@/lib/permissions';
import { ok, serverError } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/customers/stats
 *
 * Orders, money spent and last order date per customer email, plus which
 * customers have a sign-in. A sales agent only gets figures from their own
 * orders, matching what the Customers list shows them.
 */
export async function GET(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const auth = await requireAdmin(req, { permission: 'customers' });
  if (!auth.ok) return auth.response;

  const db = getSupabaseAdmin();
  const stats: Record<string, { orders: number; spent: number; lastOrderAt: string | null }> = {};

  try {
    for (let from = 0; ; from += 1000) {
      let query = db
        .from('orders')
        .select('email, grand_total, status, created_at')
        .order('created_at', { ascending: false })
        .range(from, from + 999);
      if (isSalesAgent(auth.admin.profile)) {
        query = query.or(`referred_by.eq.${auth.admin.id},and(referred_by.is.null,status.neq.completed)`);
      }

      const { data, error } = await query;
      if (error) return serverError(error.message);

      for (const o of data ?? []) {
        const email = String(o.email ?? '').toLowerCase();
        if (!email) continue;
        const s = (stats[email] ??= { orders: 0, spent: 0, lastOrderAt: null });
        s.orders += 1;
        if (!['cancelled', 'refunded', 'pending'].includes(String(o.status))) s.spent += Number(o.grand_total ?? 0);
        if (!s.lastOrderAt || String(o.created_at) > s.lastOrderAt) s.lastOrderAt = String(o.created_at);
      }
      if (!data || data.length < 1000) break;
    }

    return ok({ stats });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
