'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Mail, Truck, FileText, Home } from 'lucide-react';
import { BUSINESS } from '@/lib/env';

/**
 * Order placed.
 *
 * The order number comes from the query string that /checkout redirects to.
 * This page used to invent one with Math.random(), so the number a customer
 * wrote down matched nothing in the dashboard.
 *
 * Nothing has been paid at this point: no payment method is live yet, so the
 * copy promises a follow-up rather than a dispatch.
 */
function OrderSuccess() {
  const orderNumber = useSearchParams().get('order')?.trim() || null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-6">
      <div className="w-16 h-16 rounded-3xl bg-forest-50 border border-brand-success/50 text-brand-success flex items-center justify-center mx-auto">
        <CheckCircle2 className="w-10 h-10" />
      </div>

      <div className="space-y-2">
        <span className="eyebrow">Order received</span>
        <h1 className="page-title">Thank You For Your Research Order!</h1>
        {orderNumber ? (
          <p className="text-xs text-brand-textMuted max-w-md mx-auto">
            Your order number: <strong className="text-brand-heading font-mono text-sm">{orderNumber}</strong>
            <br />
            Keep it — quote it in any email about this order.
          </p>
        ) : (
          <p className="text-xs text-brand-textMuted max-w-md mx-auto">
            Your order has been recorded. Email {BUSINESS.supportEmail} if you need the order number.
          </p>
        )}
      </div>

      <div className="p-6 rounded-2xl bg-brand-card border border-brand-border text-left space-y-4 text-xs text-brand-body">
        <h3 className="font-bold text-brand-heading text-sm pb-2 border-b border-brand-border">
          What happens next
        </h3>

        <div className="flex items-start gap-3">
          <Mail className="w-4 h-4 text-brand-accentGlow flex-shrink-0 mt-0.5" />
          <p>
            Our team will email you within one business day to confirm this order and arrange
            payment. Nothing has been charged, and no payment is due until we have confirmed
            availability with you.
          </p>
        </div>

        <div className="flex items-start gap-3">
          <Truck className="w-4 h-4 text-brand-accentGlow flex-shrink-0 mt-0.5" />
          <p>
            Once payment is settled your order is prepared in our USA facility and tracking is
            emailed to the address you gave us.
          </p>
        </div>

        <div className="flex items-start gap-3">
          <FileText className="w-4 h-4 text-brand-success flex-shrink-0 mt-0.5" />
          <p>
            A Certificate of Analysis and storage protocol card are included with every parcel.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
        <Link
          href="/"
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-brand-accent text-brand-onAccent font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.12em] hover:bg-brand-accentHover transition-colors flex items-center justify-center gap-2"
        >
          <Home className="w-4 h-4" />
          <span>Return Home</span>
        </Link>
        <Link
          href="/shop"
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-brand-card border border-brand-border text-brand-body hover:text-brand-heading font-semibold text-xs transition-colors"
        >
          Explore More Peptides
        </Link>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={<div className="max-w-2xl mx-auto px-4 py-16 text-center text-xs text-brand-textMuted">Loading…</div>}>
      <OrderSuccess />
    </Suspense>
  );
}
