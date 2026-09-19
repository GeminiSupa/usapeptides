'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowDown, ArrowUp, Boxes, FileText, FileX2, ImageOff, LayoutGrid, List, Pencil, Plus, QrCode,
  RefreshCw, Save, Search, Trash2,
} from 'lucide-react';
import { categories } from '@/data/categories';
import ProductImportExport from './ProductImportExport';
import QrCodeModal, { type QrTarget } from './QrCodeModal';

/**
 * The Products tab.
 *
 * Two layouts: a dense list (the default on a laptop, one line per product,
 * sortable) and tiles grouped by category. The choice is remembered per
 * browser. Quick toggles and the stock box write immediately; everything else
 * is behind Edit.
 */

type Fetcher = (path: string, init?: RequestInit) => Promise<Response>;

interface Props {
  rows: Record<string, any>[];
  total: number;
  authedFetch: Fetcher;
  onEdit: (row: Record<string, any>) => void;
  onPatch: (id: string, changes: Record<string, unknown>) => Promise<void> | void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onRefresh: () => void;
}

type View = 'list' | 'tiles';
type SortKey = 'name' | 'category' | 'price' | 'stock_count';

const money = (n: unknown) => `$${Number(n ?? 0).toFixed(2)}`;
const LOW_STOCK = 5;
const VIEW_KEY = 'admin.products.view.v2';

