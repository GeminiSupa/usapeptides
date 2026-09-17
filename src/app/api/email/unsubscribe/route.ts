import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { siteUrl, verifyLink } from '@/lib/campaignSender';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Unsubscribe from a campaign email.
 *   GET   the link in the footer: unsubscribes, then shows the confirmation page
 *   POST  one-click unsubscribe from the mail app (RFC 8058)
 * The link is signed per recipient, so nobody can unsubscribe someone else.
 */
async function unsubscribe(req: Request): Promise<boolean> {
  const url = new URL(req.url);
  const r = url.searchParams.get('r') ?? '';
  if (!UUID.test(r) || !verifyLink(url.searchParams.get('t'), 'u', r)) return false;

  const db = getSupabaseAdmin();
  const { data } = await db.from('campaign_recipients').select('campaign_id, email, unsubscribed_at').eq('id', r).maybeSingle();
  if (!data) return true; // a test email: nothing to record

  const email = String(data.email).toLowerCase();
  const now = new Date().toISOString();
  await db.from('email_suppressions').upsert({ email, reason: 'unsubscribed', campaign_id: data.campaign_id }, { onConflict: 'email', ignoreDuplicates: true });
  await db.from('newsletter_subscribers').update({ is_subscribed: false, unsubscribed_at: now }).eq('email', email);
  await db.from('customer_profiles').update({ marketing_opt_in: false }).eq('email', email);

  if (!data.unsubscribed_at) {
    await db.from('campaign_recipients').update({ unsubscribed_at: now }).eq('id', r);
    const { count } = await db.from('campaign_recipients').select('id', { count: 'exact', head: true })
      .eq('campaign_id', data.campaign_id).not('unsubscribed_at', 'is', null);
    await db.from('campaigns').update({ unsubscribe_count: count ?? 0 }).eq('id', data.campaign_id);
  }
  return true;
}

export async function GET(req: Request) {
  const done = await unsubscribe(req).catch(() => false);
  return Response.redirect(`${siteUrl()}/unsubscribe?${done ? 'done=1' : 'invalid=1'}`, 302);
}

export async function POST(req: Request) {
  const done = await unsubscribe(req).catch(() => false);
  return new Response(null, { status: done ? 200 : 400 });
}
