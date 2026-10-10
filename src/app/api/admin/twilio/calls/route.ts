import { requireAdmin } from '@/lib/adminAuth';
import { featureUnavailable } from '@/lib/env';
import { ok, serverError } from '@/lib/api';
import { listCalls } from '@/lib/twilio';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/twilio/calls?limit=40 — recent calls on this Twilio number.
 *
 * Read straight from Twilio rather than mirrored into our database. Twilio is
 * already the record of what happened, and a copy only has to disagree with
 * it once to be worse than no copy.
 */
export async function GET(req: Request) {
  const unavailable = featureUnavailable('twilio');
  if (unavailable) return unavailable;

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const limit = Number(new URL(req.url).searchParams.get('limit')) || 40;

  try {
    return ok({ calls: await listCalls(limit) });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
