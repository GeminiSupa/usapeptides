import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyLink } from '@/lib/campaignSender';

export const dynamic = 'force-dynamic';

const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The 1x1 picture at the bottom of a campaign email. Counts an open. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const r = url.searchParams.get('r') ?? '';
  if (UUID.test(r) && verifyLink(url.searchParams.get('t'), 'o', r)) {
    try {
      await getSupabaseAdmin().rpc('campaign_track', { p_recipient: r, p_kind: 'open' });
    } catch {
      // Never break the image over a counter.
    }
  }
  return new Response(GIF, {
    headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
  });
}
