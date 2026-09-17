import { requireAdmin } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { featureUnavailable } from '@/lib/env';
import { writeAudit } from '@/lib/audit';
import { ok, badRequest, serverError, readJson } from '@/lib/api';
import { CampaignError, sendBatch, sendTest, startCampaign } from '@/lib/campaignSender';
import { AUDIENCES, AUDIENCE_FILTERS, type AudienceFilterId, type AudienceId } from '@/lib/emailDesign';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/admin/campaigns/send
 *   { id, mode: 'test', to: [emails] }                     a test copy
 *   { id, mode: 'start', audience, filter, scheduledAt? }  send now, or schedule
 *   { id, mode: 'batch' }                                  send the next batch
 *   { id, mode: 'pause' | 'resume' | 'cancel' }
 */
export async function POST(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;
  const auth = await requireAdmin(req, { permission: 'campaigns' });
  if (!auth.ok) return auth.response;

  const body = await readJson<{ id?: string; mode?: string; to?: unknown; audience?: string; filter?: string; scheduledAt?: string | null }>(req);
  const id = String(body?.id ?? '');
  if (!id) return badRequest('Which campaign?');
  const db = getSupabaseAdmin();

  try {
    switch (body?.mode) {
      case 'test': {
        const to = Array.isArray(body.to) ? body.to.map(String) : String(body.to ?? '').split(/[,;\s]+/);
        const result = await sendTest(id, to);
        await writeAudit(auth.admin, { action: 'campaign.test', targetType: 'campaign', targetId: id, detail: { to: result.sent } });
        return ok(result);
      }
      case 'start': {
        const audience = (AUDIENCES.find((a) => a.id === body.audience)?.id ?? 'subscribers') as AudienceId;
        const filter = (AUDIENCE_FILTERS.find((f) => f.id === body.filter)?.id ?? 'none') as AudienceFilterId;
        let scheduledAt: string | null = null;
        if (body.scheduledAt) {
          const d = new Date(body.scheduledAt);
          if (Number.isNaN(d.getTime())) return badRequest('That send time cannot be read.');
          scheduledAt = d.toISOString();
        }
        const result = await startCampaign(id, audience, filter, scheduledAt);
        await writeAudit(auth.admin, {
          action: 'campaign.send', targetType: 'campaign', targetId: id,
          detail: { audience, filter, recipients: result.recipients, scheduledAt },
        });
        const first = result.status === 'sending' ? await sendBatch(id) : null;
        return ok({ ...result, batch: first });
      }
      case 'batch':
        return ok(await sendBatch(id));
      case 'pause':
      case 'resume':
      case 'cancel': {
        const from = body.mode === 'resume' ? ['paused'] : ['sending', 'scheduled'];
        const to = body.mode === 'pause' ? 'paused' : body.mode === 'resume' ? 'sending' : 'draft';
        const { data, error } = await db.from('campaigns')
          .update({ status: to, ...(body.mode === 'cancel' ? { scheduled_at: null } : {}) })
          .eq('id', id).in('status', from).select('status').maybeSingle();
        if (error) return serverError(error.message);
        if (!data) return badRequest('That cannot be done to this campaign right now.');
        if (body.mode === 'cancel') await db.from('campaign_recipients').delete().eq('campaign_id', id).eq('status', 'queued');
        return ok({ status: data.status });
      }
      default:
        return badRequest('Unknown action.');
    }
  } catch (err) {
    if (err instanceof CampaignError) return Response.json({ error: 'campaign', message: err.message }, { status: err.status });
    console.error('[campaigns] send failed', err);
    return serverError(err instanceof Error ? err.message : 'Sending failed.');
  }
}
