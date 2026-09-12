'use client';

import React from 'react';
import Link from 'next/link';
import { CheckCircle2, ShieldCheck, Truck, FileText, ArrowRight, Home } from 'lucide-react';

export default function OrderSuccessPage() {
  const orderNumber = 'BBP-' + Math.floor(100000 + Math.random() * 900000);

  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-6">
      <div className="w-16 h-16 rounded-3xl bg-emerald-950 border border-emerald-500/50 text-emerald-400 flex items-center justify-center mx-auto">
        <CheckCircle2 className="w-10 h-10" />
      </div>

      <div className="space-y-2">
        <span className="eyebrow">
          Order Successfully Placed
        </span>
        <h1 className="page-title">
          Thank You For Your Research Order!
        </h1>
        <p className="text-xs text-gray-400 max-w-md mx-auto">
          Order Confirmation Number: <strong className="text-white font-mono text-sm">{orderNumber}</strong>
        </p>
      </div>

      <div className="p-6 rounded-2xl bg-brand-card border border-brand-border text-left space-y-4 text-xs text-gray-300">
        <h3 className="font-bold text-white text-sm pb-2 border-b border-brand-border">
          Fulfillment &amp; Shipping Next Steps
        </h3>
        
        <div className="flex items-start gap-3">
          <Truck className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
          <p>
            Your order is being prepared in our USA climate facility. Tracking information will be emailed to your institution address upon dispatch.
          </p>
        </div>

        <div className="flex items-start gap-3">
          <FileText className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <p>
            Physical printed Certificates of Analysis (COAs) and storage protocol cards are included in your temperature-controlled parcel.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
        <Link
          href="/"
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-brand-accent text-white font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.12em] hover:bg-flag-red transition-colors flex items-center justify-center gap-2"
        >
          <Home className="w-4 h-4" />
          <span>Return Home</span>
        </Link>
        <Link
          href="/shop"
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-brand-card border border-brand-border text-gray-300 hover:text-white font-semibold text-xs transition-colors"
        >
          Explore More Peptides
        </Link>
      </div>
    </div>
  );
}
