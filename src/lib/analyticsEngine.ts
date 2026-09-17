import 'server-only';

import { getSupabaseAdmin } from './supabaseAdmin';
import { BUSINESS } from './env';
import { bucketKeys, bucketOf, previousWindow, resolveWindow, type Window } from './analyticsTime';

/**
 * Works out every Dashboard and Analytics figure for one date range, plus the
 * same figures for the period just before it.
 *
 * Each block is computed only when `may(section)` allows it, so a person who
 * cannot open Orders never receives revenue. A sales agent's order figures are
 * limited to their own orders.
 *
 * Visitor figures need 0018_visitor_analytics.sql; before it they come back as
 * null and `trackingReady` is false.
 */

type Db = ReturnType<typeof getSupabaseAdmin>;
type Row = Record<string, any>;

export interface EngineOptions {
  range: string;
  from?: string | null;
  to?: string | null;
  may: (section: string) => boolean;
  agentId?: string | null;
  /** Dashboard home: headline numbers and to-dos only. */
  light?: boolean;
}

const PAID = new Set(['paid', 'processing', 'shipped', 'delivered']);
const LOST = new Set(['cancelled', 'refunded']);
const ROW_CAP = 20_000;
const LIVE_MS = 5 * 60_000;

async function pages(query: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: { message: string; code?: string } | null }>) {
  const out: Row[] = [];
  for (let from = 0; from < ROW_CAP; from += 1000) {
    const { data, error } = await query(from, from + 999);
    if (error) return { rows: out, error };
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return { rows: out, error: null };
}

const within = (q: any, column: string, w: Window) => {
  let out = q;
  if (w.start) out = out.gte(column, w.start);
  return out.lt(column, w.end);
};

const sum = (rows: Row[], key: string) => rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);
const round2 = (n: number) => Math.round(n * 100) / 100;
const email = (r: Row) => String(r.email ?? '').trim().toLowerCase();

async function count(db: Db, table: string, build: (q: any) => any): Promise<number | null> {
  const { count: c, error } = await build(db.from(table).select('*', { count: 'exact', head: true }));
  return error ? null : c ?? 0;
}

function groupCount<T extends string>(rows: Row[], key: (r: Row) => T | null | undefined, value?: (r: Row) => number) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    map.set(k, (map.get(k) ?? 0) + (value ? value(r) : 1));
  }
  return Array.from(map, ([name, v]) => ({ name, value: round2(v) })).sort((a, b) => b.value - a.value);
}

/* ---------------------------------------------------------------- orders -- */

async function orderBlock(db: Db, w: Window, agentId: string | null | undefined) {
  const run = (win: Window) => pages((a, b) => {
    let q = db.from('orders').select('id, order_number, email, full_name, status, grand_total, discount_total, created_at, referred_by, affiliate_id, shipping_address');
    q = within(q, 'created_at', win);
    if (agentId) q = q.eq('referred_by', agentId);
    return q.order('created_at', { ascending: true }).range(a, b);
  });
  let res = await run(w);
  if (res.error && /affiliate_id|referred_by/.test(res.error.message)) {
    res = await pages((a, b) => within(db.from('orders').select('id, order_number, email, full_name, status, grand_total, discount_total, created_at, shipping_address'), 'created_at', w).range(a, b));
  }
  return res.rows;
}

function orderKpis(orders: Row[]) {
  const paid = orders.filter((o) => PAID.has(o.status));
  const pending = orders.filter((o) => o.status === 'pending');
  const revenue = sum(paid, 'grand_total');
  return {
    revenue: round2(revenue),
    orders: paid.length,
    aov: paid.length ? round2(revenue / paid.length) : 0,
    pendingOrders: pending.length,
    pendingValue: round2(sum(pending, 'grand_total')),
    refunds: orders.filter((o) => LOST.has(o.status)).length,
    discounts: round2(sum(paid, 'discount_total')),
  };
}

/* -------------------------------------------------------------- engine ---- */

