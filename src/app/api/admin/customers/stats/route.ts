import { requireAdmin } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { featureUnavailable } from '@/lib/env';
import { isSalesAgent } from '@/lib/permissions';
import { ok, serverError } from '@/lib/api';
import { PAID_ORDER_STATUSES, reorderEstimate } from '@/lib/retention';

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
  const dates: Record<string, string[]> = {};

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
        if (PAID_ORDER_STATUSES.has(String(o.status))) {
          s.spent += Number(o.grand_total ?? 0);
          (dates[email] ??= []).push(String(o.created_at));
          if (!s.lastOrderAt || String(o.created_at) > s.lastOrderAt) s.lastOrderAt = String(o.created_at);
        }
      }
      if (!data || data.length < 1000) break;
    }

    const followUps = [];
    const emails = Object.keys(dates);
    for (let i = 0; i < emails.length; i += 100) {
      let q = db.from('customer_profiles').select('id,email,full_name,owner_id').in('email', emails.slice(i, i + 100));
      if (isSalesAgent(auth.admin.profile)) q = q.or(`owner_id.is.null,owner_id.eq.${auth.admin.id}`);
      const profiles = await q;
      if (profiles.error) return serverError(profiles.error.message);
      const ids = (profiles.data ?? []).map(p => p.id);
      const settings = ids.length ? await db.from('customer_retention').select('*').in('customer_id', ids) : { data: [], error: null };
      if (settings.error && !/42P01|PGRST205/.test(settings.error.code)) return serverError(settings.error.message);
      for (const p of profiles.data ?? []) {
        const preference = settings.data?.find(s => s.customer_id === p.id);
        const estimate = reorderEstimate(dates[p.email.toLowerCase()] ?? [], preference?.reorder_days);
        if (estimate && estimate.daysUntil <= 7 && (!preference?.follow_up_after || preference.follow_up_after <= new Date().toISOString().slice(0, 10))) {
          followUps.push({ customerId: p.id, name: p.full_name || p.email, ...estimate });
        }
      }
    }
    followUps.sort((a,b) => a.daysUntil - b.daysUntil);
    return ok({ stats, followUps });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
