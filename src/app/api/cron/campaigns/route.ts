import { timingSafeEqual } from 'node:crypto';
import { processDueCampaigns } from '@/lib/campaignSender';
import { processAutomations } from '@/lib/automationEngine';
import { features } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Starts scheduled campaigns, sends the next batch of unfinished ones, then
 * moves every automation enrollment that is due.
 * Called by Vercel Cron, which sends `Authorization: Bearer <CRON_SECRET>`.
 * Without CRON_SECRET set the route refuses everything.
 */
export async function GET(req: Request) {
  const secret = String(process.env.CRON_SECRET ?? '');
  const given = String(req.headers.get('authorization') ?? '').replace(/^Bearer /, '');
  const valid = secret.length > 0 && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!valid) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (!features.adminDatabase || !features.email) return Response.json({ skipped: 'email or database not configured' });

  // One failing half must not stop the other: a campaign that errors should
  // not leave everybody in a drip sequence waiting another day.
  const [campaigns, automations] = await Promise.allSettled([processDueCampaigns(), processAutomations()]);
  return Response.json({
    campaigns: campaigns.status === 'fulfilled' ? campaigns.value : { error: String(campaigns.reason) },
    automations: automations.status === 'fulfilled' ? automations.value : { error: String(automations.reason) },
  });
}
