import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { featureUnavailable, BUSINESS } from '@/lib/env';
import { resolveOrderAttribution } from '@/lib/attribution';
import { FLAT_SHIPPING, FREE_SHIPPING_THRESHOLD, roundMoney, tierDiscount } from '@/lib/checkout';
import { bestDealDiscount } from '@/lib/dealPricing';
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

/** How the customer said they will pay. Recorded only; nothing is charged here. */
const PAYMENT_METHODS = new Set(['card', 'zelle', 'crypto', 'wire']);

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
    /** The referral code from a `?ref=` link. Only a claim; checked below. */
    ref?: unknown;
    paymentMethod?: unknown;
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
      const unitPrice = roundMoney(base * (1 - discount));
      const lineTotal = roundMoney(unitPrice * line.quantity);

      subtotal = roundMoney(subtotal + roundMoney(base * line.quantity));
      discountTotal = roundMoney(discountTotal + (roundMoney(base * line.quantity) - lineTotal));

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
    const deal = await bestDealDiscount(db, lines);
    if (deal) discountTotal = roundMoney(discountTotal + deal.amount);
    const discountedMerchandise = roundMoney(subtotal - discountTotal);
    const shippingTotal = discountedMerchandise >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;
    const grandTotal = roundMoney(discountedMerchandise + shippingTotal);

    const email = clip(body.email, 320).toLowerCase();

    // Referral link first, then "the customer stays with their agent". No
    // match means the order arrives unclaimed for an agent to claim.
    const attribution = await resolveOrderAttribution(db, { ref: body.ref, email });

    const { data: order, error: orderError } = await db
      .from('orders')
      .insert({
        order_number: generateOrderNumber(),
        email,
        ...(attribution
          ? {
              referred_by: attribution.referred_by,
              affiliate_id: attribution.affiliate_id ?? null,
              agent_source: attribution.agent_source,
              referral_code: attribution.referral_code,
              agent_claimed_at: new Date().toISOString(),
            }
          : {}),
        full_name: clip(body.fullName, 200) || null,
        institution: clip(body.institution, 200) || null,
        phone: clip(body.phone, 50) || null,
        status: 'pending',
        subtotal,
        discount_total: discountTotal,
        shipping_total: shippingTotal,
        grand_total: grandTotal,
        currency: BUSINESS.currency,
        coupon_code: deal?.title ?? null,
        shipping_address: body.shippingAddress ?? null,
        payment_provider: PAYMENT_METHODS.has(String(body.paymentMethod)) ? String(body.paymentMethod) : null,
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
