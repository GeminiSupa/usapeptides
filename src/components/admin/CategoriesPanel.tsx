'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Boxes, Check, Eye, EyeOff, Loader2, Pencil, Plus, Search, Trash2, X } from 'lucide-react';

type Fetcher = (path: string, init?: RequestInit) => Promise<Response>;
type Category = { id: string; name: string; slug: string; description: string; sort_order: number; is_active: boolean; product_count: number; product_ids: string[] };
type Product = { id: string; name: string; sku?: string | null; image?: string | null; category: string; category_slug: string; is_active: boolean; category_ids: string[] };
type Conflict = { product_id: string; product_name: string; category_id: string; category_name: string };

const blank = { name: '', slug: '', description: '', sort_order: 0, is_active: true };

export default function CategoriesPanel({ authedFetch }: { authedFetch: Fetcher }) {
  const [rows, setRows] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [assignmentsReady, setAssignmentsReady] = useState(true);
  const [editing, setEditing] = useState<Category | null | undefined>(undefined);
  const [assigning, setAssigning] = useState<Category | null>(null);
  const [form, setForm] = useState<any>(blank);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    const response = await authedFetch('/api/admin/categories');
    const payload = await response.json().catch(() => null);
    if (!response.ok) { setError(payload?.message ?? 'Could not load categories.'); return; }
    setRows(payload.data.categories ?? []);
    setProducts(payload.data.products ?? []);
    setAssignmentsReady(payload.data.assignmentsReady !== false);
  }, [authedFetch]);
  useEffect(() => { void load(); }, [load]);

  const openEditor = (row: Category | null) => {
    setEditing(row); setForm(row ? { ...row } : blank); setError('');
  };
  const openProducts = (row: Category) => {
    setAssigning(row); setSelected(new Set(row.product_ids ?? [])); setQuery(''); setConflicts([]); setError('');
  };
  const saveCategory = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    const response = await authedFetch('/api/admin/categories', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(editing ? { id: editing.id, ...form } : form) });
    const payload = await response.json().catch(() => null);
    if (!response.ok) setError(payload?.message ?? 'Could not save category.');
    else { setEditing(undefined); await load(); }
    setBusy(false);
  };
  const saveProducts = async (allowMultiple = false) => {
    if (!assigning) return;
    setBusy(true); setError('');
    const response = await authedFetch('/api/admin/categories', {
      method: 'PATCH',
      body: JSON.stringify({ id: assigning.id, assign_products: true, product_ids: Array.from(selected), allow_multiple: allowMultiple }),
    });
    const payload = await response.json().catch(() => null);
    if (response.status === 409 && Array.isArray(payload?.conflicts)) {
      setConflicts(payload.conflicts); setBusy(false); return;
    }
    if (!response.ok) setError(payload?.message ?? 'Could not save category products.');
    else { setAssigning(null); setConflicts([]); await load(); }
    setBusy(false);
  };
  const remove = async (row: Category) => {
    if (!window.confirm(`Delete ${row.name}? A category containing products cannot be deleted.`)) return;
    const response = await authedFetch(`/api/admin/categories?id=${row.id}`, { method: 'DELETE' });
    const payload = await response.json().catch(() => null);
    if (!response.ok) setError(payload?.message ?? 'Could not delete category.'); else await load();
  };

  const shownProducts = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return products;
    return products.filter((product) => `${product.name} ${product.sku ?? ''} ${product.category}`.toLowerCase().includes(value));
  }, [products, query]);

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-center justify-between gap-4 border border-brand-border bg-brand-card p-5">
        <div>
          <p className="eyebrow">Catalogue structure</p>
          <h2 className="mt-1 font-display text-lg font-black text-brand-heading">{rows.length} product categories</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-brand-textMuted">Organise storefront browsing and add products directly to each category. A product can appear in more than one category after confirmation.</p>
        </div>
        <button onClick={() => openEditor(null)} className="btn-primary px-4 py-2"><Plus className="h-3.5 w-3.5" /> New category</button>
      </section>

      {!assignmentsReady && <div className="border border-action/50 bg-brand-card p-3 text-xs text-brand-body">Run <strong>supabase/migrations/0020_product_category_assignments.sql</strong> to add products to multiple categories. Existing primary categories are still shown.</div>}
      {error && <div className="border border-action/50 bg-brand-card p-3 text-xs text-brand-body">{error}</div>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <article key={row.id} className="group flex min-h-56 flex-col border border-brand-border bg-brand-card transition-colors hover:border-brand-borderLight">
            <div className="flex items-start justify-between gap-3 border-b border-brand-border p-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-9 w-9 flex-none items-center justify-center border border-brand-border bg-brand-dark text-brand-accentGlow"><Boxes className="h-4 w-4" /></span>
                <div className="min-w-0"><h3 className="font-display text-sm font-black leading-tight text-brand-heading">{row.name}</h3><p className="mt-1 truncate font-mono text-[0.6875rem] text-brand-textMuted">/category/{row.slug}</p></div>
              </div>
              <span className={`inline-flex items-center gap-1 text-[0.6875rem] font-bold uppercase tracking-[0.1em] ${row.is_active ? 'text-whatsapp' : 'text-brand-textMuted'}`}>{row.is_active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}{row.is_active ? 'Live' : 'Hidden'}</span>
            </div>
            <p className="line-clamp-3 flex-1 px-4 py-3 text-xs leading-relaxed text-brand-textMuted">{row.description || 'No description added.'}</p>
            <div className="flex items-center gap-2 border-t border-brand-border p-3">
              <button disabled={!assignmentsReady} onClick={() => openProducts(row)} className="btn-secondary flex-1 justify-center disabled:opacity-40"><Boxes className="h-3.5 w-3.5" /> {row.product_count} products</button>
              <button onClick={() => openEditor(row)} title="Edit category" className="border border-brand-borderLight p-2 text-brand-body hover:border-brand-accent hover:text-brand-heading"><Pencil className="h-3.5 w-3.5" /></button>
              <button onClick={() => void remove(row)} title="Delete category" className="border border-brand-borderLight p-2 text-brand-textMuted hover:border-action hover:text-action"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </article>
        ))}
      </div>

      {editing !== undefined && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" role="dialog" aria-modal="true">
          <form onSubmit={saveCategory} className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto border border-brand-border bg-brand-card">
            <header className="flex items-center justify-between border-b border-brand-border p-5"><div><p className="eyebrow">Category</p><h2 className="mt-1 font-display text-lg font-black text-brand-heading">{editing ? 'Edit category' : 'New category'}</h2></div><button type="button" onClick={() => setEditing(undefined)} aria-label="Close"><X className="h-5 w-5" /></button></header>
            <div className="space-y-4 p-5">
              <Field label="Name"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="field-input" /></Field>
              <Field label="Web address"><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="field-input font-mono" placeholder="Built from the name when blank" /></Field>
              <Field label="Description"><textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="field-input resize-y" /></Field>
              <Field label="Sort position"><input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} className="field-input" /></Field>
              <label className="flex items-center gap-2 text-xs text-brand-body"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 accent-forest" /> Visible on storefront</label>
            </div>
            <footer className="flex justify-end gap-2 border-t border-brand-border p-4"><button type="button" onClick={() => setEditing(undefined)} className="btn-secondary">Cancel</button><button disabled={busy} className="btn-primary px-4 py-2">{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save category</button></footer>
          </form>
        </div>
      )}

      {assigning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" role="dialog" aria-modal="true">
          <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col border border-brand-border bg-brand-card">
            <header className="flex items-start justify-between gap-4 border-b border-brand-border p-5"><div><p className="eyebrow">Category products</p><h2 className="mt-1 font-display text-lg font-black text-brand-heading">{assigning.name}</h2><p className="mt-1 text-xs text-brand-textMuted">{selected.size} selected. Primary categories are changed from the product editor.</p></div><button onClick={() => setAssigning(null)} aria-label="Close"><X className="h-5 w-5" /></button></header>
            <div className="border-b border-brand-border p-4"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-textMuted" /><input value={query} onChange={(e) => setQuery(e.target.value)} className="field-input pl-9" placeholder="Search products by name, SKU or primary category" /></div></div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {shownProducts.map((product) => {
                  const primary = product.category_slug === assigning.slug;
                  const checked = selected.has(product.id) || primary;
                  return <label key={product.id} className={`flex cursor-pointer items-center gap-3 border p-3 ${checked ? 'border-brand-accent bg-brand-dark' : 'border-brand-border hover:border-brand-borderLight'} ${primary ? 'cursor-not-allowed' : ''}`}><input type="checkbox" checked={checked} disabled={primary} onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(product.id); else next.delete(product.id); return next; })} className="h-4 w-4 flex-none accent-forest" />{product.image ? <img src={product.image} alt="" className="h-10 w-10 flex-none border border-brand-border bg-white object-contain" /> : <span className="flex h-10 w-10 flex-none items-center justify-center border border-brand-border"><Boxes className="h-4 w-4 text-brand-textMuted" /></span>}<span className="min-w-0 flex-1"><strong className="block truncate text-xs text-brand-heading">{product.name}</strong><span className="block truncate text-[0.6875rem] text-brand-textMuted">{product.sku || 'No SKU'} · {primary ? 'Primary category' : product.category}</span></span>{checked && <Check className="h-4 w-4 flex-none text-brand-accentGlow" />}</label>;
                })}
              </div>
            </div>
            <footer className="flex items-center justify-between gap-3 border-t border-brand-border p-4"><p className="text-xs text-brand-textMuted">Adding a product that belongs elsewhere will show a warning first.</p><div className="flex gap-2"><button onClick={() => setAssigning(null)} className="btn-secondary">Cancel</button><button disabled={busy} onClick={() => void saveProducts(false)} className="btn-primary px-4 py-2">{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save products</button></div></footer>
          </div>
        </div>
      )}

      {conflicts.length > 0 && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4" role="alertdialog" aria-modal="true">
          <div className="w-full max-w-lg border border-action/60 bg-brand-card p-5">
            <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 flex-none text-action" /><div><h3 className="font-display text-sm font-black uppercase text-brand-heading">Products already in another category</h3><p className="mt-2 text-xs leading-relaxed text-brand-body">You can cancel and change the selection, or ignore this warning and let these products appear in multiple categories.</p></div></div>
            <div className="mt-4 max-h-52 overflow-y-auto border-y border-brand-border py-2">{conflicts.map((conflict, index) => <p key={`${conflict.product_id}-${conflict.category_id}-${index}`} className="py-1 text-xs"><strong className="text-brand-heading">{conflict.product_name}</strong><span className="text-brand-textMuted"> is already in {conflict.category_name}</span></p>)}</div>
            <div className="mt-5 flex justify-end gap-2"><button disabled={busy} onClick={() => setConflicts([])} className="btn-secondary">Go back</button><button disabled={busy} onClick={() => void saveProducts(true)} className="btn-primary px-4 py-2">{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Add anyway</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="eyebrow mb-1.5 block">{label}</span>{children}</label>;
}
