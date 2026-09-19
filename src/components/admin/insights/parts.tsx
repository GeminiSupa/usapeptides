'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Calendar, Check, ChevronDown, Info, Minus } from 'lucide-react';
import { KPI, formatKpi, type KpiFormat } from '@/lib/kpis';
import { RANGES, bucketLabel, change, rangeLabel } from '@/lib/analyticsTime';

/**
 * Building blocks for the Dashboard and Analytics: the (i) explanation, the
 * number tile, the period picker, and simple charts drawn as SVG in the brand
 * colours (one colour per chart — see the dataviz notes in docs/TODO.md).
 */

/* ------------------------------------------------------------- InfoTip --- */

/** A small (i). Hover, keyboard focus or a tap shows what the number means. */
export function InfoTip({ text, label = 'What does this mean?' }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<'left' | 'right' | 'center'>('center');
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);

  // Keep the box on screen near either edge.
  useEffect(() => {
    if (!open || !ref.current) return;
    const { left, right } = ref.current.getBoundingClientRect();
    setSide(left < 150 ? 'left' : window.innerWidth - right < 150 ? 'right' : 'center');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', esc); };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-label={label} aria-describedby={open ? id : undefined}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-brand-textMuted hover:text-brand-heading focus:text-brand-heading focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent">
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && (
        <span role="tooltip" id={id}
          className={`absolute top-full z-50 mt-1 w-64 ${side === 'left' ? 'left-0' : side === 'right' ? 'right-0' : 'left-1/2 -translate-x-1/2'} border border-brand-border bg-navy px-3 py-2 text-left text-[0.75rem] font-normal normal-case leading-relaxed tracking-normal text-cream`}>
          {text}
        </span>
      )}
    </span>
  );
}

/* ----------------------------------------------------------- KpiTile ---- */

export interface KpiValue { value: number | null; previous: number | null }

export function Delta({ value, previous, lowerIsBetter, compareLabel }: { value: number | null; previous: number | null; lowerIsBetter?: boolean; compareLabel: string }) {
  if (value === null || previous === null) return <span className="text-[0.6875rem] text-brand-textMuted">no earlier data</span>;
  const c = change(value, previous);
  if (c === null) return <span className="text-[0.6875rem] text-brand-textMuted">new — nothing {compareLabel}</span>;
  const up = c > 0;
  const flat = c === 0;
  const good = flat ? null : up !== Boolean(lowerIsBetter);
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    // Plain inline text, not a flex row: in a narrow card the words wrap as a
    // sentence instead of being squeezed into separate columns.
    <span className={`text-[0.6875rem] font-bold leading-snug ${good === null ? 'text-brand-textMuted' : good ? 'text-forest-600' : 'text-action'}`}
      title={`Was ${previous.toLocaleString('en-US')} ${compareLabel}`}>
      <span className="whitespace-nowrap"><Icon className="mr-0.5 inline h-3.5 w-3.5 align-[-0.2em]" aria-hidden="true" />
        {flat ? 'no change' : `${up ? '+' : ''}${c}%`}</span>
      <span className="font-normal text-brand-textMuted"> vs {compareLabel}</span>
    </span>
  );
}

export function KpiTile({ id, data, compareLabel, onClick, hideDelta }: {
  id: string; data?: KpiValue; compareLabel: string; onClick?: () => void; hideDelta?: boolean;
}) {
  const def = KPI[id];
  if (!def || !data) return null;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={`flex min-w-0 flex-col items-start gap-1 border border-brand-border bg-brand-card p-3 text-left sm:p-4 ${onClick ? 'hover:bg-brand-cardHover' : ''}`}>
      <span className="flex items-center gap-1">
        <span className="eyebrow">{def.label}</span>
        <InfoTip text={def.help} label={`What "${def.label}" means`} />
      </span>
      <span className="font-display text-2xl font-black text-brand-heading">{formatKpi(data.value, def.format)}</span>
      {!hideDelta && <Delta value={data.value} previous={data.previous} lowerIsBetter={def.lowerIsBetter} compareLabel={compareLabel} />}
    </Tag>
  );
}

