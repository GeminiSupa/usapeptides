import { requireAdmin } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { featureUnavailable } from '@/lib/env';
import { ok, serverError, readJson } from '@/lib/api';
import { buildAudience, CampaignError } from '@/lib/campaignSender';
import { AUDIENCES, AUDIENCE_FILTERS, type AudienceFilterId, type AudienceId } from '@/lib/emailDesign';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/campaigns/audience  { audience, filter }
 * How many people a campaign would reach, with a few example addresses, and
 * the size of every group so the picker can show them side by side.
 */
export async function POST(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;
  const auth = await requireAdmin(req, { permission: 'campaigns' });
  if (!auth.ok) return auth.response;

  const body = await readJson<{ audience?: string; filter?: string }>(req);
  const audience = (AUDIENCES.find((a) => a.id === body?.audience)?.id ?? 'subscribers') as AudienceId;
  const filter = (AUDIENCE_FILTERS.find((f) => f.id === body?.filter)?.id ?? 'none') as AudienceFilterId;

  try {
    const db = getSupabaseAdmin();
    const list = await buildAudience(db, audience, filter);
    const sizes: Record<string, number> = {};
    for (const a of AUDIENCES) {
      sizes[a.id] = a.id === audience && filter === 'none' ? list.length : (await buildAudience(db, a.id, 'none')).length;
    }
    return ok({
      count: list.length,
      sizes,
      sample: list.slice(0, 8).map((r) => ({ email: r.email, name: r.name, source: r.source })),
    });
  } catch (err) {
    return serverError(err instanceof CampaignError ? err.message : 'Could not count the audience.');
  }
}
