import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { featureUnavailable } from '@/lib/env';
import { ok, badRequest, serverError, readJson, isNonEmpty, clip } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * POST /api/cart - upsert the visitor's in-progress cart.
 *
 * Keyed on an opaque session id generated client-side. Email is optional; when
 * present it is what makes later recovery outreach possible.
 */
export async function POST(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const body = await readJson<Record<string, unknown>>(req);
  if (!body || !isNonEmpty(body.sessionId)) {
    return badRequest('A "sessionId" is required.');
  }

  const items = Array.isArray(body.items) ? body.items.slice(0, 100) : [];
  const cartTotal = Number(body.cartTotal);

  try {
    const { error } = await getSupabaseAdmin()
      .from('abandoned_carts')
      .upsert(
        {
          session_id: clip(body.sessionId, 100),
          email: body.email ? clip(body.email, 320).toLowerCase() : null,
          items,
          cart_total: Number.isFinite(cartTotal) && cartTotal >= 0 ? cartTotal : 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'session_id' }
      );

    if (error) return serverError(error.message);
    return ok({ saved: true });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}

/** DELETE /api/cart?sessionId=... - mark recovered once an order is placed. */
export async function DELETE(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const sessionId = new URL(req.url).searchParams.get('sessionId');
  if (!isNonEmpty(sessionId)) return badRequest('A "sessionId" is required.');

  try {
    const { error } = await getSupabaseAdmin()
      .from('abandoned_carts')
      .update({ recovered: true })
      .eq('session_id', sessionId);

    if (error) return serverError(error.message);
    return ok({ recovered: true });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