export function KpiGrid({ ids, kpis, compareLabel, noDelta = [] }: {
  ids: string[]; kpis: Record<string, KpiValue>; compareLabel: string; noDelta?: string[];
}) {
  const shown = ids.filter((id) => kpis[id]);
  if (!shown.length) return null;
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
      {shown.map((id) => <KpiTile key={id} id={id} data={kpis[id]} compareLabel={compareLabel} hideDelta={noDelta.includes(id)} />)}
    </div>
  );
}

/* -------------------------------------------------------- RangePicker --- */

export interface RangeValue { range: string; from: string; to: string }

export function RangePicker({ value, onChange, options = RANGES.map((r) => r.id) }: {
  value: RangeValue; onChange: (v: RangeValue) => void; options?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(value.from);
  const [to, setTo] = useState(value.to);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  const label = value.range === 'custom' && value.from && value.to ? `${value.from} → ${value.to}` : rangeLabel(value.range);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex min-h-10 items-center gap-2 border border-brand-borderLight bg-brand-card px-3 font-display text-[0.75rem] font-extrabold uppercase tracking-[0.08em] text-brand-heading hover:border-brand-accent">
        <Calendar className="h-3.5 w-3.5" /> {label} <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute left-0 z-50 mt-1 w-64 border border-brand-border bg-brand-card py-1">
          {options.filter((o) => o !== 'custom').map((id) => (
            <button key={id} type="button" onClick={() => { onChange({ range: id, from: '', to: '' }); setOpen(false); }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-brand-body hover:bg-brand-dark">
              {rangeLabel(id)}
              {value.range === id && <Check className="h-4 w-4 text-brand-heading" strokeWidth={3} />}
            </button>
          ))}
          {options.includes('custom') && (
            <div className="mt-1 space-y-2 border-t border-brand-border px-3 py-2">
              <p className="field-label mb-0">Custom dates</p>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" className="field-input min-h-8 px-2 py-1 text-xs" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
                <input type="date" className="field-input min-h-8 px-2 py-1 text-xs" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="To" />
              </div>
              <button type="button" disabled={!from || !to} className="btn-primary w-full px-3 py-1.5 disabled:opacity-50"
                onClick={() => { onChange({ range: 'custom', from, to }); setOpen(false); }}>Apply</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------- LineChart ---- */

export interface SeriesPoint { key: string; value: number; previous?: number | null }

/**
 * One line (forest) over time, with the period before as a thin dashed grey
 * line when available. Hovering anywhere snaps to the nearest point.
 */
export function LineChart({ points, bucket, format, height = 220, currentLabel, previousLabel }: {
  points: SeriesPoint[]; bucket: 'hour' | 'day' | 'month'; format: KpiFormat; height?: number;
  currentLabel: string; previousLabel?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<SVGSVGElement>(null);
  const W = 800;
  const H = height;
  const pad = { l: 56, r: 12, t: 12, b: 28 };
  const hasPrev = points.some((p) => p.previous !== null && p.previous !== undefined);
  const max = Math.max(1, ...points.map((p) => p.value), ...(hasPrev ? points.map((p) => p.previous ?? 0) : []));
  const nice = niceMax(max);
  const x = (i: number) => pad.l + (points.length <= 1 ? (W - pad.l - pad.r) / 2 : (i / (points.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / nice) * (H - pad.t - pad.b);
  const path = (get: (p: SeriesPoint) => number | null | undefined) =>
    points.map((p, i) => { const v = get(p); return v === null || v === undefined ? '' : `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`; }).join(' ');
  const ticks = [0, 0.5, 1].map((f) => f * nice);
  const labelEvery = Math.max(1, Math.ceil(points.length / 8));

  const move = (e: React.PointerEvent) => {
    const rect = box.current!.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  };

  if (!points.length) return <p className="py-10 text-center text-xs text-brand-textMuted">No data in this period.</p>;
  const h = hover !== null ? points[hover] : null;

  return (
    <div className="relative">
      <svg ref={box} viewBox={`0 0 ${W} ${H}`} className="h-auto w-full touch-none" role="img"
        aria-label={`${currentLabel} over time`} onPointerMove={move} onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="currentColor" className="text-brand-border" strokeWidth={1} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="fill-brand-textMuted" fontSize={11}>{formatKpi(t, format)}</text>
          </g>
        ))}
        {points.map((p, i) => (i % labelEvery === 0 || i === points.length - 1) && (
          <text key={p.key} x={x(i)} y={H - 8} textAnchor="middle" className="fill-brand-textMuted" fontSize={11}>{bucketLabel(p.key, bucket)}</text>
        ))}
        {hasPrev && <path d={path((p) => p.previous)} fill="none" stroke="#9aa39e" strokeWidth={1.5} strokeDasharray="4 4" />}
        <path d={path((p) => p.value)} fill="none" stroke="#1F4233" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.length <= 45 && points.map((p, i) => <circle key={p.key} cx={x(i)} cy={y(p.value)} r={hover === i ? 5 : 2.5} fill="#1F4233" stroke="#FDFBF0" strokeWidth={2} />)}
        {h && hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="#233049" strokeWidth={1} />}
      </svg>
      <div className="mt-1 flex flex-wrap gap-4 text-[0.6875rem] text-brand-textMuted">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-forest" /> {currentLabel}</span>
        {hasPrev && previousLabel && <span className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-[#9aa39e]" /> {previousLabel}</span>}
      </div>
      {h && hover !== null && (
        <div className="pointer-events-none absolute top-0 z-10 border border-brand-border bg-brand-card px-3 py-2 text-xs"
          style={{ left: `clamp(0px, calc(${(x(hover) / W) * 100}% - 70px), calc(100% - 150px))` }}>
          <p className="text-brand-textMuted">{bucketLabel(h.key, bucket)}</p>
          <p className="font-display text-sm font-black text-brand-heading">{formatKpi(h.value, format)}</p>
          {hasPrev && h.previous !== null && h.previous !== undefined && <p className="text-brand-textMuted">before: {formatKpi(h.previous, format)}</p>}
        </div>
      )}
    </div>
  );
}

function niceMax(v: number) {
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp;
}

/* ----------------------------------------------------------- BarList ---- */

/** Ranked horizontal bars with the number written beside each. */
export function BarList({ rows, format = 'count', empty = 'Nothing yet.', max = 10, labelFor }: {
  rows?: { name: string; value: number }[]; format?: KpiFormat; empty?: string; max?: number; labelFor?: (name: string) => string;
}) {
  const [all, setAll] = useState(false);
  const list = rows ?? [];
  const shown = all ? list : list.slice(0, max);
  const top = Math.max(1, ...list.map((r) => r.value));
  const total = list.reduce((s, r) => s + r.value, 0);
  if (!list.length) return <p className="py-4 text-xs text-brand-textMuted">{empty}</p>;
  return (
    <div className="space-y-1.5">
      {shown.map((r) => (
        <div key={r.name} className="group" title={`${labelFor ? labelFor(r.name) : r.name}: ${formatKpi(r.value, format)}${total ? ` (${Math.round((r.value / total) * 100)}%)` : ''}`}>
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="min-w-0 truncate text-brand-body group-hover:text-brand-heading">{labelFor ? labelFor(r.name) : r.name}</span>
            <span className="flex-shrink-0 font-mono text-brand-heading">
              {formatKpi(r.value, format)}
              {format === 'count' && total > 0 && <span className="ml-1.5 text-brand-textMuted">{Math.round((r.value / total) * 100)}%</span>}
            </span>
          </div>
          <div className="mt-0.5 h-1.5 bg-brand-dark">
            <div className="h-1.5 rounded-r-sm bg-forest group-hover:bg-forest-600" style={{ width: `${Math.max(1.5, (r.value / top) * 100)}%` }} />
          </div>
        </div>
      ))}
      {list.length > max && (
        <button type="button" className="text-[0.6875rem] text-brand-textMuted underline" onClick={() => setAll((a) => !a)}>
          {all ? 'Show fewer' : `Show all ${list.length}`}
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ Funnel ---- */

export function Funnel({ steps }: { steps?: { id: string; label: string; value: number }[] }) {
  if (!steps?.length) return <p className="py-4 text-xs text-brand-textMuted">No visits in this period.</p>;
  const first = Math.max(1, steps[0].value);
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].value : null;
        const kept = prev ? Math.round((s.value / Math.max(1, prev)) * 1000) / 10 : null;
        return (
          <li key={s.id} className="grid grid-cols-[9rem_minmax(0,1fr)_6rem] items-center gap-3 text-xs"
            title={`${s.label}: ${s.value.toLocaleString('en-US')}${kept !== null ? ` — ${kept}% of the step before` : ''}`}>
            <span className="text-brand-body">{s.label}</span>
            <div className="h-6 bg-brand-dark">
              <div className="flex h-6 items-center rounded-r-sm bg-forest px-2 font-mono text-[0.6875rem] text-cream" style={{ width: `${Math.max(3, (s.value / first) * 100)}%` }}>
                {s.value.toLocaleString('en-US')}
              </div>
            </div>
            <span className="text-right text-brand-textMuted">
              {kept === null ? '' : <>{kept}% <span className="hidden xl:inline">kept</span></>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------- Column chart --- */

export function Columns({ rows, labelFor, format = 'count' }: { rows?: { name: string; value: number }[]; labelFor?: (n: string) => string; format?: KpiFormat }) {
  const list = useMemo(() => rows ?? [], [rows]);
  const top = Math.max(1, ...list.map((r) => r.value));
  if (!list.some((r) => r.value)) return <p className="py-4 text-xs text-brand-textMuted">Nothing yet.</p>;
  return (
    <div className="flex h-32 items-end gap-[2px]">
      {list.map((r) => (
        <div key={r.name} className="group flex h-full flex-1 flex-col justify-end" title={`${labelFor ? labelFor(r.name) : r.name}: ${formatKpi(r.value, format)}`}>
          <div className="rounded-t-sm bg-forest group-hover:bg-forest-600" style={{ height: `${(r.value / top) * 100}%`, minHeight: r.value ? 2 : 0 }} />
          <span className="mt-1 text-center text-[0.5625rem] text-brand-textMuted">{labelFor ? labelFor(r.name) : r.name}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------- Donut chart --- */

export function DonutChart({ rows, labelFor, centerLabel = 'Total' }: {
  rows?: { name: string; value: number }[]; labelFor?: (name: string) => string; centerLabel?: string;
}) {
  const list = (rows ?? []).filter((row) => row.value > 0);
  const total = list.reduce((sum, row) => sum + row.value, 0);
  if (!total) return <p className="py-4 text-xs text-brand-textMuted">Nothing yet.</p>;
  let offset = 0;
  return (
    <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[9rem_minmax(0,1fr)]">
      <svg viewBox="0 0 120 120" className="mx-auto h-36 w-36" role="img" aria-label={`${centerLabel}: ${total.toLocaleString('en-US')}`}>
        <circle cx="60" cy="60" r="43" fill="none" stroke="currentColor" strokeWidth="18" className="text-brand-dark" />
        {list.map((row, index) => {
          const length = (row.value / total) * 100;
          const node = <circle key={row.name} cx="60" cy="60" r="43" fill="none" stroke="#1F4233" strokeOpacity={Math.max(.32, 1 - index * .14)} strokeWidth="18" pathLength="100" strokeDasharray={`${length} ${100 - length}`} strokeDashoffset={-offset} transform="rotate(-90 60 60)" />;
          offset += length;
          return node;
        })}
        <text x="60" y="57" textAnchor="middle" className="fill-brand-heading" fontSize="16" fontWeight="800">{total.toLocaleString('en-US')}</text>
        <text x="60" y="72" textAnchor="middle" className="fill-brand-textMuted" fontSize="8">{centerLabel}</text>
      </svg>
      <div className="space-y-2">
        {list.map((row, index) => (
          <div key={row.name} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex min-w-0 items-center gap-2 text-brand-body"><span className="h-2.5 w-2.5 flex-none bg-forest" style={{ opacity: Math.max(.32, 1 - index * .14) }} /><span className="truncate">{labelFor ? labelFor(row.name) : row.name}</span></span>
            <span className="font-mono text-brand-heading">{row.value.toLocaleString('en-US')} <span className="text-brand-textMuted">{Math.round((row.value / total) * 100)}%</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Card({ title, help, children, className = '', action }: { title: string; help?: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <section className={`border border-brand-border bg-brand-card p-4 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1 font-display text-[0.8125rem] font-extrabold uppercase tracking-[0.08em] text-brand-heading">
          {title}{help && <InfoTip text={help} />}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}
