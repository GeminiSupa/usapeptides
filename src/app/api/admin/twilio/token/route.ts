import { requireAdmin } from '@/lib/adminAuth';
import { featureUnavailable } from '@/lib/env';
import { ok, serverError } from '@/lib/api';
import { createVoiceToken, voiceIdentityFor } from '@/lib/twilio';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/twilio/token — a one-hour token so this admin's browser can
 * place calls.
 *
 * The identity is derived from the signed-in address, never taken from the
 * request. A caller-supplied identity would let one admin place calls that
 * Twilio's logs attribute to another.
 *
 * The browser refetches this on the SDK's `tokenWillExpire` event. Without
 * that, dialling stops working an hour after the tab was opened.
 */
export async function GET(req: Request) {
  const unavailable = featureUnavailable('twilioVoice');
  if (unavailable) return unavailable;

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    return ok(createVoiceToken(voiceIdentityFor(auth.admin.email)));
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
