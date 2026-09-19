'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, BarChart3, Loader2, RefreshCw } from 'lucide-react';
import { Card, KpiGrid, LineChart, RangePicker, type RangeValue } from './parts';
import { rangeLabel } from '@/lib/analyticsTime';

/**
 * Dashboard home: "what needs me now, and how is today going".
 *
 *   To do       things waiting for someone, whatever their date
 *   Headlines   a handful of numbers for the chosen period, each with an (i)
 *   Trend       sales (and visitors) over the period
 *
 * The deep dive — traffic sources, funnel, products, locations — is Analytics.
 */

type Fetcher = (path: string, init?: RequestInit) => Promise<Response>;

const HEADLINES = [
  'revenue', 'orders', 'aov', 'pendingOrders', 'visitors', 'conversionRate', 'liveNow',
  'newCustomers', 'abandonedCarts', 'abandonedValue', 'leads', 'enquiries', 'subscribers',
];
const NO_DELTA = ['liveNow'];
const KEY = 'admin.home.range';

export default function DashboardHome({ authedFetch, allowed, onNavigate, agentLink }: {
  authedFetch: Fetcher; allowed: string[]; onNavigate: (section: string) => void; agentLink?: React.ReactNode;
}) {
  const [range, setRange] = useState<RangeValue>({ range: 'today', from: '', to: '' });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
      if (saved?.range) setRange(saved);
    } catch { /* default */ }
  }, []);

  const load = useCallback(async (r: RangeValue) => {
    setLoading(true); setError('');
    try {
      const q = new URLSearchParams({ range: r.range, ...(r.range === 'custom' ? { from: r.from, to: r.to } : {}) });
      const res = await authedFetch(`/api/admin/summary?${q}`);
      const p = await res.json();
      if (!res.ok) throw new Error(p?.message ?? 'Could not load the dashboard.');
      setData(p.data);
    } catch (err) {
      const m = (err as Error).message;
      if (m !== 'denied') setError(m);
    } finally { setLoading(false); }
  }, [authedFetch]);

  useEffect(() => { void load(range); }, [range, load]);

  const choose = (r: RangeValue) => {
    setRange(r);
    try { localStorage.setItem(KEY, JSON.stringify(r)); } catch { /* ignore */ }
  };

  const compareLabel = range.range === 'today' ? 'yesterday' : range.range === 'yesterday' ? 'the day before' : range.range === 'all' ? '' : 'the period before';
  const periodText = data?.window?.label ?? rangeLabel(range.range);

  return (
    <div className="space-y-6">
      {agentLink}

      <div className="flex flex-wrap items-center gap-2">
        <RangePicker value={range} onChange={choose} />
        <button type="button" onClick={() => void load(range)} title="Refresh" className="btn-secondary">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <p className="text-[0.75rem] text-brand-textMuted">
          Numbers below are for <strong className="text-brand-heading">{periodText}</strong>
          {compareLabel && <> and compared with {compareLabel}</>}. Tap or hover the <span aria-hidden="true">ⓘ</span> on any number to see what it means.
        </p>
        {allowed.includes('analytics') && (
          <button type="button" onClick={() => onNavigate('analytics')} className="btn-secondary ml-auto">
            <BarChart3 className="h-3.5 w-3.5" /> Full analytics <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>

      {error && <p className="border border-action/50 bg-brand-card p-3 text-xs text-brand-body">{error}</p>}
      {!data && loading && <p className="flex items-center gap-2 text-xs text-brand-textMuted"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</p>}

      {data && (
        <div className={`space-y-6 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          {/* To do */}
          <Card title="Needs your attention" help="Things waiting for someone right now, whatever date they came in. Click one to open it.">
            {data.attention?.length ? (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {data.attention.map((a: any) => (
                  <li key={a.id}>
                    <button type="button" onClick={() => onNavigate(a.section)}
                      className="flex w-full items-center gap-3 border border-brand-border bg-brand-dark px-3 py-2.5 text-left hover:border-brand-accent">
                      <span className={`font-display text-xl font-black ${a.tone === 'urgent' ? 'text-action' : 'text-brand-heading'}`}>{a.count}</span>
                      <span className="flex-1 text-xs text-brand-body">{a.label}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-brand-textMuted" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-xs text-brand-textMuted"><AlertCircle className="h-3.5 w-3.5" /> All clear — nothing is waiting.</p>
            )}
          </Card>

          <KpiGrid ids={HEADLINES} kpis={data.kpis ?? {}} compareLabel={compareLabel || 'before'} noDelta={range.range === 'all' ? HEADLINES : NO_DELTA} />

          {data.trackingReady === false && allowed.includes('analytics') && (
            <p className="text-[0.75rem] text-brand-textMuted">Visitor numbers start once migration 0018_visitor_analytics.sql has been run.</p>
          )}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {data.salesSeries && (
              <Card title="Sales" help="Revenue from paid orders in each part of the period. The dashed grey line is the same length of time just before, for comparison.">
                <LineChart points={data.salesSeries.map((p: any) => ({ key: p.key, value: p.revenue, previous: p.previous }))}
                  bucket={data.bucket ?? 'day'} format="money" currentLabel={`Revenue, ${periodText}`} previousLabel="Period before" />
              </Card>
            )}
            {data.trafficSeries && (
              <Card title="Visitors" help="Different people who opened the website in each part of the period.">
                <LineChart points={data.trafficSeries.map((p: any) => ({ key: p.key, value: p.visitors }))}
                  bucket={data.window?.bucket ?? 'day'} format="count" currentLabel={`Visitors, ${periodText}`} />
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
