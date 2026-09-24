import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { automationClickTarget, clickTarget, siteUrl } from '@/lib/campaignSender';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A tracked link in a campaign email. Counts the click, then sends the reader
 * on. Only the exact address that was signed when the email was built is
 * accepted, so this cannot be used to bounce people to another site.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const r = url.searchParams.get('r') ?? '';
  const a = url.searchParams.get('a') ?? '';
  const u = url.searchParams.get('u');
  const t = url.searchParams.get('t');

  const target = UUID.test(r) ? clickTarget(u, r, t)
    : UUID.test(a) ? automationClickTarget(u, a, t)
    : null;
  if (!target) return Response.redirect(siteUrl(), 302);

  try {
    const db = getSupabaseAdmin();
    if (UUID.test(r)) {
      await db.rpc('campaign_track', { p_recipient: r, p_kind: 'click' });
      const { data } = await db.from('campaign_recipients').select('campaign_id, email').eq('id', r).maybeSingle();
      if (data) {
        await db.from('campaign_events').insert({ campaign_id: data.campaign_id, recipient: data.email, event: 'click', detail: target.slice(0, 1000) });
      }
    } else {
      await db.rpc('automation_track', { p_send: a, p_kind: 'click' });
    }
  } catch {
    // The reader still gets where they were going.
  }

  return Response.redirect(target, 302);
}
