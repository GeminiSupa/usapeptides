import { requireAdmin } from '@/lib/adminAuth';
import { featureUnavailable } from '@/lib/env';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { ok, serverError } from '@/lib/api';

export const dynamic = 'force-dynamic';

const SETUP = 'Earnings need database migration 0008_commissions.sql. Run it in Supabase, then reload.';

export async function GET(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;
  const auth = await requireAdmin(req, { allowSubUser: true, anyAuthenticated: true });
  if (!auth.ok) return auth.response;

  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('sales_commissions')
    .select('id, order_id, kind, rate, amount, status, paid_at, created_at')
    .eq('beneficiary_id', auth.admin.id)
    .order('created_at', { ascending: false });

  if (error) {
    if (error.code === '42P01' || /sales_commissions|schema cache/i.test(error.message)) {
      return serverError(SETUP);
    }
    return serverError(error.message);
  }

  const rows = data ?? [];
  const totals = rows.reduce(
    (sum, row) => {
      const amount = Number(row.amount) || 0;
      if (row.status === 'paid') sum.paid += amount;
      else if (row.status === 'approved') sum.approved += amount;
      else if (row.status === 'pending') sum.pending += amount;
      return sum;
    },
    { pending: 0, approved: 0, paid: 0 }
  );

  return ok({ totals, rows });
}
