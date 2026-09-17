import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { clickTarget, siteUrl } from '@/lib/campaignSender';

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
  const target = UUID.test(r) ? clickTarget(url.searchParams.get('u'), r, url.searchParams.get('t')) : null;
  if (!target) return Response.redirect(siteUrl(), 302);

  try {
    const db = getSupabaseAdmin();
    await db.rpc('campaign_track', { p_recipient: r, p_kind: 'click' });
    const { data } = await db.from('campaign_recipients').select('campaign_id, email').eq('id', r).maybeSingle();
    if (data) {
      await db.from('campaign_events').insert({ campaign_id: data.campaign_id, recipient: data.email, event: 'click', detail: target.slice(0, 1000) });
    }
  } catch {
    // The reader still gets where they were going.
  }

  return Response.redirect(target, 302);
}
