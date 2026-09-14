import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { featureUnavailable, BUSINESS } from '@/lib/env';
import { isSalesAgent } from '@/lib/permissions';
import { FLAT_SHIPPING, FREE_SHIPPING_THRESHOLD, roundMoney, tierDiscount } from '@/lib/checkout';
import { writeAudit } from '@/lib/audit';
import {
  badRequest,
  created,
  readJson,
  serverError,
  isEmail,
  clip,
  generateOrderNumber,
} from '@/lib/api';

export const dynamic = 'force-dynamic';

const STATUSES = new Set(['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']);
const PAYMENT_METHODS = new Set(['card', 'zelle', 'crypto', 'wire', 'manual']);

interface IncomingItem {
  slug?: unknown;
  quantity?: unknown;
}

/**
 * Admin/manual order creation.
 *
 * Still prices from the product table, not from the browser. This gives staff a
 * PeptideCosta-style "phone/manual order" path without opening a hole where a
 * crafted dashboard request can set arbitrary totals.
 */
export async function POST(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const auth = await requireAdmin(req, { permission: 'orders' });
  if (!auth.ok) return auth.response;

  const body = await readJson<{
    email?: unknown;
    fullName?: unknown;
    institution?: unknown;
    phone?: unknown;
    items?: unknown;
    shippingAddress?: unknown;
    paymentMethod?: unknown;
    paymentReference?: unknown;
    status?: unknown;
    notes?: unknown;
  }>(req);

  if (!body) return badRequest('Request body must be valid JSON.');

  const fields: Record<string, string> = {};
  if (!isEmail(body.email)) fields.email = 'A valid email address is required.';
  if (!Array.isArray(body.items) || body.items.length === 0) {
    fields.items = 'At least one order line is required.';
  }

  const status = STATUSES.has(String(body.status)) ? String(body.status) : 'pending';
  const paymentMethod = PAYMENT_METHODS.has(String(body.paymentMethod)) ? String(body.paymentMethod) : null;

  if (Object.keys(fields).length) return badRequest('Order rejected.', fields);

  const requested = (body.items as IncomingItem[])
    .map((item) => ({
      slug: clip(item?.slug, 200),
      quantity: Math.floor(Number(item?.quantity)),
    }))
    .filter((item) => item.slug && Number.isFinite(item.quantity) && item.quantity > 0);

  if (requested.length === 0) {
    return badRequest('Order rejected.', { items: 'No valid order lines supplied.' });
  }

  try {
    const db = getSupabaseAdmin();

    const slugs = Array.from(new Set(requested.map((i) => i.slug)));
    const { data: products, error: lookupError } = await db
      .from('products')
      .select('id, slug, name, sku, price, sale_price, in_stock, stock_count')
      .in('slug', slugs)
      .eq('is_active', true);

    if (lookupError) return serverError(lookupError.message);

    const bySlug = new Map((products ?? []).map((p) => [p.slug, p]));
    const missing = slugs.filter((s) => !bySlug.has(s));
    if (missing.length) {
      return badRequest('Order rejected.', {
        items: `Unknown or inactive product(s): ${missing.join(', ')}`,
      });
    }

    const lines = [];
    let subtotal = 0;
    let discountTotal = 0;

    for (const line of requested) {
      const product = bySlug.get(line.slug)!;

      if (!product.in_stock || Number(product.stock_count) < line.quantity) {
        return badRequest('Order rejected.', {
          items: `Insufficient stock for ${product.name} (requested ${line.quantity}, available ${product.stock_count}).`,
        });
      }

      const base = Number(product.sale_price ?? product.price);
      const discount = tierDiscount(line.quantity);
      const unitPrice = roundMoney(base * (1 - discount));
      const lineTotal = roundMoney(unitPrice * line.quantity);
      const undiscounted = roundMoney(base * line.quantity);

      subtotal = roundMoney(subtotal + undiscounted);
      discountTotal = roundMoney(discountTotal + (undiscounted - lineTotal));

      lines.push({
        product_id: product.id,
        product_slug: product.slug,
        product_name: product.name,
        sku: product.sku,
        unit_price: unitPrice,
        quantity: line.quantity,
        line_total: lineTotal,
      });
    }

    const merchandise = roundMoney(subtotal - discountTotal);
    const shippingTotal = merchandise >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;
    const grandTotal = roundMoney(merchandise + shippingTotal);
    const now = new Date().toISOString();
    const agent = isSalesAgent(auth.admin.profile);

    const { data: order, error: orderError } = await db
      .from('orders')
      .insert({
        order_number: generateOrderNumber(),
        email: clip(body.email, 320).toLowerCase(),
        full_name: clip(body.fullName, 200) || null,
        institution: clip(body.institution, 200) || null,
        phone: clip(body.phone, 50) || null,
        status,
        subtotal,
        discount_total: discountTotal,
        shipping_total: shippingTotal,
        grand_total: grandTotal,
        currency: BUSINESS.currency,
        shipping_address: body.shippingAddress ?? null,
        payment_provider: paymentMethod,
        payment_reference: clip(body.paymentReference, 200) || null,
        compliance_ack: true,
        notes: clip(body.notes, 1000) || null,
        ...(agent
          ? {
              referred_by: auth.admin.id,
              agent_source: 'assigned',
              agent_claimed_at: now,
            }
          : {}),
      })
      .select()
      .single();

    if (orderError) return serverError(orderError.message);

    const { error: itemsError } = await db
      .from('order_items')
      .insert(lines.map((line) => ({ ...line, order_id: order.id })));

    if (itemsError) {
      await db.from('orders').delete().eq('id', order.id);
      return serverError(itemsError.message);
    }

    await writeAudit(auth.admin, {
      action: 'order.create',
      targetType: 'orders',
      targetId: order.id,
      targetLabel: order.order_number,
      detail: { source: 'manual', lineCount: lines.length, grandTotal },
    });

    return created({ order, items: lines });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
