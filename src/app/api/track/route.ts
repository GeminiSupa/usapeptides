import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { features } from '@/lib/env';
import { readJson } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * POST /api/track — the storefront reporting what a visitor does.
 *
 * Public by necessity, so it trusts nothing: event names come from a fixed
 * list, every string is cut short, ids must look like the ids the tracker
 * makes, bots are ignored, and nothing here can read data back. Location comes
 * from Vercel's own request headers (country / region / city), never from the
 * browser, and no IP address is stored.
 *
 * Events:
 *   page_view     a page opened (product page and checkout are recognised from the path)
 *   heartbeat     still here, every 30 seconds while the tab is visible
 *   add_to_cart   { slug, qty, value }
 *   cart          the whole cart, so abandoned carts can be followed up
 *   interaction   a click/tap on a link or button (never a form value)
 */

const EVENTS = new Set(['page_view', 'heartbeat', 'add_to_cart', 'cart', 'interaction']);
const ID = /^[A-Za-z0-9_-]{8,80}$/;
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|axios|node-fetch/i;

const clip = (v: unknown, n: number) => String(v ?? '').slice(0, n);
const nothing = () => new Response(null, { status: 204 });

function device(ua: string) {
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) return 'tablet';
  if (/mobi|iphone|android/i.test(ua)) return 'mobile';
  return 'desktop';
}

