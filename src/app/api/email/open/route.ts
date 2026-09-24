import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyLink } from '@/lib/campaignSender';

export const dynamic = 'force-dynamic';

const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The 1x1 picture at the bottom of a campaign or automation email. Counts an
 * open. `r` is a campaign recipient, `a` an automation send - signed with
 * different letters so one token can never be replayed against the other.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const r = url.searchParams.get('r') ?? '';
  const a = url.searchParams.get('a') ?? '';
  const token = url.searchParams.get('t');
  try {
    if (UUID.test(r) && verifyLink(token, 'o', r)) {
      await getSupabaseAdmin().rpc('campaign_track', { p_recipient: r, p_kind: 'open' });
    } else if (UUID.test(a) && verifyLink(token, 'ao', a)) {
      await getSupabaseAdmin().rpc('automation_track', { p_send: a, p_kind: 'open' });
    }
  } catch {
    // Never break the image over a counter.
  }
  return new Response(GIF, {
    headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
  });
}
