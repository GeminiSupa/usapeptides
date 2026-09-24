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
  const a = url.searchParams.get('a') ?? '';
  const token = url.searchParams.get('t');

  if (UUID.test(a) && verifyLink(token, 'au', a)) return unsubscribeAutomation(a);
  if (!UUID.test(r) || !verifyLink(token, 'u', r)) return false;

  const db = getSupabaseAdmin();
  const { data } = await db.from('campaign_recipients').select('campaign_id, email, unsubscribed_at').eq('id', r).maybeSingle();
  if (!data) return true; // a test email: nothing to record

  const email = String(data.email).toLowerCase();
  const now = new Date().toISOString();
  await suppress(email, data.campaign_id);

  if (!data.unsubscribed_at) {
    await db.from('campaign_recipients').update({ unsubscribed_at: now }).eq('id', r);
    const { count } = await db.from('campaign_recipients').select('id', { count: 'exact', head: true })
      .eq('campaign_id', data.campaign_id).not('unsubscribed_at', 'is', null);
    await db.from('campaigns').update({ unsubscribe_count: count ?? 0 }).eq('id', data.campaign_id);
  }
  return true;
}

/** The do-not-email list, plus the two lists somebody may have arrived from. */
async function suppress(email: string, campaignId: string | null) {
  const db = getSupabaseAdmin();
  const now = new Date().toISOString();
  await db.from('email_suppressions').upsert(
    { email, reason: 'unsubscribed', ...(campaignId ? { campaign_id: campaignId } : {}) },
    { onConflict: 'email', ignoreDuplicates: true }
  );
  await db.from('newsletter_subscribers').update({ is_subscribed: false, unsubscribed_at: now }).eq('email', email);
  await db.from('customer_profiles').update({ marketing_opt_in: false }).eq('email', email);
}

/**
 * Unsubscribing from an automation email also stops every sequence that person
 * is part-way through. Suppression alone would stop the sends, but leaving the
 * enrollment running makes the dashboard lie about who is still in it.
 */
async function unsubscribeAutomation(sendId: string): Promise<boolean> {
  const db = getSupabaseAdmin();
  const { data } = await db.from('email_automation_sends')
    .select('email, unsubscribed_at').eq('id', sendId).maybeSingle();
  if (!data) return true; // a test email: nothing to record

  const email = String(data.email).toLowerCase();
  const now = new Date().toISOString();
  await suppress(email, null);
  if (!data.unsubscribed_at) {
    await db.from('email_automation_sends').update({ unsubscribed_at: now }).eq('id', sendId);
  }
  await db.from('email_automation_enrollments')
    .update({ status: 'stopped', stopped_reason: 'Unsubscribed', completed_at: now, claimed_at: null })
    .eq('email', email).eq('status', 'active');
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
