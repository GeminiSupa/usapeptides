import { requireAdmin } from '@/lib/adminAuth';
import { featureUnavailable } from '@/lib/env';
import { ok, serverError } from '@/lib/api';
import { listAccountNumbers } from '@/lib/twilio';
import { defaultSender } from '@/lib/twilioSendingNumber';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/twilio/numbers — every number the account owns, so the
 * dashboard can offer a choice of sender rather than being fixed to one.
 *
 * Each entry says where an INCOMING call to it currently goes. That matters:
 * sending from a number changes nothing about who answers when the person
 * calls back, and on an account shared with another business most numbers
 * answer into that business's phone system.
 */
export async function GET(req: Request) {
  const unavailable = featureUnavailable('twilio');
  if (unavailable) return unavailable;

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const [numbers, preselect] = await Promise.all([listAccountNumbers(), defaultSender()]);
    return ok({ numbers, defaultNumber: preselect });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
