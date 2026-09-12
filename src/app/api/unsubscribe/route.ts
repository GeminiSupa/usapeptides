import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { featureUnavailable } from '@/lib/env';
import { ok, badRequest, serverError, readJson, isEmail, clip } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * POST /api/unsubscribe - remove an address from marketing email.
 *
 * Always reports success, whether or not the address was on the list. Saying
 * "that address isn't subscribed" would turn this into a way to test which
 * addresses we hold.
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
    const { error } = await getSupabaseAdmin()
      .from('newsletter_subscribers')
      .update({ is_subscribed: false, unsubscribed_at: new Date().toISOString() })
      .ilike('email', email);

    if (error) return serverError(error.message);

    return ok({ unsubscribed: true });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