export async function computeAnalytics(opts: EngineOptions) {
  const db = getSupabaseAdmin();
  const w = resolveWindow(opts.range, opts.from, opts.to);
  const prev = previousWindow(w);
  const { may, agentId, light } = opts;
  const now = Date.now();

  const kpis: Record<string, { value: number | null; previous: number | null }> = {};
  const set = (id: string, value: number | null | undefined, previous?: number | null) => {
    kpis[id] = { value: value ?? null, previous: previous ?? null };
  };

  const result: Record<string, unknown> = {
    window: w,
    previousWindow: prev,
    generatedAt: new Date().toISOString(),
  };

  /* Orders and customers */
  let paidOrders: Row[] = [];
  let firstSeen = w.start;
  const salesTask = (async () => {
  if (may('orders')) {
    const [orders, before] = await Promise.all([orderBlock(db, w, agentId), prev ? orderBlock(db, prev, agentId) : Promise.resolve(null)]);
    const now_ = orderKpis(orders);
    const was = before ? orderKpis(before) : null;
    for (const [k, v] of Object.entries(now_)) set(k, v, was ? (was as Record<string, number>)[k] : null);
    paidOrders = orders.filter((o) => PAID.has(o.status));
    firstSeen = firstSeen ?? orders[0]?.created_at ?? null;

    // Revenue and orders over time, with the previous period lined up by position.
    const keys = bucketKeys(w, firstSeen);
    const byKey = new Map(keys.map((k) => [k, { key: k, revenue: 0, orders: 0, previous: null as number | null }]));
    for (const o of paidOrders) {
      const b = byKey.get(bucketOf(o.created_at, w.bucket));
      if (b) { b.revenue = round2(b.revenue + Number(o.grand_total || 0)); b.orders += 1; }
    }
    if (before && prev) {
      const prevKeys = bucketKeys(prev);
      const prevTotals = new Map(prevKeys.map((k) => [k, 0]));
      for (const o of before.filter((x) => PAID.has(x.status))) {
        const k = bucketOf(o.created_at, prev.bucket);
        if (prevTotals.has(k)) prevTotals.set(k, (prevTotals.get(k) ?? 0) + Number(o.grand_total || 0));
      }
      const list = Array.from(byKey.values());
      prevKeys.forEach((k, i) => { if (list[i]) list[i].previous = round2(prevTotals.get(k) ?? 0); });
    }
    result.salesSeries = Array.from(byKey.values());
    result.bucket = w.bucket;

    if (!light) {
      result.orderStatus = groupCount(orders, (o) => o.status);
      const hours = Array.from({ length: 24 }, (_, h) => ({ name: String(h), value: 0 }));
      for (const o of paidOrders) {
        const h = Number(new Intl.DateTimeFormat('en-US', { hour: '2-digit', hourCycle: 'h23', timeZone: BUSINESS.timezone }).format(new Date(o.created_at)));
        if (hours[h]) hours[h].value += 1;
      }
      result.ordersByHour = hours;
      result.salesByState = groupCount(paidOrders, (o) => (o.shipping_address?.state ? String(o.shipping_address.state).toUpperCase().slice(0, 30) : 'Unknown'), (o) => Number(o.grand_total || 0)).slice(0, 15);
      result.topCustomers = groupCount(paidOrders, (o) => o.full_name || email(o) || null, (o) => Number(o.grand_total || 0)).slice(0, 10);

      // Who sold it: sales agents and affiliates.
      if (!agentId && paidOrders.some((o) => o.referred_by || o.affiliate_id)) {
        const [{ data: people }, { data: affs }] = await Promise.all([
          db.from('admin_users').select('id, full_name, email'),
          db.from('affiliates').select('id, full_name, email'),
        ]);
        const pName = new Map((people ?? []).map((p: Row) => [p.id, p.full_name || p.email]));
        const aName = new Map((affs ?? []).map((p: Row) => [p.id, p.full_name || p.email]));
        result.salesBySeller = groupCount(paidOrders, (o) =>
          o.referred_by ? `${pName.get(o.referred_by) ?? 'Former team member'} (team)`
            : o.affiliate_id ? `${aName.get(o.affiliate_id) ?? 'Former affiliate'} (affiliate)` : 'Website (no seller)',
        (o) => Number(o.grand_total || 0));
      }

      // Products sold
      if (paidOrders.length) {
        const ids = paidOrders.map((o) => o.id);
        const items: Row[] = [];
        for (let i = 0; i < ids.length; i += 200) {
          const { data } = await db.from('order_items').select('product_slug, product_name, quantity, line_total').in('order_id', ids.slice(i, i + 200));
          items.push(...(data ?? []));
        }
        set('unitsSold', items.reduce((s, it) => s + Number(it.quantity || 0), 0));
        result.productSales = items;
      } else {
        set('unitsSold', 0);
        result.productSales = [];
      }
    }
  }

  if (may('customers') && may('orders') && !agentId) {
    // New vs returning: the first paid order of everyone who bought in the window.
    const buyers = Array.from(new Set(paidOrders.map(email).filter(Boolean)));
    let returning = 0;
    if (buyers.length && w.start) {
      for (let i = 0; i < buyers.length; i += 200) {
        const { data } = await db.from('orders').select('email').in('email', buyers.slice(i, i + 200))
          .in('status', Array.from(PAID)).lt('created_at', w.start);
        returning += new Set((data ?? []).map(email)).size;
      }
    }
    set('newCustomers', buyers.length - returning);
    set('returningCustomers', returning);
    set('repeatRate', pct(returning, buyers.length));
  }

  })();

  const shipTask = (async () => {
  if (may('fulfillment') || may('orders')) {
    set('toShip', await count(db, 'orders', (q) => {
      const base = q.in('status', ['paid', 'processing']);
      return agentId ? base.eq('referred_by', agentId) : base;
    }));
  }

  })();

  let trackingReady = false;
  const visitorTask = (async () => {
  /* Visitors */
  if (may('analytics') && !agentId) {
    const cols = 'session_id, visitor_id, first_seen, last_seen, landing_path, exit_path, source, medium, campaign, device, browser, country, region, city, is_returning, page_views, product_views, add_to_carts, reached_checkout, purchased, order_value';
    const run = (win: Window) => pages((a, b) => within(db.from('visitor_sessions').select(cols), 'first_seen', win).range(a, b));
    const [cur, before] = await Promise.all([run(w), prev ? run(prev) : Promise.resolve(null)]);
    trackingReady = !cur.error;
    if (trackingReady) {
      const visit = (rows: Row[]) => {
        const visits = rows.length;
        const views = sum(rows, 'page_views');
        const secs = rows.map((r) => Math.max(0, (new Date(r.last_seen).getTime() - new Date(r.first_seen).getTime()) / 1000));
        return {
          visitors: new Set(rows.map((r) => r.visitor_id)).size,
          sessions: visits,
          pageViews: views,
          pagesPerVisit: visits ? Math.round((views / visits) * 10) / 10 : 0,
          bounceRate: pct(rows.filter((r) => Number(r.page_views) <= 1).length, visits),
          avgVisit: visits ? Math.round(secs.reduce((s, x) => s + Math.min(x, 3600), 0) / visits) : 0,
          conversionRate: pct(rows.filter((r) => r.purchased).length, visits),
          productViews: sum(rows, 'product_views'),
          addToCarts: sum(rows, 'add_to_carts'),
          checkouts: rows.filter((r) => r.reached_checkout).length,
        };
      };
      const vNow = visit(cur.rows);
      const vWas = before && !before.error ? visit(before.rows) : null;
      for (const [k, v] of Object.entries(vNow)) set(k, v as number | null, vWas ? (vWas as Record<string, number | null>)[k] : null);

      const { data: live } = await db.from('visitor_sessions')
        .select('session_id, current_path, city, region, country, device, source, medium, cart_value, first_seen, last_seen')
        .gte('last_seen', new Date(now - LIVE_MS).toISOString()).order('last_seen', { ascending: false }).limit(50);
      set('liveNow', live?.length ?? 0);
      result.live = live ?? [];

      // Visitors over time
      const keys = bucketKeys(w, w.start ?? cur.rows[0]?.first_seen);
      const vb = new Map(keys.map((k) => [k, { key: k, visitors: new Set<string>(), visits: 0 }]));
      for (const r of cur.rows) {
        const b = vb.get(bucketOf(r.first_seen, w.bucket));
        if (b) { b.visits += 1; b.visitors.add(r.visitor_id); }
      }
      result.trafficSeries = Array.from(vb.values()).map((b) => ({ key: b.key, visitors: b.visitors.size, visits: b.visits }));

      if (!light) {
        result.funnel = [
          { id: 'sessions', label: 'Visited the site', value: vNow.sessions },
          { id: 'product', label: 'Viewed a product', value: cur.rows.filter((r) => Number(r.product_views) > 0).length },
          { id: 'cart', label: 'Added to cart', value: cur.rows.filter((r) => Number(r.add_to_carts) > 0).length },
          { id: 'checkout', label: 'Reached checkout', value: vNow.checkouts },
          { id: 'order', label: 'Placed an order', value: cur.rows.filter((r) => r.purchased).length },
        ];

        const bySource = new Map<string, { name: string; medium: string; visits: number; orders: number; revenue: number }>();
        for (const r of cur.rows) {
          const key = `${r.medium}|${r.source}`;
          const e = bySource.get(key) ?? { name: r.source || 'direct', medium: r.medium || 'direct', visits: 0, orders: 0, revenue: 0 };
          e.visits += 1;
          if (r.purchased) { e.orders += 1; e.revenue = round2(e.revenue + Number(r.order_value || 0)); }
          bySource.set(key, e);
        }
        result.sources = Array.from(bySource.values()).map((s) => ({ ...s, conversion: pct(s.orders, s.visits) })).sort((a, b) => b.visits - a.visits).slice(0, 20);
        result.channels = groupCount(cur.rows, (r) => r.medium || 'direct');
        result.campaigns = groupCount(cur.rows, (r) => r.campaign).slice(0, 15);
        result.devices = groupCount(cur.rows, (r) => r.device);
        result.browsers = groupCount(cur.rows, (r) => r.browser);
        result.countries = groupCount(cur.rows, (r) => r.country).slice(0, 15);
        result.regions = groupCount(cur.rows, (r) => (r.region ? `${r.region}${r.country ? `, ${r.country}` : ''}` : null)).slice(0, 15);
        result.cities = groupCount(cur.rows, (r) => (r.city ? `${r.city}${r.region ? `, ${r.region}` : ''}` : null)).slice(0, 15);
        result.landingPages = groupCount(cur.rows, (r) => String(r.landing_path ?? '').split('?')[0]).slice(0, 15);
        result.exitPages = groupCount(cur.rows, (r) => String(r.exit_path ?? '').split('?')[0]).slice(0, 15);
        result.newVsReturning = [
          { name: 'New visitors', value: cur.rows.filter((r) => !r.is_returning).length },
          { name: 'Returning visitors', value: cur.rows.filter((r) => r.is_returning).length },
        ];

        const events = await pages((a, b) => within(db.from('analytics_events').select('event_name, path, product_slug, value'), 'created_at', w)
          .in('event_name', ['page_view', 'product_view', 'checkout', 'add_to_cart']).range(a, b));
        result.topPages = groupCount(events.rows.filter((e) => e.event_name !== 'add_to_cart'), (e) => String(e.path ?? '').split('?')[0]).slice(0, 20);
        result.productViewsBySlug = groupCount(events.rows.filter((e) => e.event_name === 'product_view'), (e) => e.product_slug);
        result.addToCartBySlug = groupCount(events.rows.filter((e) => e.event_name === 'add_to_cart'), (e) => e.product_slug);
      }
    }
  }
  })();

  const stockTask = (async () => {
  if (may('products')) {
    set('lowStock', await count(db, 'products', (q) => q.eq('is_active', true).gt('stock_count', 0).lt('stock_count', 5)));
    set('outOfStock', await count(db, 'products', (q) => q.eq('is_active', true).lte('stock_count', 0)));
  }

  })();

  const cartTask = (async () => {
  /* Carts */
  if (may('carts') && !agentId) {
    const cartRows = async (win: Window) => (await pages((a, b) => within(db.from('abandoned_carts').select('cart_total, recovered, created_at'), 'created_at', win).range(a, b))).rows;
    const [c, cb] = await Promise.all([cartRows(w), prev ? cartRows(prev) : Promise.resolve(null)]);
    const open = (rows: Row[]) => rows.filter((r) => !r.recovered);
    set('abandonedCarts', open(c).length, cb ? open(cb).length : null);
    set('abandonedValue', round2(sum(open(c), 'cart_total')), cb ? round2(sum(open(cb), 'cart_total')) : null);
    set('recoveredCarts', c.filter((r) => r.recovered).length, cb ? cb.filter((r) => r.recovered).length : null);
  }

  })();

  /* Leads, enquiries, marketing */
  const periodCount = async (table: string, column = 'created_at', extra?: (q: any) => any) => {
    const [nowCount, prevCount] = await Promise.all([
      count(db, table, (q) => within(extra ? extra(q) : q, column, w)),
      prev ? count(db, table, (q) => within(extra ? extra(q) : q, column, prev)) : Promise.resolve(null),
    ]);
    return [nowCount, prevCount] as const;
  };

  const leadTask = (async () => {
  if (may('leads')) {
    const mine = (q: any) => (agentId ? q.eq('owner_id', agentId) : q);
    const [n, p] = await periodCount('leads', 'created_at', mine);
    set('leads', n, p);
    set('openLeads', await count(db, 'leads', (q) => mine(q.in('status', ['new', 'working']))));
    if (!light && !agentId) {
      const { rows } = await pages((a, b) => within(db.from('leads').select('source, status'), 'created_at', w).range(a, b));
      result.leadSources = groupCount(rows, (r) => r.source || 'Not recorded');
      result.leadStatus = groupCount(rows, (r) => r.status);
    }
  }
  })();

  const marketingTask = (async () => {
    if (agentId) return;
    const parts: Promise<void>[] = [];
    if (may('inquiries')) parts.push((async () => {
      const [[n, p], open] = await Promise.all([periodCount('customer_inquiries'), count(db, 'customer_inquiries', (q) => q.eq('status', 'new'))]);
      set('enquiries', n, p);
      set('openEnquiries', open);
    })());
    if (may('subscribers')) parts.push((async () => {
      const [n, p] = await periodCount('newsletter_subscribers', 'created_at', (q) => q.eq('is_subscribed', true));
      set('subscribers', n, p);
    })());
    if (may('reviews')) parts.push((async () => {
      set('pendingReviews', await count(db, 'product_reviews', (q) => q.eq('is_approved', false)));
    })());
    if (may('prospects')) parts.push((async () => {
      const [n, p] = await periodCount('sales_prospects');
      set('prospects', n, p);
    })());
    if (may('campaigns')) parts.push((async () => {
      const rows = (win: Window) => pages((a, b) => within(db.from('campaign_recipients').select('opened_at, clicked_at').eq('status', 'sent'), 'sent_at', win).range(a, b));
      const [c, cb] = await Promise.all([rows(w), prev ? rows(prev) : Promise.resolve(null)]);
      if (c.error) return;
      const rate = (r: Row[], k: string) => pct(r.filter((x) => x[k]).length, r.length);
      const had = cb && !cb.error ? cb.rows : null;
      set('emailsSent', c.rows.length, had ? had.length : null);
      set('openRate', rate(c.rows, 'opened_at'), had ? rate(had, 'opened_at') : null);
      set('clickRate', rate(c.rows, 'clicked_at'), had ? rate(had, 'clicked_at') : null);
      if (!light) {
        const { data } = await db.from('campaigns').select('name, sent_count, open_count, click_count, unsubscribe_count, started_at')
          .eq('channel', 'email').gt('sent_count', 0).order('started_at', { ascending: false }).limit(10);
        result.campaignResults = (data ?? []).map((x: Row) => ({
          name: x.name, sent: x.sent_count, openRate: pct(x.open_count, x.sent_count), clickRate: pct(x.click_count, x.sent_count), unsubscribes: x.unsubscribe_count,
        }));
      }
    })());
    if (may('commissions')) parts.push((async () => {
      const [{ data, error }, { data: aff }] = await Promise.all([
        db.from('sales_commissions').select('amount').in('status', ['pending', 'approved']),
        db.from('affiliate_commissions').select('amount').in('status', ['pending', 'approved']),
      ]);
      if (!error) set('commissionOwed', round2(sum(data ?? [], 'amount') + sum(aff ?? [], 'amount')));
    })());
    await Promise.all(parts);
  })();

  await Promise.all([salesTask, shipTask, visitorTask, stockTask, cartTask, leadTask, marketingTask]);
  result.trackingReady = trackingReady;

  /* Products table: views, carts, sales together */
  if (!light && may('products')) {
    const { data: products } = await db.from('products').select('slug, name, category, stock_count, is_active, price, sale_price');
    const sales = new Map<string, { units: number; revenue: number }>();
    for (const it of (result.productSales as Row[] | undefined) ?? []) {
      const e = sales.get(it.product_slug) ?? { units: 0, revenue: 0 };
      e.units += Number(it.quantity || 0);
      e.revenue = round2(e.revenue + Number(it.line_total || 0));
      sales.set(it.product_slug, e);
    }
    const views = new Map(((result.productViewsBySlug as { name: string; value: number }[]) ?? []).map((v) => [v.name, v.value]));
    const carts = new Map(((result.addToCartBySlug as { name: string; value: number }[]) ?? []).map((v) => [v.name, v.value]));
    result.products = (products ?? []).map((p: Row) => {
      const s = sales.get(p.slug) ?? { units: 0, revenue: 0 };
      const v = views.get(p.slug) ?? 0;
      const c = carts.get(p.slug) ?? 0;
      return {
        slug: p.slug, name: p.name, category: p.category, stock: p.stock_count, live: p.is_active,
        views: v, addToCarts: c, units: s.units, revenue: s.revenue,
        cartRate: pct(c, v),
      };
    }).sort((a: Row, b: Row) => b.revenue - a.revenue || b.views - a.views);
  }
  delete result.productSales;
  delete result.productViewsBySlug;
  delete result.addToCartBySlug;
  result.kpis = kpis;
  return result;
}

