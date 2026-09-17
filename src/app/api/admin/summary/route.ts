import { requireAdmin } from '@/lib/adminAuth';
import { featureUnavailable } from '@/lib/env';
import { canAccess, isSalesAgent } from '@/lib/permissions';
import { attentionItems, computeAnalytics } from '@/lib/analyticsEngine';
import { RANGE_IDS } from '@/lib/analyticsTime';
import { ok, serverError } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/summary?range=today
 *
 * The Dashboard home: headline numbers for the chosen period, and the list of
 * things waiting for someone. Each figure is sent only to a person who may open
 * its section; a sales agent's figures are their own.
 */
export async function GET(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const range = RANGE_IDS.has(String(url.searchParams.get('range'))) ? String(url.searchParams.get('range')) : 'today';
  const may = (section: string) => canAccess(section, auth.admin.profile);
  const agentId = isSalesAgent(auth.admin.profile) ? auth.admin.id : null;

  try {
    const [data, attention] = await Promise.all([
      computeAnalytics({ range, from: url.searchParams.get('from'), to: url.searchParams.get('to'), may, agentId, light: true }),
      attentionItems(may, agentId),
    ]);
    return ok({ ...data, attention, isAgent: Boolean(agentId) });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Could not load the dashboard.');
  }
}
