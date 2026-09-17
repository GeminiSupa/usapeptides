'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Download, Loader2, RefreshCw } from 'lucide-react';
import { BarList, Card, Columns, Funnel, InfoTip, KpiGrid, LineChart, RangePicker, type RangeValue } from './insights/parts';
import { KPI, formatKpi } from '@/lib/kpis';
import { exportSheet, stamp, type SheetFormat } from '@/lib/sheetFiles';

/**
 * Analytics: how the business is doing over time, and why.
 *
 * The Dashboard is the daily to-do list; this is the report. Everything on the
 * page follows the one period picker at the top and is compared with the same
 * length of time just before.
 */

type Fetcher = (path: string, init?: RequestInit) => Promise<Response>;

const SECTIONS = [
  { id: 'an-overview', label: 'Overview' },
  { id: 'an-sales', label: 'Sales' },
  { id: 'an-traffic', label: 'Visitors & sources' },
  { id: 'an-funnel', label: 'Funnel' },
  { id: 'an-products', label: 'Products' },
  { id: 'an-marketing', label: 'Marketing' },
  { id: 'an-live', label: 'Live now' },
];

const OVERVIEW = ['revenue', 'orders', 'aov', 'conversionRate', 'visitors', 'sessions', 'newCustomers', 'repeatRate', 'abandonedValue', 'leads', 'openRate', 'liveNow'];
const SALES = ['revenue', 'orders', 'aov', 'unitsSold', 'discounts', 'pendingOrders', 'pendingValue', 'refunds', 'toShip', 'newCustomers', 'returningCustomers', 'repeatRate'];
const TRAFFIC = ['visitors', 'sessions', 'pageViews', 'pagesPerVisit', 'bounceRate', 'avgVisit'];
const FUNNEL = ['productViews', 'addToCarts', 'checkouts', 'conversionRate', 'abandonedCarts', 'abandonedValue', 'recoveredCarts'];
const MARKETING = ['leads', 'openLeads', 'enquiries', 'openEnquiries', 'subscribers', 'emailsSent', 'openRate', 'clickRate', 'prospects', 'commissionOwed'];
const NO_DELTA = ['liveNow', 'toShip', 'openLeads', 'openEnquiries', 'commissionOwed'];

const MEDIUM: Record<string, string> = {
  direct: 'Direct (typed the address / bookmark)', organic: 'Search engines', social: 'Social media', referral: 'Other websites',
  email: 'Email', cpc: 'Paid ads', campaign: 'Tagged campaign links', ai: 'AI assistants (ChatGPT etc.)',
};
const hourLabel = (h: string) => { const n = Number(h); return n % 6 === 0 ? `${n % 12 || 12}${n < 12 ? 'a' : 'p'}` : ''; };

