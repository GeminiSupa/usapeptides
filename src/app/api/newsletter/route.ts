import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { featureUnavailable } from '@/lib/env';
import { created, badRequest, serverError, readJson, isEmail, clip } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * POST /api/newsletter - subscribe an address.
 *
 * Re-subscribing an existing address is a no-op rather than an error, so the
 * form never leaks whether a given address is already on the list.
 */
export async function POST(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const body = await readJson<Record<string, unknown>>(req);
  if (!body || !isEmail(body.email)) {
    return badRequest('A valid email address is required.', {
      email: 'A valid email address is required.',
    });
  }

  const email = clip(body.email, 320).toLowerCase();

  try {
    const db = getSupabaseAdmin();

    const { data: existing } = await db
      .from('newsletter_subscribers')
      .select('id, is_subscribed')
      .ilike('email', email)
      .maybeSingle();

    if (existing) {
      if (!existing.is_subscribed) {
        await db
          .from('newsletter_subscribers')
          .update({ is_subscribed: true, unsubscribed_at: null })
          .eq('id', existing.id);
      }
      return created({ subscribed: true });
    }

    const { error } = await db.from('newsletter_subscribers').insert({
      email,
      source: clip(body.source, 100) || 'site',
    });

    if (error) return serverError(error.message);
    return created({ subscribed: true });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
