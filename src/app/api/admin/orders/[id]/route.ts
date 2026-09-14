import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { featureUnavailable } from '@/lib/env';
import { isSalesAgent } from '@/lib/permissions';
import { ok, badRequest, notFound, serverError } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/orders/:id
 *
 * Order detail for the dashboard: the order header plus its line items. A
 * sales agent may open their own orders and unclaimed orders, matching the
 * list view they already see.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const auth = await requireAdmin(req, { permission: 'orders' });
  if (!auth.ok) return auth.response;

  if (!params.id) return badRequest('Order id is required.');

  try {
    const db = getSupabaseAdmin();
    const agent = isSalesAgent(auth.admin.profile);

    let query = db.from('orders').select('*').eq('id', params.id);
    if (agent) query = query.or(`referred_by.is.null,referred_by.eq.${auth.admin.id}`);

    const { data: order, error } = await query.maybeSingle();
    if (error) return serverError(error.message);
    if (!order) return notFound('No order with that id.');

    const { data: items, error: itemsError } = await db
      .from('order_items')
      .select('id, product_slug, product_name, sku, unit_price, quantity, line_total, created_at')
      .eq('order_id', params.id)
      .order('created_at', { ascending: true });

    if (itemsError) return serverError(itemsError.message);

    return ok({ order, items: items ?? [] });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