export default function ProductsPanel({ rows, total, authedFetch, onEdit, onPatch, onDelete, onNew, onRefresh }: Props) {
  const [view, setView] = useState<View>('tiles');
  const [filter, setFilter] = useState('all');
  const [text, setText] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'name', asc: true });
  const [stockDrafts, setStockDrafts] = useState<Record<string, number>>({});
  const [qr, setQr] = useState<QrTarget | null>(null);
  const [memberships, setMemberships] = useState<Record<string, string[]>>({});

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(VIEW_KEY);
      if (saved === 'list' || saved === 'tiles') setView(saved);
    } catch { /* storage blocked: keep the default */ }
  }, []);

  useEffect(() => {
    let live = true;
    void authedFetch('/api/admin/categories').then(async (response) => {
      const payload = await response.json().catch(() => null);
      if (!live || !response.ok) return;
      const names = new Map<string, string>((payload.data.categories ?? []).map((category: any) => [category.id, category.name]));
      const next: Record<string, string[]> = {};
      for (const product of payload.data.products ?? []) next[product.id] = (product.category_ids ?? []).map((id: string) => names.get(id)).filter(Boolean);
      setMemberships(next);
    }).catch(() => undefined);
    return () => { live = false; };
  }, [authedFetch, rows]);

  const productCategories = (product: Record<string, any>) => memberships[product.id]?.length ? memberships[product.id] : [String(product.category ?? 'Uncategorised')];

  const changeView = (next: View) => {
    setView(next);
    try { window.localStorage.setItem(VIEW_KEY, next); } catch { /* ignore */ }
  };

  const options = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      for (const name of productCategories(r)) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    const known = categories.map((c) => c.name);
    const extra = Array.from(counts.keys()).filter((c) => !known.includes(c));
    return [...known, ...extra].map((name) => ({ name, count: counts.get(name) ?? 0 })).filter((o) => o.count > 0);
  }, [rows, memberships]);

  const visible = useMemo(() => {
    const q = text.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (filter !== 'all' && !productCategories(r).includes(filter)) return false;
      if (!q) return true;
      return [r.name, r.sku, r.slug, ...productCategories(r)].some((v) => String(v ?? '').toLowerCase().includes(q));
    });
    const dir = sort.asc ? 1 : -1;
    return [...list].sort((a, b) => {
      const key = sort.key;
      if (key === 'price') return (Number(a.sale_price ?? a.price) - Number(b.sale_price ?? b.price)) * dir;
      if (key === 'stock_count') return (Number(a.stock_count ?? 0) - Number(b.stock_count ?? 0)) * dir;
      return String(a[key] ?? '').localeCompare(String(b[key] ?? '')) * dir;
    });
  }, [rows, filter, text, sort, memberships]);

  const grouped = useMemo(() => {
    const byCategory = new Map<string, Record<string, any>[]>();
    for (const r of visible) {
      for (const name of productCategories(r)) {
        if (!byCategory.has(name)) byCategory.set(name, []);
        byCategory.get(name)!.push(r);
      }
    }
    const order = [...categories.map((c) => c.name), ...Array.from(byCategory.keys())];
    const seen = new Set<string>();
    const groups: { name: string; items: Record<string, any>[] }[] = [];
    for (const name of order) {
      if (seen.has(name) || !byCategory.has(name)) continue;
      seen.add(name);
      groups.push({ name, items: byCategory.get(name)! });
    }
    return groups;
  }, [visible]);

  const withoutImage = rows.filter((r) => !r.image).length;
  const withoutCoa = rows.filter((r) => !r.coa_url).length;
  const lowStock = rows.filter((r) => Number(r.stock_count ?? 0) < LOW_STOCK).length;

  const openQr = (p: Record<string, any>) => setQr({
    title: p.name,
    subtitle: p.sku ? `SKU ${p.sku}` : undefined,
    url: `${window.location.origin}/product/${p.slug}`,
    filename: `qr-${p.slug}`,
  });

  /* ------------------------------------------------------------ pieces --- */

  const thumb = (p: Record<string, any>, size: string) => (
    <div className={`${size} flex-shrink-0 border border-brand-border bg-white p-0.5`}>
      {p.image ? (
        <img src={p.image} alt="" loading="lazy" className="h-full w-full object-contain" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-brand-textMuted" title="No photo">
          <ImageOff className="h-3.5 w-3.5" />
        </div>
      )}
    </div>
  );

  const stockBox = (p: Record<string, any>) => {
    const low = Number(p.stock_count ?? 0) < LOW_STOCK;
    const draft = stockDrafts[p.id];
    const dirty = draft !== undefined && draft !== Number(p.stock_count ?? 0);
    const saveStock = async () => {
      await onPatch(p.id, { stock_count: draft });
      setStockDrafts((prev) => { const next = { ...prev }; delete next[p.id]; return next; });
    };
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="number" min="0" aria-label={`Stock for ${p.name}`}
          value={draft ?? Number(p.stock_count ?? 0)}
          onChange={(e) => setStockDrafts((prev) => ({ ...prev, [p.id]: Math.max(0, Number(e.target.value)) }))}
          onKeyDown={(e) => { if (e.key === 'Enter' && dirty) void saveStock(); }}
          className={`w-16 border bg-brand-dark px-2 py-1 text-[0.8125rem] focus:outline-none ${
            low ? 'border-action text-action' : 'border-brand-border text-brand-heading focus:border-brand-accent'}`}
        />
        {dirty && (
          <button onClick={() => void saveStock()} title="Save stock"
            className="inline-flex items-center gap-1 border border-brand-borderLight px-1.5 py-1 text-[0.6875rem] font-bold uppercase text-brand-heading hover:border-brand-accent">
            <Save className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  };

  const toggles = (p: Record<string, any>) => (
    <div className="flex flex-wrap items-center gap-1">
      {([['is_active', 'Live'], ['is_featured', 'Featured']] as const).map(([key, label]) => (
        <button key={key} onClick={() => onPatch(p.id, { [key]: !p[key] })}
          title={p[key] ? `Turn ${label.toLowerCase()} off` : `Turn ${label.toLowerCase()} on`}
          className={`chip transition-colors ${p[key] ? 'bg-brand-accent text-brand-onAccent' : 'border border-brand-borderLight text-brand-textMuted hover:text-brand-heading'}`}>
          {label}
        </button>
      ))}
    </div>
  );

  const coa = (p: Record<string, any>) => (
    <span title={p.coa_url ? 'Certificate uploaded' : 'No certificate yet'}
      className={`inline-flex items-center gap-1 text-[0.6875rem] font-black uppercase tracking-[0.1em] ${p.coa_url ? 'text-brand-accentGlow' : 'text-brand-textMuted'}`}>
      {p.coa_url ? <FileText className="h-3 w-3" /> : <FileX2 className="h-3 w-3" />} COA
    </span>
  );

  const actions = (p: Record<string, any>) => (
    <div className="flex items-center justify-end gap-1">
      <button onClick={() => openQr(p)} title="QR code" className="p-1.5 text-brand-textMuted hover:text-brand-heading">
        <QrCode className="h-3.5 w-3.5" />
      </button>
      <button onClick={() => onEdit(p)}
        className="inline-flex items-center gap-1 border border-brand-borderLight px-2 py-1 font-display text-[0.6875rem] font-black uppercase tracking-[0.1em] text-brand-body transition-colors hover:border-brand-accent hover:text-brand-accentGlow">
        <Pencil className="h-2.5 w-2.5" /> Edit
      </button>
      <button onClick={() => onDelete(p.id)} title="Delete product" className="p-1.5 text-brand-textMuted hover:text-action">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  const price = (p: Record<string, any>) => (
    <span className="whitespace-nowrap">
      <span className="font-display font-black text-brand-heading">{money(p.sale_price ?? p.price)}</span>
      {p.sale_price != null && <span className="ml-1.5 font-mono text-[0.75rem] text-brand-textMuted line-through">{money(p.price)}</span>}
    </span>
  );

  const tile = (p: Record<string, any>) => (
    <article key={p.id} className={`group flex flex-col border bg-brand-card transition-colors hover:border-brand-borderLight ${p.is_active ? 'border-brand-border' : 'border-dashed border-brand-borderLight opacity-75'}`}>
      <div className="flex flex-wrap gap-1 border-b border-brand-border px-3 py-2">{productCategories(p).slice(0, 2).map((name) => <span key={name} className="chip border border-brand-borderLight text-brand-textMuted">{name}</span>)}{productCategories(p).length > 2 && <span className="chip text-brand-textMuted">+{productCategories(p).length - 2}</span>}</div>
      <div className="flex gap-4 p-4">
        {thumb(p, 'h-28 w-28')}
        <div className="min-w-0 flex-1 py-1">
          <button onClick={() => onEdit(p)} className="line-clamp-2 text-left font-display text-sm font-black leading-snug text-brand-heading hover:text-brand-accentGlow" title={p.name}>{p.name}</button>
          <p className="mt-1 truncate font-mono text-[0.6875rem] text-brand-textMuted">{p.sku || 'No SKU'} · /{p.slug}</p>
          <div className="mt-3 text-base">{price(p)}</div>
          <div className="mt-3">{coa(p)}</div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-brand-border px-3 py-2">
        <span className="eyebrow">Stock</span>
        {stockBox(p)}
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-brand-border px-3 py-2">
        {toggles(p)}
        {coa(p)}
        <div className="ml-auto">{actions(p)}</div>
      </div>
    </article>
  );

  const sortHead = (key: SortKey, label: string, className = '') => (
    <th className={`px-3 py-2.5 ${className}`}>
      <button onClick={() => setSort((s) => ({ key, asc: s.key === key ? !s.asc : true }))}
        className="inline-flex items-center gap-1 font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.12em] text-brand-textMuted hover:text-brand-heading">
        {label}
        {sort.key === key && (sort.asc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </th>
  );

  const plainHead = (label: string, className = '') => (
    <th className={`px-3 py-2.5 font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.12em] text-brand-textMuted ${className}`}>{label}</th>
  );

  const listView = (
    <div className="overflow-x-auto border border-brand-border bg-brand-card">
      <table className="w-full min-w-[56rem] text-left text-xs">
        <thead className="border-b border-brand-border">
          <tr>
            {sortHead('name', 'Product')}
            {sortHead('category', 'Category')}
            {sortHead('price', 'Price', 'text-right')}
            {sortHead('stock_count', 'Stock')}
            {plainHead('Status')}
            {plainHead('Files')}
            {plainHead('', 'w-40')}
          </tr>
        </thead>
        <tbody>
          {visible.map((p) => (
            <tr key={p.id} className={`border-b border-brand-border/60 last:border-b-0 hover:bg-brand-dark ${p.is_active ? '' : 'opacity-70'}`}>
              <td className="px-3 py-2">
                <div className="flex items-center gap-3">
                  {thumb(p, 'h-10 w-10')}
                  <div className="min-w-0">
                    <button onClick={() => onEdit(p)} className="block max-w-[22rem] truncate text-left font-semibold text-brand-heading hover:underline" title={p.name}>
                      {p.name}
                    </button>
                    <p className="truncate font-mono text-[0.6875rem] text-brand-textMuted">{p.sku || 'no SKU'} · /{p.slug}</p>
                  </div>
                </div>
              </td>
              <td className="max-w-[18rem] px-3 py-3 text-brand-body"><div className="flex flex-wrap gap-1">{productCategories(p).map((name) => <span key={name} className="chip border border-brand-borderLight text-brand-textMuted">{name}</span>)}</div></td>
              <td className="px-3 py-2 text-right">{price(p)}</td>
              <td className="px-3 py-2">{stockBox(p)}</td>
              <td className="px-3 py-2">{toggles(p)}</td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  {coa(p)}
                  {!p.image && <span className="text-[0.6875rem] font-black uppercase tracking-[0.1em] text-brand-textMuted">No photo</span>}
                </div>
              </td>
              <td className="px-3 py-2">{actions(p)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const tilesView = filter !== 'all' || text ? (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{visible.map(tile)}</div>
  ) : (
    <div className="space-y-7">
      {grouped.map((group) => (
        <section key={group.name}>
          <h2 className="mb-3 flex items-baseline gap-2 border-b border-brand-border pb-2">
            <span className="font-display text-xs font-extrabold uppercase tracking-[0.1em] text-brand-heading">{group.name}</span>
            <span className="text-[0.75rem] text-brand-textMuted">{group.items.length}</span>
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{group.items.map(tile)}</div>
        </section>
      ))}
    </div>
  );

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-center justify-between gap-4 border border-brand-border bg-brand-card p-5">
        <div><p className="eyebrow">Store catalogue</p><h2 className="mt-1 font-display text-lg font-black text-brand-heading">Products</h2><p className="mt-1 text-xs text-brand-textMuted">Manage pricing, inventory, visibility, certificates and product details.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <ProductImportExport authedFetch={authedFetch} onImported={onRefresh} />
          <button onClick={onRefresh} className="btn-secondary"><RefreshCw className="h-3.5 w-3.5" /> Refresh</button>
          <button onClick={onNew} className="btn-primary px-3 py-2"><Plus className="h-3.5 w-3.5" /> New product</button>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon={Boxes} label="All products" value={total} />
        <Metric icon={AlertTriangle} label="Low stock" value={lowStock} alert={lowStock > 0} />
        <Metric icon={ImageOff} label="Missing photo" value={withoutImage} alert={withoutImage > 0} />
        <Metric icon={FileX2} label="Missing certificate" value={withoutCoa} alert={withoutCoa > 0} />
      </div>

      <div className="flex flex-wrap items-center gap-3 border border-brand-border bg-brand-card p-4">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-textMuted" />
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Find by name, SKU or category"
            className="field-input pl-8" />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Category" className="field-input w-full sm:w-auto sm:max-w-xs">
          <option value="all">All categories ({rows.length})</option>
          {options.map((o) => <option key={o.name} value={o.name}>{o.name} ({o.count})</option>)}
        </select>
        <div className="hidden border border-brand-borderLight md:flex" role="group" aria-label="Layout">
          {([['list', List, 'List'], ['tiles', LayoutGrid, 'Tiles']] as const).map(([id, Icon, label]) => (
            <button key={id} onClick={() => changeView(id)} aria-pressed={view === id} title={`${label} view`}
              className={`flex items-center gap-1.5 px-3 py-2 font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.1em] ${
                view === id ? 'bg-brand-accent text-brand-onAccent' : 'text-brand-body hover:text-brand-heading'}`}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="border border-brand-border bg-brand-card p-10 text-center text-xs text-brand-textMuted">No products match.</p>
      ) : view === 'list' ? (
        // The list is a wide table; phones always get the tiles.
        <><div className="md:hidden">{tilesView}</div><div className="hidden md:block">{listView}</div></>
      ) : tilesView}

      {qr && <QrCodeModal target={qr} onClose={() => setQr(null)} />}
    </div>
  );
}

function Metric({ icon: Icon, label, value, alert = false }: { icon: typeof Boxes; label: string; value: number; alert?: boolean }) {
  return <div className="flex items-center gap-3 border border-brand-border bg-brand-card p-4"><span className={`flex h-9 w-9 items-center justify-center border ${alert ? 'border-action/60 text-action' : 'border-brand-borderLight text-brand-accentGlow'}`}><Icon className="h-4 w-4" /></span><div><p className="font-display text-xl font-black text-brand-heading">{value}</p><p className="text-[0.6875rem] uppercase tracking-[0.1em] text-brand-textMuted">{label}</p></div></div>;
}
