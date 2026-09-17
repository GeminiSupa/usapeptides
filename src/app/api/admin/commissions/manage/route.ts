import { requireAdmin } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { featureUnavailable } from '@/lib/env';
import { writeAudit } from '@/lib/audit';
import { ok, badRequest, notFound, serverError, readJson, clip } from '@/lib/api';

export const dynamic = 'force-dynamic';
const STATUSES = new Set(['pending', 'approved', 'paid', 'void']);
const TYPES = new Set(['affiliate', 'seller']);

export async function GET(req: Request) {
  const unavailable = featureUnavailable('adminDatabase'); if (unavailable) return unavailable;
  const auth = await requireAdmin(req, { permission: 'commissions' }); if (!auth.ok) return auth.response;
  const db = getSupabaseAdmin();
  const [affiliateResult, sellerResult] = await Promise.all([
    db.from('affiliate_commissions').select('id, affiliate_id, order_id, amount, status, created_at, paid_at, reference'),
    db.from('sales_commissions').select('id, beneficiary_id, order_id, kind, rate, amount, status, created_at, paid_at, reference'),
  ]);
  if (affiliateResult.error) return serverError(affiliateResult.error.message);
  if (sellerResult.error) return serverError(/sales_commissions|schema cache/i.test(sellerResult.error.message)
    ? 'Run migration 0008_commissions.sql, then reload.' : sellerResult.error.message);

  const affiliateIds = Array.from(new Set((affiliateResult.data ?? []).map((r) => r.affiliate_id)));
  const userIds = Array.from(new Set((sellerResult.data ?? []).map((r) => r.beneficiary_id)));
  const orderIds = Array.from(new Set([...(affiliateResult.data ?? []), ...(sellerResult.data ?? [])].map((r) => r.order_id).filter(Boolean)));
  const [affiliates, users, orders] = await Promise.all([
    affiliateIds.length ? db.from('affiliates').select('id, full_name, email').in('id', affiliateIds) : Promise.resolve({ data: [] }),
    userIds.length ? db.from('admin_users').select('id, full_name, email').in('id', userIds) : Promise.resolve({ data: [] }),
    orderIds.length ? db.from('orders').select('id, order_number').in('id', orderIds) : Promise.resolve({ data: [] }),
  ]);
  const names = new Map([...(affiliates.data ?? []), ...(users.data ?? [])].map((p:any) => [p.id, p.full_name || p.email]));
  const numbers = new Map((orders.data ?? []).map((o:any) => [o.id, o.order_number]));
  const rows = [
    ...(affiliateResult.data ?? []).map((r) => ({ ...r, type: 'affiliate', beneficiary: names.get(r.affiliate_id) ?? 'Affiliate', order_number: numbers.get(r.order_id) ?? '—' })),
    ...(sellerResult.data ?? []).map((r) => ({ ...r, type: 'seller', beneficiary: names.get(r.beneficiary_id) ?? 'Seller', order_number: numbers.get(r.order_id) ?? '—' })),
  ].sort((a,b) => String(b.created_at).localeCompare(String(a.created_at)));
  const totals = rows.reduce((out:any, row:any) => { out[row.status] = (out[row.status] ?? 0) + Number(row.amount || 0); return out; }, { pending:0, approved:0, paid:0, void:0 });
  return ok({ rows, totals });
}

export async function PATCH(req: Request) {
  const unavailable = featureUnavailable('adminDatabase'); if (unavailable) return unavailable;
  const auth = await requireAdmin(req, { permission: 'commissions' }); if (!auth.ok) return auth.response;
  const body = await readJson<{ id?:string; type?:string; status?:string; reference?:unknown }>(req);
  if (!body?.id || !TYPES.has(String(body.type)) || !STATUSES.has(String(body.status))) return badRequest('Valid id, type and status are required.');
  const db = getSupabaseAdmin(); const table = body.type === 'affiliate' ? 'affiliate_commissions' : 'sales_commissions';
  const now = new Date().toISOString(); const changes:any = { status: body.status, reference: clip(body.reference, 200) || null };
  if (body.status === 'approved') { changes.approved_by = auth.admin.id; changes.approved_at = now; }
  if (body.status === 'paid') { changes.settled_by = auth.admin.id; changes.paid_at = now; }
  const { data, error } = await db.from(table).update(changes).eq('id', body.id).select('id, status').maybeSingle();
  if (error) return serverError(error.message); if (!data) return notFound('Commission not found.');
  const auditAction = body.status === 'paid' ? 'commission.settle' : body.status === 'approved' ? 'commission.approve' : 'commission.void';
  await writeAudit(auth.admin, { action: auditAction, targetType: table, targetId: body.id, detail: { type: body.type, reference: changes.reference } });
  return ok({ commission: data });
}