export default function AnalyticsPanel({ authedFetch }: { authedFetch: Fetcher }) {
  const [range, setRange] = useState<RangeValue>({ range: '30d', from: '', to: '' });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [menu, setMenu] = useState(false);

  const load = useCallback(async (r: RangeValue) => {
    setLoading(true); setError('');
    try {
      const q = new URLSearchParams({ range: r.range, ...(r.range === 'custom' ? { from: r.from, to: r.to } : {}) });
      const res = await authedFetch(`/api/admin/analytics?${q}`);
      const p = await res.json();
      if (!res.ok) throw new Error(p?.message ?? 'Could not load analytics.');
      setData(p.data);
    } catch (err) {
      const m = (err as Error).message;
      if (m !== 'denied') setError(m);
    } finally { setLoading(false); }
  }, [authedFetch]);

  useEffect(() => { void load(range); }, [range, load]);

  // Looking at today: keep "Live now" and today's numbers fresh every minute.
  useEffect(() => {
    if (range.range !== 'today') return;
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') void load(range); }, 60_000);
    return () => window.clearInterval(t);
  }, [range, load]);

  const compare = range.range === 'all' ? '' : range.range === 'today' ? 'yesterday' : 'the period before';
  const period = data?.window?.label ?? '';
  const kpis = data?.kpis ?? {};
  const noDelta = range.range === 'all' ? Object.keys(kpis) : NO_DELTA;

  const doExport = async (format: SheetFormat) => {
    setMenu(false);
    if (!data) return;
    const rows: (string | number)[][] = [];
    for (const [id, v] of Object.entries(kpis) as [string, { value: number | null; previous: number | null }][]) {
      const def = KPI[id];
      if (!def) continue;
      rows.push(['Headline', def.label, formatKpi(v.value, def.format), v.previous === null ? '' : formatKpi(v.previous, def.format)]);
    }
    const table = (name: string, list?: { name: string; value: number }[]) => (list ?? []).forEach((r) => rows.push([name, r.name, r.value, '']));
    table('Traffic source (visits)', (data.sources ?? []).map((s: any) => ({ name: `${s.name} (${s.medium})`, value: s.visits })));
    table('Top pages (views)', data.topPages);
    table('Devices (visits)', data.devices);
    table('Cities (visits)', data.cities);
    table('Sales by state ($)', data.salesByState);
    (data.products ?? []).forEach((p: any) => rows.push(['Product', p.name, `${p.views} views · ${p.addToCarts} carts · ${p.units} sold`, `$${p.revenue}`]));
    await exportSheet(format, {
      filename: `analytics-${range.range}-${stamp()}`,
      title: `Analytics — ${period}`,
      headers: ['Section', 'Item', 'Value', `Before (${compare || 'n/a'})`],
      rows,
    }, `${period} · exported ${new Date().toLocaleString()}`);
  };

  return (
    <div className="space-y-5">
      <div className="sticky top-0 z-30 -mx-3 flex flex-wrap items-center gap-2 border-b border-brand-border bg-brand-dark/95 px-3 py-2 backdrop-blur sm:-mx-5 sm:px-5 lg:-mx-8 lg:px-8">
        <RangePicker value={range} onChange={setRange} />
        <button type="button" onClick={() => void load(range)} title="Refresh" className="btn-secondary">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <div className="relative">
          <button type="button" className="btn-secondary" disabled={!data} onClick={() => setMenu((m) => !m)}><Download className="h-3.5 w-3.5" /> Export</button>
          {menu && (
            <div className="absolute left-0 z-40 mt-1 w-40 border border-brand-border bg-brand-card py-1">
              {([['xlsx', 'Excel'], ['csv', 'CSV'], ['pdf', 'PDF report']] as const).map(([id, l]) => (
                <button key={id} type="button" onClick={() => void doExport(id)} className="block w-full px-3 py-2 text-left text-xs hover:bg-brand-dark">{l}</button>
              ))}
            </div>
          )}
        </div>
        <nav className="flex flex-wrap gap-1 text-[0.6875rem]" aria-label="Sections">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="border border-transparent px-2 py-1 font-display font-extrabold uppercase tracking-[0.08em] text-brand-textMuted hover:border-brand-borderLight hover:text-brand-heading">{s.label}</a>
          ))}
        </nav>
      </div>

      <p className="text-[0.75rem] text-brand-textMuted">
        Showing <strong className="text-brand-heading">{period || '…'}</strong>{compare && <>, compared with {compare}</>}.
        The Dashboard is your daily to-do list; this page is the report. Hover any <span aria-hidden="true">ⓘ</span> for a plain-English explanation.
      </p>

      {error && <p className="border border-action/50 bg-brand-card p-3 text-xs text-brand-body">{error}</p>}
      {!data && loading && <p className="flex items-center gap-2 text-xs text-brand-textMuted"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Crunching the numbers…</p>}

      {data && (
        <div className={`space-y-8 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          {!data.trackingReady && (
            <p className="border border-action/50 bg-brand-card p-3 text-xs text-brand-body">
              Visitor tracking needs <strong>supabase/migrations/0018_visitor_analytics.sql</strong>. Run it in the Supabase SQL editor; visitor numbers start counting from then.
            </p>
          )}

          <Section id="an-overview" title="Overview">
            <KpiGrid ids={OVERVIEW} kpis={kpis} compareLabel={compare} noDelta={noDelta} />
            <div className="grid gap-4 xl:grid-cols-2">
              {data.salesSeries && (
                <Card title="Revenue over time" help="Revenue from paid orders in each part of the period. The dashed grey line is the period before.">
                  <LineChart points={data.salesSeries.map((p: any) => ({ key: p.key, value: p.revenue, previous: p.previous }))} bucket={data.window.bucket} format="money" currentLabel="Revenue" previousLabel="Period before" />
                </Card>
              )}
              {data.trafficSeries && (
                <Card title="Visitors over time" help="Different people who opened the site in each part of the period.">
                  <LineChart points={data.trafficSeries.map((p: any) => ({ key: p.key, value: p.visitors }))} bucket={data.window.bucket} format="count" currentLabel="Visitors" />
                </Card>
              )}
            </div>
          </Section>

          {data.salesSeries && (
            <Section id="an-sales" title="Sales">
              <KpiGrid ids={SALES} kpis={kpis} compareLabel={compare} noDelta={noDelta} />
              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                <Card title="Orders over time" help="Paid orders in each part of the period.">
                  <LineChart points={data.salesSeries.map((p: any) => ({ key: p.key, value: p.orders }))} bucket={data.window.bucket} format="count" currentLabel="Paid orders" height={180} />
                </Card>
                <Card title="Order status" help="Every order placed in the period, by where it is now.">
                  <BarList rows={data.orderStatus} empty="No orders in this period." />
                </Card>
                <Card title="When people order" help="Paid orders by hour of the day (business time zone). Useful for timing emails and posts.">
                  <Columns rows={data.ordersByHour} labelFor={hourLabel} />
                </Card>
                <Card title="Sales by state" help="Revenue by the shipping state on the order.">
                  <BarList rows={data.salesByState} format="money" empty="No paid orders." />
                </Card>
                <Card title="Top customers" help="Who spent the most in this period.">
                  <BarList rows={data.topCustomers} format="money" empty="No paid orders." />
                </Card>
                {data.salesBySeller && (
                  <Card title="Sales by seller" help="Revenue credited to each sales agent or affiliate, and orders that came straight from the website.">
                    <BarList rows={data.salesBySeller} format="money" />
                  </Card>
                )}
              </div>
            </Section>
          )}

          {data.trackingReady && (
            <>
              <Section id="an-traffic" title="Visitors & sources">
                <KpiGrid ids={TRAFFIC} kpis={kpis} compareLabel={compare} noDelta={noDelta} />
                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  <Card title="How people found you" help="The kind of place each visit came from. 'Direct' means the address was typed, bookmarked, or the source was hidden by the app.">
                    <BarList rows={data.channels} labelFor={(n) => MEDIUM[n] ?? n} empty="No visits yet." />
                  </Card>
                  <Card title="Sources that sell" help="Each source with its visits, orders and conversion rate — where your buyers actually come from." className="xl:col-span-2">
                    <SourcesTable rows={data.sources} />
                  </Card>
                  <Card title="Most viewed pages" help="Pages opened most often in the period.">
                    <BarList rows={data.topPages} empty="No page views yet." />
                  </Card>
                  <Card title="Landing pages" help="The first page people saw — what brings them in.">
                    <BarList rows={data.landingPages} empty="No visits yet." />
                  </Card>
                  <Card title="Exit pages" help="The last page people saw before leaving. A checkout page high here means people give up at checkout.">
                    <BarList rows={data.exitPages} empty="No visits yet." />
                  </Card>
                  <Card title="Devices" help="Phone, tablet or computer.">
                    <BarList rows={data.devices} labelFor={(n) => n[0].toUpperCase() + n.slice(1)} />
                    <div className="mt-4"><BarList rows={data.newVsReturning} /></div>
                  </Card>
                  <Card title="Browsers" help="Which web browser visitors used.">
                    <BarList rows={data.browsers} />
                  </Card>
                  <Card title="Campaign links" help="Visits from links tagged with utm_campaign (email campaigns tag theirs automatically).">
                    <BarList rows={data.campaigns} empty="No tagged links used yet." />
                  </Card>
                  <Card title="Countries" help="Where visitors are, from the network they browse on. Approximate.">
                    <BarList rows={data.countries} empty="No location data yet." />
                  </Card>
                  <Card title="States / regions" help="Approximate region of each visit.">
                    <BarList rows={data.regions} empty="No location data yet." />
                  </Card>
                  <Card title="Cities" help="Approximate city of each visit.">
                    <BarList rows={data.cities} empty="No location data yet." />
                  </Card>
                </div>
              </Section>

              <Section id="an-funnel" title="Funnel — from visit to order">
                <KpiGrid ids={FUNNEL} kpis={kpis} compareLabel={compare} noDelta={noDelta} />
                <Card title="Where visitors drop off" help="Visits that reached each step. The % is how many of the step before made it this far — the lowest % is where to improve first.">
                  <Funnel steps={data.funnel} />
                </Card>
              </Section>
            </>
          )}

          {data.products && (
            <Section id="an-products" title="Products">
              <Card title="Product performance" help="For each product: page views, add-to-carts, how many of the viewers added it (cart rate), units sold and revenue in the period.">
                <ProductsTable rows={data.products} tracking={data.trackingReady} />
              </Card>
            </Section>
          )}

          <Section id="an-marketing" title="Marketing & sales team">
            <KpiGrid ids={MARKETING} kpis={kpis} compareLabel={compare} noDelta={noDelta} />
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {data.leadSources && (
                <Card title="Where leads come from" help="New leads in the period by source (contact form, chat, prospector, manual…).">
                  <BarList rows={data.leadSources} empty="No leads in this period." />
                </Card>
              )}
              {data.leadStatus && (
                <Card title="Lead status" help="Where this period's new leads are now.">
                  <BarList rows={data.leadStatus} empty="No leads in this period." />
                </Card>
              )}
              {data.campaignResults && (
                <Card title="Recent email campaigns" help="The last ten sent campaigns with open and click rates (all time, not just this period).">
                  {data.campaignResults.length ? (
                    <table className="w-full text-left text-xs">
                      <thead><tr className="text-brand-textMuted"><th className="py-1">Campaign</th><th>Sent</th><th>Opened</th><th>Clicked</th></tr></thead>
                      <tbody>{data.campaignResults.map((c: any) => (
                        <tr key={c.name} className="border-t border-brand-border/60"><td className="max-w-[10rem] truncate py-1.5">{c.name}</td><td className="font-mono">{c.sent}</td><td className="font-mono">{c.openRate ?? '—'}%</td><td className="font-mono">{c.clickRate ?? '—'}%</td></tr>
                      ))}</tbody>
                    </table>
                  ) : <p className="text-xs text-brand-textMuted">No campaigns sent yet.</p>}
                </Card>
              )}
            </div>
          </Section>

          {data.trackingReady && (
            <Section id="an-live" title="Live now" help="Visits active in the last 5 minutes, newest first. With Today selected it refreshes every minute.">
              <LiveTable rows={data.live} />
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ id, title, help, children }: { id: string; title: string; help?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-16 space-y-4">
      <h2 className="flex items-center gap-1 border-b border-brand-border pb-2 font-display text-base font-extrabold uppercase tracking-[0.06em] text-brand-heading">
        {title}{help && <InfoTip text={help} />}
      </h2>
      {children}
    </section>
  );
}

function SourcesTable({ rows }: { rows?: any[] }) {
  if (!rows?.length) return <p className="text-xs text-brand-textMuted">No visits yet.</p>;
  return (
    <div className="max-h-80 overflow-auto pr-3">
      <table className="w-full min-w-[28rem] text-left text-xs">
        <thead className="sticky top-0 bg-brand-card text-brand-textMuted">
          <tr><th className="py-1.5">Source</th><th>Type</th><th className="text-right">Visits</th><th className="text-right">Orders</th><th className="text-right">Conversion</th><th className="text-right">Revenue</th></tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={`${s.medium}${s.name}`} className="border-t border-brand-border/60">
              <td className="max-w-[12rem] truncate py-1.5 font-semibold text-brand-heading">{s.name}</td>
              <td className="text-brand-textMuted">{MEDIUM[s.medium]?.split(' (')[0] ?? s.medium}</td>
              <td className="text-right font-mono">{s.visits}</td>
              <td className="text-right font-mono">{s.orders}</td>
              <td className="text-right font-mono">{s.conversion ?? 0}%</td>
              <td className="text-right font-mono">{formatKpi(s.revenue, 'money')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductsTable({ rows, tracking }: { rows: any[]; tracking: boolean }) {
  const [sort, setSort] = useState<'revenue' | 'views' | 'addToCarts' | 'units' | 'cartRate'>('revenue');
  const sorted = [...rows].sort((a, b) => Number(b[sort] ?? -1) - Number(a[sort] ?? -1));
  const head = (key: typeof sort, label: string, help: string) => (
    <th className="text-right">
      <button type="button" onClick={() => setSort(key)} title={help}
        className={`font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.08em] ${sort === key ? 'text-brand-heading underline' : 'text-brand-textMuted'}`}>{label}</button>
    </th>
  );
  return (
    <div className="max-h-[32rem] overflow-auto pr-3">
      <table className="w-full min-w-[40rem] text-left text-xs">
        <thead className="sticky top-0 bg-brand-card">
          <tr>
            <th className="py-1.5 font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.08em] text-brand-textMuted">Product</th>
            {tracking && head('views', 'Views', 'Product page opened')}
            {tracking && head('addToCarts', 'Carts', 'Added to cart')}
            {tracking && head('cartRate', 'Cart rate', 'Add-to-carts per 100 views')}
            {head('units', 'Sold', 'Units in paid orders')}
            {head('revenue', 'Revenue', 'Line totals in paid orders')}
            <th className="text-right font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.08em] text-brand-textMuted">Stock</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.slug} className={`border-t border-brand-border/60 ${p.live ? '' : 'opacity-60'}`}>
              <td className="max-w-[18rem] truncate py-1.5"><span className="font-semibold text-brand-heading">{p.name}</span></td>
              {tracking && <td className="text-right font-mono">{p.views}</td>}
              {tracking && <td className="text-right font-mono">{p.addToCarts}</td>}
              {tracking && <td className="text-right font-mono">{p.cartRate === null ? '—' : `${p.cartRate}%`}</td>}
              <td className="text-right font-mono">{p.units}</td>
              <td className="text-right font-mono">{formatKpi(p.revenue, 'money')}</td>
              <td className={`text-right font-mono ${Number(p.stock) < 5 ? 'text-action' : ''}`}>{p.stock}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LiveTable({ rows }: { rows?: any[] }) {
  if (!rows?.length) return <p className="border border-brand-border bg-brand-card p-6 text-center text-xs text-brand-textMuted">Nobody on the site right now.</p>;
  return (
    <div className="overflow-x-auto border border-brand-border bg-brand-card">
      <table className="w-full min-w-[40rem] text-left text-xs">
        <thead className="text-brand-textMuted"><tr><th className="px-3 py-2">Page now</th><th>From</th><th>Where</th><th>Device</th><th className="text-right">Cart</th><th className="px-3 text-right">On site</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.session_id} className="border-t border-brand-border/60">
              <td className="max-w-[16rem] truncate px-3 py-1.5 font-mono text-brand-heading">{String(r.current_path ?? '').split('?')[0]}</td>
              <td>{r.source}</td>
              <td>{[r.city, r.region, r.country].filter(Boolean).join(', ') || '—'}</td>
              <td className="capitalize">{r.device}</td>
              <td className="text-right font-mono">{Number(r.cart_value) > 0 ? formatKpi(Number(r.cart_value), 'money') : '—'}</td>
              <td className="px-3 text-right font-mono">{formatKpi((new Date(r.last_seen).getTime() - new Date(r.first_seen).getTime()) / 1000, 'duration')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