/** The to-do list on the Dashboard: things waiting for someone, any date. */
export async function attentionItems(may: (s: string) => boolean, agentId: string | null) {
  const db = getSupabaseAdmin();
  const items: { id: string; label: string; count: number; section: string; tone: 'urgent' | 'normal' }[] = [];
  const jobs: Promise<void>[] = [];
  const add = (id: string, label: string, section: string, table: string, build: (q: any) => any, tone: 'urgent' | 'normal' = 'normal') => {
    if (!may(section)) return;
    const slot = items.length;
    items.push({ id, label, count: 0, section, tone });
    jobs.push(count(db, table, build).then((c) => { items[slot].count = c ?? 0; }));
  };
  const mine = (q: any) => (agentId ? q.eq('referred_by', agentId) : q);
  add('unpaid', 'orders waiting for payment', 'orders', 'orders', (q) => mine(q.eq('status', 'pending')), 'urgent');
  add('ship', 'paid orders to ship', 'orders', 'orders', (q) => mine(q.in('status', ['paid', 'processing'])), 'urgent');
  if (agentId) add('claim', 'orders waiting to be claimed', 'orders', 'orders', (q) => q.is('referred_by', null));
  if (!agentId) {
    add('enquiries', 'unanswered enquiries', 'inquiries', 'customer_inquiries', (q) => q.eq('status', 'new'), 'urgent');
    add('leads', 'new leads to contact', 'leads', 'leads', (q) => q.eq('status', 'new'));
    add('reviews', 'reviews to approve', 'reviews', 'product_reviews', (q) => q.eq('is_approved', false));
    add('out', 'products out of stock', 'products', 'products', (q) => q.eq('is_active', true).lte('stock_count', 0), 'urgent');
    add('low', 'products running low (under 5)', 'products', 'products', (q) => q.eq('is_active', true).gt('stock_count', 0).lt('stock_count', 5));
    add('carts', 'abandoned carts with an email', 'carts', 'abandoned_carts', (q) => q.eq('recovered', false).not('email', 'is', null));
    add('followups', 'prospects due for a follow-up', 'prospects', 'sales_prospects', (q) => q.lte('next_action_at', new Date(Date.now() + 86_400_000).toISOString()).not('stage', 'in', '(won,lost,do_not_contact)'));
    add('commissions', 'commissions waiting for approval', 'commissions', 'sales_commissions', (q) => q.eq('status', 'pending'));
  } else {
    add('myleads', 'of your leads are new', 'leads', 'leads', (q) => q.eq('status', 'new').eq('owner_id', agentId));
  }
  await Promise.all(jobs);
  return items.filter((i) => i.count > 0);
}
