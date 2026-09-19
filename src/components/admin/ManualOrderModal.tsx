'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { FLAT_SHIPPING, FREE_SHIPPING_THRESHOLD, roundMoney, tierDiscount } from '@/lib/checkout';
import { Plus, Trash2, X } from 'lucide-react';

interface ProductRow {
  id: string;
  slug: string;
  name: string;
  sku?: string | null;
  price: number;
  sale_price?: number | null;
  stock_count: number;
  in_stock: boolean;
}

interface LineDraft {
  slug: string;
  quantity: number;
}

interface Props {
  authedFetch: (path: string, init?: RequestInit) => Promise<Response>;
  onCancel: () => void;
  onSaved: () => void;
}

const blankAddress = {
  line1: '',
  line2: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'US',
};

const money = (n: number) => `$${n.toFixed(2)}`;

export default function ManualOrderModal({ authedFetch, onCancel, onSaved }: Props) {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState({
    email: '',
    fullName: '',
    institution: '',
    phone: '',
    status: 'pending',
    paymentMethod: 'manual',
    paymentReference: '',
    notes: '',
  });
  const [address, setAddress] = useState(blankAddress);
  const [lines, setLines] = useState<LineDraft[]>([{ slug: '', quantity: 1 }]);

  useEffect(() => {
    let alive = true;
    authedFetch('/api/admin/products?limit=200')
      .then(async (res) => {
        const p = await res.json().catch(() => null);
        if (!res.ok) throw new Error(p?.message ?? 'Could not load products.');
        if (alive) setProducts((p.data?.rows ?? []).filter((row: ProductRow) => row.in_stock));
      })
      .catch((err) => alive && setError((err as Error).message))
      .finally(() => alive && setLoadingProducts(false));
    return () => { alive = false; };
  }, [authedFetch]);

  const bySlug = useMemo(() => new Map(products.map((p) => [p.slug, p])), [products]);

  const totals = useMemo(() => {
    let subtotal = 0;
    let discountTotal = 0;
    for (const line of lines) {
      const product = bySlug.get(line.slug);
      const qty = Math.max(0, Math.floor(Number(line.quantity) || 0));
      if (!product || qty <= 0) continue;
      const base = Number(product.sale_price ?? product.price);
      const undiscounted = roundMoney(base * qty);
      const lineTotal = roundMoney(roundMoney(base * (1 - tierDiscount(qty))) * qty);
      subtotal = roundMoney(subtotal + undiscounted);
      discountTotal = roundMoney(discountTotal + (undiscounted - lineTotal));
    }
    const merchandise = roundMoney(subtotal - discountTotal);
    const shipping = merchandise >= FREE_SHIPPING_THRESHOLD || merchandise === 0 ? 0 : FLAT_SHIPPING;
    return { subtotal, discountTotal, shipping, grand: roundMoney(merchandise + shipping) };
  }, [bySlug, lines]);

  const setLine = (index: number, patch: Partial<LineDraft>) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const cleanAddress = Object.fromEntries(
        Object.entries(address).map(([key, value]) => [key, value.trim()])
      );
      const res = await authedFetch('/api/admin/orders/create', {
        method: 'POST',
        body: JSON.stringify({
          ...fields,
          shippingAddress: cleanAddress,
          items: lines.filter((line) => line.slug && line.quantity > 0),
        }),
      });
      const p = await res.json().catch(() => null);
      if (!res.ok) {
        const fieldText = p?.fields ? ` ${Object.values(p.fields).join(' ')}` : '';
        throw new Error(`${p?.message ?? 'Could not create order.'}${fieldText}`);
      }
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4">
      <form onSubmit={submit} className="mx-auto max-h-[calc(100dvh-2rem)] max-w-4xl overflow-y-auto border border-brand-border bg-brand-card text-xs text-brand-body [scrollbar-color:theme(colors.brand.borderLight)_transparent] [scrollbar-width:thin]">
        <div className="flex items-center justify-between border-b border-brand-border px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-black uppercase tracking-[0.08em] text-brand-heading">Manual order</h2>
            <p className="mt-1 text-brand-textMuted">Create phone, invoice, or admin-entered orders from live catalogue prices.</p>
          </div>
          <button type="button" onClick={onCancel} className="text-brand-textMuted hover:text-brand-accentGlow">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-5">
            {error && <div className="border border-brand-accent/60 bg-brand-dark p-3 leading-relaxed text-brand-heading">{error}</div>}

            <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {[
                ['email', 'Email', 'email', true],
                ['fullName', 'Full name', 'text', false],
                ['institution', 'Institution', 'text', false],
                ['phone', 'Phone', 'text', false],
              ].map(([name, label, type, required]) => (
                <label key={String(name)} className="space-y-1">
                  <span className="font-display text-[0.6875rem] font-black uppercase tracking-[0.12em] text-brand-textMuted">{label}</span>
                  <input
                    type={String(type)}
                    required={Boolean(required)}
                    value={fields[name as keyof typeof fields]}
                    onChange={(e) => setFields((prev) => ({ ...prev, [String(name)]: e.target.value }))}
                    className="w-full border border-brand-border bg-brand-dark px-3 py-2 text-brand-heading outline-none focus:border-brand-accent"
                  />
                </label>
              ))}
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-[0.8125rem] font-black uppercase tracking-[0.12em] text-brand-heading">Items</h3>
                <button
                  type="button"
                  onClick={() => setLines((prev) => [...prev, { slug: '', quantity: 1 }])}
                  className="inline-flex items-center gap-1.5 border border-brand-borderLight px-2.5 py-1 font-display text-[0.6875rem] font-black uppercase tracking-[0.1em] hover:border-brand-accent"
                >
                  <Plus className="h-3 w-3" /> Add line
                </button>
              </div>

              {lines.map((line, index) => {
                const product = bySlug.get(line.slug);
                return (
                  <div key={index} className="grid grid-cols-1 gap-2 border border-brand-border bg-brand-dark p-3 md:grid-cols-[1fr_6rem_auto]">
                    <select
                      value={line.slug}
                      required
                      disabled={loadingProducts}
                      onChange={(e) => setLine(index, { slug: e.target.value })}
                      className="border border-brand-border bg-brand-card px-3 py-2 text-brand-heading outline-none focus:border-brand-accent"
                    >
                      <option value="">{loadingProducts ? 'Loading products...' : 'Choose product'}</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.slug}>
                          {p.name} — {money(Number(p.sale_price ?? p.price))} — stock {p.stock_count}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      max={product?.stock_count ?? undefined}
                      value={line.quantity}
                      onChange={(e) => setLine(index, { quantity: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
                      className="border border-brand-border bg-brand-card px-3 py-2 text-brand-heading outline-none focus:border-brand-accent"
                    />
                    <button
                      type="button"
                      onClick={() => setLines((prev) => prev.length === 1 ? [{ slug: '', quantity: 1 }] : prev.filter((_, i) => i !== index))}
                      className="border border-brand-borderLight px-3 py-2 text-brand-textMuted hover:border-brand-accent hover:text-brand-accentGlow"
                      title="Remove line"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </section>

            <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {Object.keys(blankAddress).map((key) => (
                <label key={key} className="space-y-1">
                  <span className="font-display text-[0.6875rem] font-black uppercase tracking-[0.12em] text-brand-textMuted">
                    {key.replace(/_/g, ' ')}
                  </span>
                  <input
                    value={address[key as keyof typeof address]}
                    onChange={(e) => setAddress((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="w-full border border-brand-border bg-brand-dark px-3 py-2 text-brand-heading outline-none focus:border-brand-accent"
                  />
                </label>
              ))}
            </section>
          </div>

          <aside className="space-y-4">
            <label className="block space-y-1">
              <span className="font-display text-[0.6875rem] font-black uppercase tracking-[0.12em] text-brand-textMuted">Status</span>
              <select
                value={fields.status}
                onChange={(e) => setFields((prev) => ({ ...prev, status: e.target.value }))}
                className="w-full border border-brand-border bg-brand-dark px-3 py-2 text-brand-heading outline-none focus:border-brand-accent"
              >
                {['pending', 'paid', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded'].map((s) => <option key={s} value={s}>{s === 'completed' ? 'Order completed' : s}</option>)}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="font-display text-[0.6875rem] font-black uppercase tracking-[0.12em] text-brand-textMuted">Payment</span>
              <select
                value={fields.paymentMethod}
                onChange={(e) => setFields((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                className="w-full border border-brand-border bg-brand-dark px-3 py-2 text-brand-heading outline-none focus:border-brand-accent"
              >
                {['manual', 'card', 'zelle', 'crypto', 'wire'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="font-display text-[0.6875rem] font-black uppercase tracking-[0.12em] text-brand-textMuted">Payment reference</span>
              <input
                value={fields.paymentReference}
                onChange={(e) => setFields((prev) => ({ ...prev, paymentReference: e.target.value }))}
                className="w-full border border-brand-border bg-brand-dark px-3 py-2 text-brand-heading outline-none focus:border-brand-accent"
              />
            </label>

            <label className="block space-y-1">
              <span className="font-display text-[0.6875rem] font-black uppercase tracking-[0.12em] text-brand-textMuted">Notes</span>
              <textarea
                rows={5}
                value={fields.notes}
                onChange={(e) => setFields((prev) => ({ ...prev, notes: e.target.value }))}
                className="w-full border border-brand-border bg-brand-dark px-3 py-2 text-brand-heading outline-none focus:border-brand-accent"
              />
            </label>

            <div className="border border-brand-border bg-brand-dark p-3">
              {[
                ['Subtotal', totals.subtotal],
                ['Discount', totals.discountTotal],
                ['Shipping', totals.shipping],
                ['Grand total', totals.grand],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex justify-between gap-3 py-1">
                  <span className="text-brand-textMuted">{label}</span>
                  <span className="font-mono text-brand-heading">{money(Number(value))}</span>
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={busy || loadingProducts}
              className="w-full bg-brand-accent px-4 py-3 font-display text-[0.75rem] font-black uppercase tracking-[0.12em] text-brand-onAccent transition-colors hover:bg-brand-accentHover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'Creating...' : 'Create order'}
            </button>
          </aside>
        </div>
      </form>
    </div>
  );
}
