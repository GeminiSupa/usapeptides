import { requireAdmin } from '@/lib/adminAuth';
import { featureUnavailable } from '@/lib/env';
import { canAccess } from '@/lib/permissions';
import { computeAnalytics } from '@/lib/analyticsEngine';
import { RANGE_IDS } from '@/lib/analyticsTime';
import { ok, serverError } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/admin/analytics?range=30d  (or range=custom&from=YYYY-MM-DD&to=YYYY-MM-DD)
 *
 * The full Analytics page. Needs the Analytics section; every block inside is
 * still limited to the sections this person may open.
 */
export async function GET(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;
  const auth = await requireAdmin(req, { permission: 'analytics' });
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const range = RANGE_IDS.has(String(url.searchParams.get('range'))) ? String(url.searchParams.get('range')) : '30d';
  try {
    const data = await computeAnalytics({
      range,
      from: url.searchParams.get('from'),
      to: url.searchParams.get('to'),
      may: (section) => canAccess(section, auth.admin.profile),
    });
    return ok(data);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Could not load analytics.');
  }
}