function browser(ua: string) {
  if (/edg\//i.test(ua)) return 'Edge';
  if (/opr\/|opera/i.test(ua)) return 'Opera';
  if (/chrome|crios/i.test(ua)) return 'Chrome';
  if (/firefox|fxios/i.test(ua)) return 'Firefox';
  if (/safari/i.test(ua)) return 'Safari';
  return 'Other';
}

const SOCIAL = /facebook|instagram|t\.co|twitter|x\.com|linkedin|pinterest|reddit|tiktok|youtube|lnkd/i;
const SEARCH = /google\.|bing\.|duckduckgo|yahoo\.|ecosia|brave\.|perplexity|chatgpt|openai/i;

/** Where the visit came from, in words a person uses. */
function sourceOf(referrer: string, utm: { source: string; medium: string }, siteHost: string) {
  if (utm.source) {
    const medium = utm.medium || (/mail/i.test(utm.source) ? 'email' : 'campaign');
    return { source: utm.source.toLowerCase(), medium: medium.toLowerCase() };
  }
  let host = '';
  try { host = new URL(referrer).hostname.replace(/^www\./, ''); } catch { /* none */ }
  if (!host || host === siteHost) return { source: 'direct', medium: 'direct' };
  if (/chatgpt|openai|perplexity|claude|gemini|copilot/i.test(host)) return { source: host, medium: 'ai' };
  if (SEARCH.test(host)) return { source: host.split('.')[0], medium: 'organic' };
  if (SOCIAL.test(host)) return { source: host.split('.')[0], medium: 'social' };
  return { source: host, medium: 'referral' };
}

const decodeHeader = (v: string | null) => {
  if (!v) return null;
  try { return decodeURIComponent(v).slice(0, 80); } catch { return v.slice(0, 80); }
};

export async function POST(req: Request) {
  if (!features.adminDatabase) return nothing();
  const ua = req.headers.get('user-agent') ?? '';
  if (!ua || BOT.test(ua)) return nothing();

  const body = await readJson<Record<string, unknown>>(req);
  if (!body) return nothing();
  const type = String(body.type);
  const sessionId = String(body.sessionId ?? '');
  const visitorId = String(body.visitorId ?? '');
  if (!EVENTS.has(type) || !ID.test(sessionId) || !ID.test(visitorId)) return nothing();

  const rawPath = clip(body.path, 300);
  const path = rawPath.startsWith('/') ? rawPath : '/';
  if (path.startsWith('/admin')) return nothing();
  const pathname = path.split('?')[0];

  const db = getSupabaseAdmin();

  try {
    let customerId: string | null = null;
    const bearer = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (bearer) {
      const { data: authData } = await db.auth.getUser(bearer);
      if (authData.user) {
        const { data: customer } = await db.from('customer_profiles').select('id').eq('user_id', authData.user.id).maybeSingle();
        customerId = customer?.id ?? null;
      }
    }

    // First contact creates the visit.
    if (type === 'page_view') {
      const { data: existing } = await db.from('visitor_sessions').select('session_id').eq('session_id', sessionId).maybeSingle();
      if (!existing) {
        const siteHost = (() => { try { return new URL(req.url).hostname.replace(/^www\./, ''); } catch { return ''; } })();
        const src = sourceOf(clip(body.referrer, 500), { source: clip(body.utmSource, 80), medium: clip(body.utmMedium, 80) }, siteHost);
        const { count: before } = await db.from('visitor_sessions').select('session_id', { count: 'exact', head: true }).eq('visitor_id', visitorId);
        await db.from('visitor_sessions').insert({
          session_id: sessionId,
          visitor_id: visitorId,
          landing_path: path,
          current_path: path,
          exit_path: path,
          referrer: clip(body.referrer, 500) || null,
          source: src.source,
          medium: src.medium,
          campaign: clip(body.utmCampaign, 120) || null,
          device: device(ua),
          browser: browser(ua),
          country: decodeHeader(req.headers.get('x-vercel-ip-country')),
          region: decodeHeader(req.headers.get('x-vercel-ip-country-region')),
          city: decodeHeader(req.headers.get('x-vercel-ip-city')),
          is_returning: (before ?? 0) > 0,
        });
      }
    }

    // A session may have started before sign-in. Attach it as soon as a valid
    // customer token appears; the service-role client still verifies the JWT.
    if (customerId) {
      await db.from('visitor_sessions').update({ customer_id: customerId })
        .eq('session_id', sessionId).eq('visitor_id', visitorId);
    }

    const productSlug = pathname.startsWith('/product/') ? clip(pathname.slice(9), 120) : type === 'add_to_cart' ? clip(body.slug, 120) : null;
    const isProductView = type === 'page_view' && pathname.startsWith('/product/');
    const isCheckout = type === 'page_view' && pathname === '/checkout';
    const qty = Math.max(1, Math.min(1000, Math.round(Number(body.qty) || 1)));
    const value = Number(body.value);
    const cartValue = type === 'cart' && Number.isFinite(value) && value >= 0 ? Math.round(value * 100) / 100 : null;

    await db.rpc('track_session', {
      p_session: sessionId,
      p_visitor: visitorId,
      p_path: type === 'page_view' ? path : null,
      p_page_view: type === 'page_view' ? 1 : 0,
      p_product_view: isProductView ? 1 : 0,
      p_add_to_cart: type === 'add_to_cart' ? qty : 0,
      p_checkout: isCheckout,
      p_cart_value: cartValue,
    });

    if (type === 'page_view' || type === 'add_to_cart' || type === 'interaction') {
      const interaction = type === 'interaction' ? {
        label: clip(body.label, 120),
        element: clip(body.element, 20),
        href: clip(body.href, 200),
        input: ['mouse', 'touch', 'pen', 'keyboard'].includes(String(body.input)) ? String(body.input) : 'other',
        zone: /^(Top|Middle|Bottom) (Left|Center|Right)$/.test(String(body.zone)) ? String(body.zone) : 'Unknown',
      } : {};
      await db.from('analytics_events').insert({
        event_name: isProductView ? 'product_view' : isCheckout ? 'checkout' : type,
        session_id: sessionId,
        visitor_id: visitorId,
        path,
        referrer: type === 'page_view' ? clip(body.referrer, 500) || null : null,
        product_slug: productSlug || null,
        value: type === 'add_to_cart' && Number.isFinite(value) ? Math.round(value * 100) / 100 : null,
        payload: { title: clip(body.title, 160), ...(type === 'add_to_cart' ? { qty } : {}), ...interaction },
      });
    }

    // Order placed: the checkout sends people to /checkout/success?order=…
    if (type === 'page_view' && pathname === '/checkout/success') {
      const orderNumber = clip(new URLSearchParams(path.split('?')[1] ?? '').get('order'), 60);
      const { data: order } = orderNumber
        ? await db.from('orders').select('order_number, grand_total, created_at').eq('order_number', orderNumber).maybeSingle()
        : { data: null };
      // Only an order placed in the last hour can be claimed by a visit, so a
      // shared success link cannot pin someone else's order on this session.
      if (order && Date.now() - new Date(order.created_at).getTime() < 3_600_000) {
        await db.from('visitor_sessions').update({ purchased: true, order_number: order.order_number, order_value: order.grand_total, cart_value: 0 })
          .eq('session_id', sessionId).eq('visitor_id', visitorId);
        await db.from('abandoned_carts').update({ recovered: true, updated_at: new Date().toISOString() }).eq('session_id', visitorId);
      }
    }

    if (type === 'cart') {
      const items = (Array.isArray(body.items) ? body.items : []).slice(0, 50).map((i) => {
        const it = (i && typeof i === 'object' ? i : {}) as Record<string, unknown>;
        return { slug: clip(it.slug, 120), name: clip(it.name, 160), qty: Math.max(1, Math.min(1000, Math.round(Number(it.qty) || 1))), price: Number(it.price) || 0 };
      }).filter((i) => i.slug);
      if (items.length) {
        const email = clip(body.email, 320).toLowerCase();
        // Keyed by visitor, not visit: a cart outlives a 30-minute idle gap.
        await db.from('abandoned_carts').upsert({
          session_id: visitorId,
          items,
          cart_total: cartValue ?? 0,
          recovered: false,
          ...(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { email } : {}),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'session_id' });
      } else {
        // Emptied by hand: nothing left to recover.
        await db.from('abandoned_carts').delete().eq('session_id', visitorId).eq('recovered', false);
      }
    }
  } catch {
    // Tracking must never break the shop.
  }
  return nothing();
}
