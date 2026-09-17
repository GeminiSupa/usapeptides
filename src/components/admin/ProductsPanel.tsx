'use client';

import React, { useMemo, useState } from 'react';
import { Pencil, FileText, FileX2, ImageOff, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { categories } from '@/data/categories';

/**
 * The Products tab.
 *
 * Grouped by category, because a flat list of every peptide is not something
 * anyone can find anything in, and filterable to one category from the
 * dropdown. Each card shows at a glance whether the product has a photo and a
 * certificate, since those are the two things that are usually missing.
 *
 * The quick toggles and the stock box write immediately. Everything else is
 * behind Edit, which opens the full form.
 */

interface Props {
  rows: Record<string, any>[];
  total: number;
  onEdit: (row: Record<string, any>) => void;
  onPatch: (id: string, changes: Record<string, unknown>) => Promise<void> | void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onRefresh: () => void;
}

const money = (n: unknown) => `$${Number(n ?? 0).toFixed(2)}`;

const LOW_STOCK = 5;

export default function ProductsPanel({ rows, total, onEdit, onPatch, onDelete, onNew, onRefresh }: Props) {
  const [filter, setFilter] = useState('all');
  const [stockDrafts, setStockDrafts] = useState<Record<string, number>>({});

  /** Categories that actually hold products, plus every one on offer. */
  const options = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const name = String(r.category ?? 'Uncategorised');
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    const known = categories.map((c) => c.name);
    const extra = Array.from(counts.keys()).filter((c) => !known.includes(c));
    return [...known, ...extra].map((name) => ({ name, count: counts.get(name) ?? 0 }));
  }, [rows]);

  const visible = filter === 'all' ? rows : rows.filter((r) => String(r.category ?? '') === filter);

  /** Only the groups with something in them, in catalogue order. */
  const grouped = useMemo(() => {
    const byCategory = new Map<string, Record<string, any>[]>();
    for (const r of visible) {
      const name = String(r.category ?? 'Uncategorised');
      if (!byCategory.has(name)) byCategory.set(name, []);
      byCategory.get(name)!.push(r);
    }
    // Catalogue order first, then anything with a category the list does not
    // know about, so a product is never dropped from the page for having one.
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

  const card = (p: Record<string, any>) => {
    const low = Number(p.stock_count ?? 0) < LOW_STOCK;

    return (
      <div key={p.id} className="flex flex-col border border-brand-border bg-brand-card">
        <div className="flex gap-3 p-3">
          <div className="h-20 w-16 flex-shrink-0 border border-brand-border bg-brand-dark p-1">
            {p.image ? (
              <img src={p.image} alt="" className="h-full w-full object-contain" />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-brand-textMuted">
                <ImageOff className="h-3.5 w-3.5" />
                <span className="text-[0.625rem] uppercase tracking-wider">no photo</span>
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-xs font-extrabold text-brand-heading" title={p.name}>
              {p.name}
            </p>
            <p className="mt-0.5 truncate font-mono text-[0.6875rem] text-brand-textMuted">
              {p.sku || 'no SKU'} · /{p.slug}
            </p>

            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-display text-sm font-black text-brand-heading">
                {money(p.sale_price ?? p.price)}
              </span>
              {p.sale_price != null && (
                <span className="font-mono text-[0.75rem] text-brand-textMuted line-through">
                  {money(p.price)}
                </span>
              )}
            </div>

            <div className="mt-2 flex items-center gap-2">
              <label className="eyebrow">Stock</label>
              <input
                type="number"
                min="0"
                value={stockDrafts[p.id] ?? Number(p.stock_count ?? 0)}
                onChange={(e) => setStockDrafts((prev) => ({ ...prev, [p.id]: Number(e.target.value) }))}
                className={`w-16 border bg-brand-dark px-2 py-1 text-[0.8125rem] focus:outline-none ${
                  low
                    ? 'border-brand-accent text-brand-accentGlow'
                    : 'border-brand-border text-brand-heading focus:border-brand-accent'
                }`}
              />
              {stockDrafts[p.id] !== undefined && stockDrafts[p.id] !== Number(p.stock_count ?? 0) && (
                <button onClick={async () => { await onPatch(p.id, { stock_count: stockDrafts[p.id] }); setStockDrafts((prev) => { const next = { ...prev }; delete next[p.id]; return next; }); }}
                  className="inline-flex items-center gap-1 border border-brand-borderLight px-2 py-1 text-[0.6875rem] font-bold uppercase text-brand-heading hover:border-brand-accent">
                  <Save className="h-3 w-3" /> Save
                </button>
              )}
              {low && <span className="eyebrow text-brand-accentGlow">low</span>}
            </div>
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-brand-border p-2.5">
          {([['is_active', 'Live'], ['is_featured', 'Featured'], ['in_stock', 'In stock']] as const).map(
            ([key, label]) => (
              <button
                key={key}
                onClick={() => onPatch(p.id, { [key]: !p[key] })}
                className={`px-2 py-0.5 font-display text-[0.6875rem] font-black uppercase tracking-[0.1em] transition-colors ${
                  p[key] ? 'bg-brand-accent text-brand-onAccent' : 'border border-brand-borderLight text-brand-textMuted'
                }`}
              >
                {label}
              </button>
            )
          )}

          <span
            title={p.coa_url ? 'Certificate uploaded' : 'No certificate yet'}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[0.6875rem] font-black uppercase tracking-[0.1em] ${
              p.coa_url ? 'text-whatsapp' : 'text-brand-textMuted'
            }`}
          >
            {p.coa_url ? <FileText className="h-3 w-3" /> : <FileX2 className="h-3 w-3" />} COA
          </span>

          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => onEdit(p)}
              className="inline-flex items-center gap-1 border border-brand-borderLight px-2 py-1 font-display text-[0.6875rem] font-black uppercase tracking-[0.1em] text-brand-body transition-colors hover:border-brand-accent hover:text-brand-accentGlow"
            >
              <Pencil className="h-2.5 w-2.5" /> Edit
            </button>
            <button
              onClick={() => onDelete(p.id)}
              title="Delete product"
              className="p-1 text-brand-textMuted hover:text-brand-accentGlow"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3 border border-brand-border bg-brand-card p-3">
        <label className="eyebrow">Category</label>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border border-brand-border bg-brand-dark px-3 py-1.5 text-xs text-brand-heading focus:border-brand-accent focus:outline-none"
        >
          <option value="all">All categories ({rows.length})</option>
          {options.map((o) => (
            <option key={o.name} value={o.name}>
              {o.name} ({o.count})
            </option>
          ))}
        </select>

        <div className="ml-auto flex flex-wrap items-center gap-4 text-[0.75rem] text-brand-textMuted">
          <span>{total} in the catalogue</span>
          {withoutImage > 0 && <span>{withoutImage} without a photo</span>}
          {withoutCoa > 0 && <span>{withoutCoa} without a certificate</span>}
          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 border border-brand-borderLight px-3 py-1.5 font-display text-[0.75rem] font-extrabold uppercase tracking-[0.1em] text-brand-body hover:border-brand-accent"
          ><RefreshCw className="h-3 w-3" /> Refresh</button>
          <button
            onClick={onNew}
            className="inline-flex items-center gap-1.5 bg-brand-accent px-3 py-1.5 font-display text-[0.75rem] font-extrabold uppercase tracking-[0.1em] text-brand-onAccent transition-colors hover:bg-brand-accentHover"
          >
            <Plus className="h-3 w-3" /> New product
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="border border-brand-border bg-brand-card p-10 text-center text-xs text-brand-textMuted">
          Nothing in this category yet.
        </p>
      ) : filter !== 'all' ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map(card)}
        </div>
      ) : (
        <div className="space-y-7">
          {grouped.map((group) => (
            <section key={group.name}>
              <h2 className="mb-3 flex items-baseline gap-2 border-b border-brand-border pb-2">
                <span className="font-display text-xs font-extrabold uppercase tracking-[0.1em] text-brand-heading">
                  {group.name}
                </span>
                <span className="text-[0.75rem] text-brand-textMuted">{group.items.length}</span>
              </h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {group.items.map(card)}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
