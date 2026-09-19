import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { featureUnavailable } from '@/lib/env';
import { isSalesAgent } from '@/lib/permissions';
import { isCreditable } from '@/lib/attribution';
import { generateCommissionsForOrder } from '@/lib/commissions';
import { writeAudit } from '@/lib/audit';
import { ok, badRequest, notFound, serverError, readJson, clip } from '@/lib/api';

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
    if (agent) query = query.or(`and(referred_by.is.null,status.neq.completed),referred_by.eq.${auth.admin.id}`);

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

const STATUSES = new Set(['pending', 'paid', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded']);

/** One confirmed save from the order detail screen. Nothing saves on change. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;
  const auth = await requireAdmin(req, { permission: 'orders' });
  if (!auth.ok) return auth.response;
  const body = await readJson<{ changes?: Record<string, unknown>; owner_id?: string | null; confirmed?: boolean }>(req);
  if (!body?.changes || body.confirmed !== true) return badRequest('Confirm the order changes before saving.');

  const db = getSupabaseAdmin();
  try {
    const { data: current, error: currentError } = await db.from('orders').select('*').eq('id', params.id).maybeSingle();
    if (currentError) return serverError(currentError.message);
    if (!current) return notFound('No order with that id.');

    const agent = isSalesAgent(auth.admin.profile);
    if (agent && current.referred_by !== auth.admin.id) return notFound('You can only change orders that are yours. Claim it first.');
    if (agent && current.status === 'completed') return badRequest('A completed order is locked. Ask a super admin to make any correction.');

    const update: Record<string, unknown> = {};
    if (Object.prototype.hasOwnProperty.call(body.changes, 'status')) {
      const status = String(body.changes.status);
      if (!STATUSES.has(status)) return badRequest('Choose a valid order status.');
      update.status = status;
    }
    for (const key of ['tracking_number', 'payment_reference', 'notes'] as const) {
      if (Object.prototype.hasOwnProperty.call(body.changes, key)) update[key] = clip(body.changes[key], key === 'notes' ? 5000 : 500) || null;
    }

    let ownerChanged = false;
    if (Object.prototype.hasOwnProperty.call(body, 'owner_id')) {
      if (!auth.admin.profile.is_superadmin) return badRequest('Only a super admin can change the sales agent.');
      const ownerId = body.owner_id || null;
      if (ownerId) {
        const { data: person } = await db.from('admin_users').select('id, role, tier, status').eq('id', ownerId).maybeSingle();
        if (!isCreditable(person)) return badRequest('Choose an active sales agent or sub-user.');
      }
      if (ownerId !== current.referred_by) {
        if (current.status === 'completed') return badRequest('A completed order keeps its historical agent and commission. Change the customer owner from the customer profile for future orders.');
        ownerChanged = true;
        update.referred_by = ownerId;
        update.agent_source = ownerId ? 'assigned' : null;
        update.agent_claimed_at = ownerId ? new Date().toISOString() : null;
      }
    }
    if (!Object.keys(update).length) return badRequest('Nothing changed.');

    const { data: saved, error } = await db.from('orders').update(update).eq('id', params.id).select('*').single();
    if (error) return serverError(/completed|order_status/i.test(error.message)
      ? 'Order completed needs supabase/migrations/0019_customer_ownership.sql to be run in Supabase first.'
      : error.message);

    if (update.status === 'completed') {
      const commissionError = await generateCommissionsForOrder(db, params.id);
      if (commissionError) return serverError(`The order was completed, but commission could not be recorded: ${commissionError}`);
    }

    await writeAudit(auth.admin, {
      action: ownerChanged ? 'order.assign' : 'order.update', targetType: 'order', targetId: params.id,
      targetLabel: current.order_number,
      detail: { fields: Object.keys(update), ...(ownerChanged ? { from_agent_id: current.referred_by, to_agent_id: update.referred_by } : {}) },
    });
    return ok({ order: saved, message: 'Order saved.' });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
