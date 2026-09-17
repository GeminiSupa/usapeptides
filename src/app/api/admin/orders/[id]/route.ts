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

    const [itemsResult, fulfillmentResult, activityResult] = await Promise.all([
      db.from('order_items')
        .select('id, product_slug, product_name, sku, unit_price, quantity, line_total, created_at')
        .eq('order_id', params.id).order('created_at', { ascending: true }),
      db.from('fulfillment_queue')
        .select('id, stage, assigned_to, notes, picked_at, packed_at, dispatched_at, created_at, updated_at')
        .eq('order_id', params.id).maybeSingle(),
      db.from('crm_activity')
        .select('id, activity, body, actor, created_at')
        .eq('subject_type', 'order').eq('subject_id', params.id)
        .order('created_at', { ascending: false }),
    ]);

    if (itemsResult.error) return serverError(itemsResult.error.message);
    if (fulfillmentResult.error && fulfillmentResult.error.code !== 'PGRST116') return serverError(fulfillmentResult.error.message);
    if (activityResult.error) return serverError(activityResult.error.message);

    return ok({ order, items: itemsResult.data ?? [], fulfillment: fulfillmentResult.data ?? null, activity: activityResult.data ?? [] });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
