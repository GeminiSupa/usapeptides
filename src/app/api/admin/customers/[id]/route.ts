import { requireAdmin } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { featureUnavailable } from '@/lib/env';
import { isCreditable } from '@/lib/attribution';
import { isSalesAgent } from '@/lib/permissions';
import { writeAudit } from '@/lib/audit';
import { ok, badRequest, notFound, serverError, readJson } from '@/lib/api';
import { PAID_ORDER_STATUSES, reorderEstimate } from '@/lib/retention';

export const dynamic = 'force-dynamic';

const SETUP = 'Customer ownership needs supabase/migrations/0019_customer_ownership.sql to be run in Supabase first.';

/** Staff-only retention details; ownership changes remain super-admin PATCH. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;
  const auth = await requireAdmin(req, { permission: 'customers' });
  if (!auth.ok) return auth.response;
  const body = await readJson<Record<string, unknown>>(req);
  if (!body || typeof body.notes !== 'string' || body.notes.length > 5000 || typeof body.acquisition_source !== 'string' || body.acquisition_source.length > 200) return badRequest('Enter a source up to 200 characters and notes up to 5000 characters.');
  const days = body.reorder_days;
  if (days !== null && (typeof days !== 'number' || !Number.isInteger(days) || days < 1 || days > 365)) return badRequest('Reorder interval must be 1–365 days or empty.');
  const after = body.follow_up_after;
  if (after !== null && (typeof after !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(after) || !Number.isFinite(Date.parse(after)) || new Date(after).toISOString().slice(0,10) !== after)) return badRequest('Choose a valid follow-up date.');
  const db = getSupabaseAdmin();
  const customer = await db.from('customer_profiles').select('id,owner_id').eq('id', params.id).maybeSingle();
  if (customer.error) return serverError(customer.error.message);
  if (!customer.data || (isSalesAgent(auth.admin.profile) && customer.data.owner_id && customer.data.owner_id !== auth.admin.id)) return notFound('No customer with that id.');
  const result = await db.from('customer_retention').upsert({ customer_id: params.id, notes: body.notes.trim(), acquisition_source: body.acquisition_source.trim(), reorder_days: days, follow_up_after: after, updated_at: new Date().toISOString() });
  if (result.error) return serverError(/42P01|PGRST205/.test(result.error.code) ? 'Run supabase/migrations/0023_customer_retention.sql in Supabase first.' : result.error.message);
  await writeAudit(auth.admin, { action: 'customer.retention.update', targetType: 'customer', targetId: params.id, detail: { fields: ['notes', 'acquisition_source', 'reorder_days', 'follow_up_after'] } });
  return ok({ saved: true });
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;
  const auth = await requireAdmin(req, { permission: 'customers' });
  if (!auth.ok) return auth.response;

  const db = getSupabaseAdmin();
  try {
    const { data: customer, error } = await db.from('customer_profiles').select('*').eq('id', params.id).maybeSingle();
    if (error) return serverError(error.message);
    if (!customer) return notFound('No customer with that id.');

    const agent = isSalesAgent(auth.admin.profile);
    const ownershipReady = Object.prototype.hasOwnProperty.call(customer, 'owner_id');
    if (agent) {
      if (ownershipReady) {
        if (customer.owner_id && customer.owner_id !== auth.admin.id) return notFound('No customer with that id.');
      } else {
        const { data: mine } = await db.from('orders').select('id').eq('email', customer.email)
          .or(`referred_by.eq.${auth.admin.id},and(referred_by.is.null,status.neq.completed)`).limit(1);
        if (!mine?.length) return notFound('No customer with that id.');
      }
    }

    let orderQuery = db.from('orders').select('*').or(`customer_id.eq.${customer.id},email.eq.${customer.email}`)
      .order('created_at', { ascending: false }).limit(200);
    if (agent) orderQuery = orderQuery.or(`referred_by.eq.${auth.admin.id},and(referred_by.is.null,status.neq.completed)`);
    const { data: orders, error: orderError } = await orderQuery;
    if (orderError) return serverError(orderError.message);

    const ids = (orders ?? []).map((order: any) => order.id);
    const orderNumbers = (orders ?? []).map((order: any) => order.order_number).filter(Boolean);
    const { data: items } = ids.length
      ? await db.from('order_items').select('id, order_id, product_slug, product_name, sku, unit_price, quantity, line_total, created_at').in('order_id', ids)
      : { data: [] };
    const byOrder = new Map<string, any[]>();
    for (const item of items ?? []) {
      const list = byOrder.get(item.order_id) ?? [];
      list.push(item); byOrder.set(item.order_id, list);
    }

    let visits: any[] = [];
    const sessionFields = 'session_id, first_seen, last_seen, landing_path, exit_path, source, medium, device, city, region, country, order_number';
    const linkedSessions = await db.from('visitor_sessions').select(sessionFields)
      .eq('customer_id', customer.id).order('first_seen', { ascending: false }).limit(100);
    const purchaseSessions = orderNumbers.length
      ? await db.from('visitor_sessions').select(sessionFields).in('order_number', orderNumbers)
        .order('first_seen', { ascending: false }).limit(100)
      : { data: [] as any[], error: null };
    const sessionMap = new Map<string, any>();
    for (const session of [...(linkedSessions.data ?? []), ...(purchaseSessions.data ?? [])]) sessionMap.set(session.session_id, session);
    const sessions = Array.from(sessionMap.values()).sort((a, b) => String(b.first_seen).localeCompare(String(a.first_seen))).slice(0, 100);
    if (sessions.length) {
        const sessionIds = sessions.map((session: any) => session.session_id);
        const eventResult = await db.from('analytics_events')
          .select('session_id, event_name, path, product_slug, payload, created_at')
          .in('session_id', sessionIds).in('event_name', ['page_view', 'product_view', 'checkout', 'add_to_cart', 'interaction'])
          .order('created_at', { ascending: true }).limit(2000);
        const bySession = new Map<string, any[]>();
        for (const event of eventResult.data ?? []) {
          const list = bySession.get(event.session_id) ?? [];
          list.push(event); bySession.set(event.session_id, list);
        }
        visits = sessions.map((session: any) => ({ ...session, events: bySession.get(session.session_id) ?? [] }));
    }

    const { data: activity } = await db.from('crm_activity').select('id, activity, body, actor, created_at')
      .eq('subject_type', 'customer').eq('subject_id', customer.id).order('created_at', { ascending: false }).limit(200);

    let owners: { id: string; name: string }[] = [];
    if (auth.admin.profile.is_superadmin) {
      const { data: people } = await db.from('admin_users').select('id, full_name, email, role, tier, status');
      owners = (people ?? []).filter(isCreditable).map((person: any) => ({ id: person.id, name: person.full_name || person.email }));
    }

    const retention = await db.from('customer_retention').select('*').eq('customer_id', customer.id).maybeSingle();
    if (retention.error && !/42P01|PGRST205/.test(retention.error.code)) return serverError(retention.error.message);
    const addresses = await db.from('customer_addresses').select('id,label,line1,line2,city,state,postal_code,country,is_default').eq('customer_id', customer.id);
    if (addresses.error) return serverError(addresses.error.message);
    const paid = (orders ?? []).filter(o => PAID_ORDER_STATUSES.has(o.status));
    const productHistory = new Map<string, { name: string; quantity: number; dates: string[] }>();
    for (const order of paid) for (const item of byOrder.get(order.id) ?? []) {
      const key = item.product_slug || item.sku || item.product_name;
      const p = productHistory.get(key) ?? { name: item.product_name, quantity: 0, dates: [] as string[] };
      p.quantity += Number(item.quantity); p.dates.push(order.created_at); productHistory.set(key, p);
    }
    return ok({
      retentionReady: !retention.error,
      retention: retention.data,
      addresses: addresses.data ?? [],
      purchaseSummary: { paidOrders: paid.length, spent: paid.reduce((s,o) => s + Number(o.grand_total), 0), lastOrderAt: paid[0]?.created_at ?? null, historyLimited: (orders ?? []).length === 200 },
      reorder: reorderEstimate(paid.map(o => o.created_at), retention.data?.reorder_days),
      frequentlyPurchased: Array.from(productHistory.values()).sort((a,b) => b.quantity-a.quantity).map(p => ({ ...p, reorder: reorderEstimate(p.dates) })),
      customer,
      ownershipReady,
      owners,
      orders: (orders ?? []).map((order: any) => ({ ...order, items: byOrder.get(order.id) ?? [] })),
      visits,
      activity: activity ?? [],
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;
  const auth = await requireAdmin(req, { superadmin: true });
  if (!auth.ok) return auth.response;
  const body = await readJson<{ owner_id?: string | null; confirmed?: boolean }>(req);
  if (!body || body.confirmed !== true || !Object.prototype.hasOwnProperty.call(body, 'owner_id')) {
    return badRequest('Confirm the ownership change before saving it.');
  }

  const db = getSupabaseAdmin();
  try {
    const { data: customer, error: customerError } = await db.from('customer_profiles')
      .select('id, email, full_name, owner_id').eq('id', params.id).maybeSingle();
    if (customerError) return serverError(/owner_id|schema cache/i.test(customerError.message) ? SETUP : customerError.message);
    if (!customer) return notFound('No customer with that id.');

    const ownerId = body.owner_id || null;
    if (ownerId) {
      const { data: person } = await db.from('admin_users').select('id, role, tier, status').eq('id', ownerId).maybeSingle();
      if (!isCreditable(person)) return badRequest('Choose an active sales agent or sub-user.');
    }
    if (customer.owner_id === ownerId) return ok({ customer, message: 'Ownership did not change.' });

    const now = new Date().toISOString();
    const { data: updated, error } = await db.from('customer_profiles').update({
      owner_id: ownerId,
      owner_assigned_at: now,
      owner_source: 'superadmin',
      updated_at: now,
    }).eq('id', customer.id).select('*').single();
    if (error) return serverError(/owner_id|schema cache/i.test(error.message) ? SETUP : error.message);

    await writeAudit(auth.admin, {
      action: 'customer.assign', targetType: 'customer', targetId: customer.id,
      targetLabel: customer.full_name || customer.email,
      detail: { from_agent_id: customer.owner_id, to_agent_id: ownerId },
    });
    return ok({ customer: updated, message: ownerId ? 'Customer owner changed.' : 'Customer is now unassigned.' });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
