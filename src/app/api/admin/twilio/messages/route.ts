import { requireAdmin } from '@/lib/adminAuth';
import { featureUnavailable } from '@/lib/env';
import { ok, serverError } from '@/lib/api';
import { listMessages } from '@/lib/twilio';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/twilio/messages?limit=40 — the message log, SMS and WhatsApp.
 *
 * Read live from Twilio for the same reason as the call log: it already holds
 * the delivery status, and a mirrored copy would go stale the moment a
 * message moves from `queued` to `delivered`.
 */
export async function GET(req: Request) {
  const unavailable = featureUnavailable('twilio');
  if (unavailable) return unavailable;

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const limit = Number(new URL(req.url).searchParams.get('limit')) || 40;

  try {
    return ok({ messages: await listMessages(limit) });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
