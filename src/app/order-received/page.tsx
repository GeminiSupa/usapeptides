'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Search, PackageCheck, AlertCircle } from 'lucide-react';

interface OrderItem {
  product_name: string;
  sku: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
}

interface OrderRecord {
  order_number: string;
  status: string;
  email: string;
  full_name: string | null;
  subtotal: number;
  discount_total: number;
  shipping_total: number;
  grand_total: number;
  tracking_number: string | null;
  created_at: string;
}

const STATUS_COPY: Record<string, string> = {
  pending: 'Awaiting payment',
  paid: 'Payment received',
  processing: 'Being prepared',
  shipped: 'In transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

/** Order lookup. Requires both the order number and the email it was placed with. */
export default function OrderReceivedPage() {
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'found' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('loading');
    setMessage('');

    try {
      const res = await fetch(
        `/api/orders?number=${encodeURIComponent(orderNumber.trim())}&email=${encodeURIComponent(email.trim())}`
      );
      const payload = await res.json();

      if (!res.ok) {
        setState('error');
        setMessage(
          payload?.message ??
            'We could not find that order. Check the number and the email it was placed with.'
        );
        return;
      }

      setOrder(payload.data.order);
      setItems(payload.data.items ?? []);
      setState('found');
    } catch {
      setState('error');
      setMessage('Could not reach the server. Please try again in a moment.');
    }
  };

  return (
    <div className="shell max-w-3xl space-y-8 py-10">
      <div className="border-b border-brand-border pb-6">
        <p className="eyebrow mb-2.5">Order status</p>
        <h1 className="page-title">Track An Order</h1>
        <p className="mt-3 text-xs leading-relaxed text-brand-textMuted sm:text-sm">
          Enter the order number from your confirmation email, along with the address it was sent to.
        </p>
      </div>

      <form onSubmit={lookup} className="grid grid-cols-1 gap-3 sm:grid-cols-12">
        <input
          required
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          placeholder="USP-XXXXX-XXXX"
          className="border border-brand-border bg-brand-card px-3 py-3 font-mono text-xs text-brand-heading placeholder-brand-textMuted focus:border-brand-accent focus:outline-none sm:col-span-5"
        />
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@institution.edu"
          className="border border-brand-border bg-brand-card px-3 py-3 text-xs text-brand-heading placeholder-brand-textMuted focus:border-brand-accent focus:outline-none sm:col-span-5"
        />
        <button
          type="submit"
          disabled={state === 'loading'}
          className="flex items-center justify-center gap-2 bg-brand-accent px-4 py-3 font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.12em] text-white transition-colors hover:bg-flag-red disabled:opacity-60 sm:col-span-2"
        >
          <Search className="h-3.5 w-3.5" />
          {state === 'loading' ? '...' : 'Find'}
        </button>
      </form>

      {state === 'error' && (
        <div className="flex items-start gap-3 border border-brand-accent/50 bg-brand-card p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-accentGlow" />
          <p className="text-xs leading-relaxed text-brand-body">{message}</p>
        </div>
      )}

      {state === 'found' && order && (
        <div className="border border-brand-border bg-brand-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-border p-5">
            <div className="flex items-center gap-3">
              <PackageCheck className="h-5 w-5 text-brand-accentGlow" />
              <div>
                <div className="font-display text-sm font-extrabold text-brand-heading">
                  {order.order_number}
                </div>
                <div className="text-[0.625rem] uppercase tracking-[0.12em] text-brand-textMuted">
                  Placed {new Date(order.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
            <span className="bg-brand-accent px-3 py-1 font-display text-[0.625rem] font-black uppercase tracking-[0.1em] text-white">
              {STATUS_COPY[order.status] ?? order.status}
            </span>
          </div>

          <div className="divide-y divide-brand-border">
            {items.map((item) => (
              <div key={item.product_name} className="flex items-center justify-between gap-4 px-5 py-3">
                <div>
                  <div className="font-display text-xs font-extrabold text-brand-heading">
                    {item.product_name}
                  </div>
                  <div className="text-[0.625rem] text-brand-textMuted">
                    {item.quantity} &times; ${Number(item.unit_price).toFixed(2)}
                  </div>
                </div>
                <div className="font-mono text-xs text-brand-body">
                  ${Number(item.line_total).toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          <dl className="divide-y divide-brand-border border-t border-brand-border text-xs">
            {[
              ['Subtotal', order.subtotal],
              ['Discount', -order.discount_total],
              ['Shipping', order.shipping_total],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex justify-between px-5 py-2.5">
                <dt className="text-brand-textMuted">{label}</dt>
                <dd className="font-mono text-brand-body">${Number(value).toFixed(2)}</dd>
              </div>
            ))}
            <div className="flex justify-between px-5 py-4">
              <dt className="font-display text-xs font-extrabold uppercase tracking-[0.1em] text-brand-heading">
                Total
              </dt>
              <dd className="font-display text-lg font-black text-brand-accentGlow">
                ${Number(order.grand_total).toFixed(2)}
              </dd>
            </div>
          </dl>

          {order.tracking_number && (
            <div className="border-t border-brand-border px-5 py-4">
              <span className="eyebrow">Tracking</span>
              <div className="mt-1 font-mono text-xs text-brand-body">{order.tracking_number}</div>
            </div>
          )}
        </div>
      )}

      <p className="text-[0.6875rem] leading-relaxed text-brand-textMuted">
        Cannot find your order?{' '}
        <Link href="/contact-us" className="text-brand-accentGlow hover:underline">
          Contact support
        </Link>{' '}
        with the order number and we will look it up.
      </p>
    </div>
  );
}
