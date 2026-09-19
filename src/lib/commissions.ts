import 'server-only';

import type { getSupabaseAdmin } from './supabaseAdmin';

type Db = ReturnType<typeof getSupabaseAdmin>;

/**
 * Create the money records for a completed order. Unique constraints make this
 * safe when two tabs complete the same order or an API request retries.
 */
export async function generateCommissionsForOrder(db: Db, orderId: string): Promise<string | null> {
  const { data: order, error } = await db
    .from('orders')
    .select('id, status, grand_total, referred_by, affiliate_id')
    .eq('id', orderId)
    .maybeSingle();

  if (error) return error.message;
  if (!order || order.status !== 'completed') return null;

  const total = Number(order.grand_total) || 0;

  if (order.affiliate_id) {
    const { data: affiliate } = await db
      .from('affiliates')
      .select('id, commission_rate, is_active')
      .eq('id', order.affiliate_id)
      .maybeSingle();
    if (affiliate?.is_active) {
      const rate = Number(affiliate.commission_rate) || 0;
      const amount = Math.round(total * rate) / 100;
      const result = await db.from('affiliate_commissions').upsert(
        { affiliate_id: affiliate.id, order_id: order.id, amount, status: 'pending' },
        { onConflict: 'affiliate_id,order_id', ignoreDuplicates: true }
      );
      if (result.error) return result.error.message;
    }
  }

  if (!order.referred_by) return null;
  const { data: seller } = await db
    .from('admin_users')
    .select('id, status, commission_rate, parent_user_id')
    .eq('id', order.referred_by)
    .maybeSingle();
  if (!seller || seller.status !== 'active') return null;

  const directRate = Number(seller.commission_rate) || 0;
  const rows: Record<string, unknown>[] = [{
    beneficiary_id: seller.id,
    source_user_id: seller.id,
    order_id: order.id,
    kind: 'direct',
    rate: directRate,
    amount: Math.round(total * directRate) / 100,
  }];

  if (seller.parent_user_id) {
    const { data: parent } = await db
      .from('admin_users')
      .select('id, status, override_rate')
      .eq('id', seller.parent_user_id)
      .maybeSingle();
    if (parent?.status === 'active') {
      const rate = Number(parent.override_rate) || 0;
      rows.push({
        beneficiary_id: parent.id,
        source_user_id: seller.id,
        order_id: order.id,
        kind: 'override',
        rate,
        amount: Math.round(total * rate) / 100,
      });
    }
  }

  const result = await db.from('sales_commissions').upsert(rows, {
    onConflict: 'order_id,beneficiary_id,kind',
    ignoreDuplicates: true,
  });
  return result.error?.message ?? null;
}
