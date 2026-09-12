import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { featureUnavailable, BUSINESS } from '@/lib/env';
import {
  ok,
  created,
  badRequest,
  notFound,
  serverError,
  readJson,
  isEmail,
  isNonEmpty,
  clip,
  generateOrderNumber,
} from '@/lib/api';

export const dynamic = 'force-dynamic';

const FREE_SHIPPING_THRESHOLD = 100;
const FLAT_SHIPPING = 12;

/** Volume tiers, mirroring the storefront's bulk pricing table. */
function tierDiscount(quantity: number): number {
  if (quantity >= 10) return 0.2;
  if (quantity >= 5) return 0.15;
  if (quantity >= 3) return 0.1;
  return 0;
}

const round = (n: number) => Math.round(n * 100) / 100;

interface IncomingItem {
  slug?: unknown;
  quantity?: unknown;
}

/**
 * POST /api/orders
 *
 * Accepts only { slug, quantity } per line. Unit prices, discounts, shipping
 * and totals are all recomputed here from the database, so a tampered client
 * payload cannot set its own price.
 */
export async function POST(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const body = await readJson<{
    email?: unknown;
    fullName?: unknown;
    institution?: unknown;
    phone?: unknown;
    items?: unknown;
    shippingAddress?: unknown;
    complianceAck?: unknown;
    notes?: unknown;
  }>(req);

  if (!body) return badRequest('Request body must be valid JSON.');

  const fields: Record<string, string> = {};
  if (!isEmail(body.email)) fields.email = 'A valid email address is required.';
  if (!Array.isArray(body.items) || body.items.length === 0) {
    fields.items = 'At least one order line is required.';
  }
  if (body.complianceAck !== true) {
    fields.complianceAck =
      'The research-use-only acknowledgement must be accepted before an order can be placed.';
  }
  if (Object.keys(fields).length) return badRequest('Order rejected.', fields);

  // Normalise the requested lines.
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

    // Price every line from database values.
    const lines = [];
    let subtotal = 0;
    let discountTotal = 0;

    for (const line of requested) {
      const product = bySlug.get(line.slug)!;

      if (!product.in_stock || product.stock_count < line.quantity) {
        return badRequest('Order rejected.', {
          items: `Insufficient stock for ${product.name} (requested ${line.quantity}, available ${product.stock_count}).`,
        });
      }

      const base = Number(product.sale_price ?? product.price);
      const discount = tierDiscount(line.quantity);
      const unitPrice = round(base * (1 - discount));
      const lineTotal = round(unitPrice * line.quantity);

      subtotal = round(subtotal + round(base * line.quantity));
      discountTotal = round(discountTotal + (round(base * line.quantity) - lineTotal));

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

    const merchandise = round(subtotal - discountTotal);
    const shippingTotal = merchandise >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;
    const grandTotal = round(merchandise + shippingTotal);

    const { data: order, error: orderError } = await db
      .from('orders')
      .insert({
        order_number: generateOrderNumber(),
        email: clip(body.email, 320).toLowerCase(),
        full_name: clip(body.fullName, 200) || null,
        institution: clip(body.institution, 200) || null,
        phone: clip(body.phone, 50) || null,
        status: 'pending',
        subtotal,
        discount_total: discountTotal,
        shipping_total: shippingTotal,
        grand_total: grandTotal,
        currency: BUSINESS.currency,
        shipping_address: body.shippingAddress ?? null,
        compliance_ack: true,
        notes: clip(body.notes, 1000) || null,
      })
      .select()
      .single();

    if (orderError) return serverError(orderError.message);

    const { error: itemsError } = await db
      .from('order_items')
      .insert(lines.map((l) => ({ ...l, order_id: order.id })));

    if (itemsError) {
      // Roll back the header so we never leave an order with no lines.
      await db.from('orders').delete().eq('id', order.id);
      return serverError(itemsError.message);
    }

    return created({
      order: {
        orderNumber: order.order_number,
        status: order.status,
        subtotal,
        discountTotal,
        shippingTotal,
        grandTotal,
        currency: BUSINESS.currency,
      },
      items: lines,
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}

/** GET /api/orders?number=USP-...&email=... - order lookup for the customer. */
export async function GET(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const url = new URL(req.url);
  const orderNumber = url.searchParams.get('number');
  const email = url.searchParams.get('email');

  // Both are required: the order number alone would be guessable.
  if (!isNonEmpty(orderNumber) || !isEmail(email)) {
    return badRequest('Both "number" and a matching "email" are required.');
  }

  try {
    const db = getSupabaseAdmin();

    const { data: order, error } = await db
      .from('orders')
      .select('*')
      .eq('order_number', orderNumber)
      .ilike('email', email)
      .maybeSingle();

    if (error) return serverError(error.message);
    if (!order) return notFound('No order matches that number and email.');

    const { data: items } = await db
      .from('order_items')
      .select('product_name, product_slug, sku, unit_price, quantity, line_total')
      .eq('order_id', order.id);

    return ok({ order, items: items ?? [] });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
