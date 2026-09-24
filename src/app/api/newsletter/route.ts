import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { featureUnavailable } from '@/lib/env';
import { created, badRequest, serverError, readJson } from '@/lib/api';
import { cleanText, isEmail, normaliseEmail } from '@/lib/validate';
import { fireTrigger } from '@/lib/automationEngine';

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
  const email = normaliseEmail(body?.email);
  if (!isEmail(email)) {
    return badRequest('A valid email address is required.', {
      email: 'A valid email address is required.',
    });
  }

  try {
    const db = getSupabaseAdmin();

    // `eq`, not `ilike`: a `%` is legal in an address but is a wildcard to
    // `ilike`, which would have matched somebody else's row.
    const { data: existing } = await db
      .from('newsletter_subscribers')
      .select('id, is_subscribed')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      if (!existing.is_subscribed) {
        await db
          .from('newsletter_subscribers')
          .update({ is_subscribed: true, unsubscribed_at: null })
          .eq('id', existing.id);
        await fireTrigger('newsletter_signup', { email, source: 'subscriber' });
      }
      return created({ subscribed: true });
    }

    const { error } = await db.from('newsletter_subscribers').insert({
      email,
      source: cleanText(body?.source, 100) || 'site',
    });

    if (error) return serverError(error.message);
    await fireTrigger('newsletter_signup', { email, source: 'subscriber' });
    return created({ subscribed: true });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
