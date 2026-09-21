'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import ResearchResources from '@/components/ResearchResources';

const TIERS = [
  { qty: '1 – 2 vials', off: 0, note: 'List price' },
  { qty: '3 – 4 vials', off: 10, note: 'Applied in cart' },
  { qty: '5 – 9 vials', off: 15, note: 'Applied in cart' },
  { qty: '10+ vials', off: 20, note: 'Applied in cart' },
];

export default function BulkDiscountsPage() {
  const [unit, setUnit] = useState(45);
  const [qty, setQty] = useState(5);

  const discount = qty >= 10 ? 0.2 : qty >= 5 ? 0.15 : qty >= 3 ? 0.1 : 0;
  const listTotal = unit * qty;
  const payable = Math.round(listTotal * (1 - discount) * 100) / 100;
  const saved = Math.round((listTotal - payable) * 100) / 100;

  return (
    <div className="shell space-y-10 py-10">
      <div className="border-b border-brand-border pb-6">
        <p className="eyebrow mb-2.5">Volume pricing</p>
        <h1 className="page-title">Bulk Research Peptide Pricing</h1>
        <p className="mt-3 max-w-2xl text-xs leading-relaxed text-brand-textMuted sm:text-sm">
          Discounts apply per line item and are calculated automatically at checkout. There is no code
          to enter and no account tier to qualify for.
        </p>
      </div>

      {/* Tier table */}
      <div className="grid grid-cols-1 gap-px border border-brand-border bg-brand-border sm:grid-cols-4">
        {TIERS.map((t) => (
          <div key={t.qty} className="bg-brand-card p-6 text-center">
            <div className="font-display text-[2rem] font-black leading-none text-brand-heading">
              {t.off}
              <span className="text-base">%</span>
            </div>
            <div className="mt-2 font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.12em] text-brand-accentGlow">
              {t.qty}
            </div>
            <div className="mt-1 text-[0.625rem] text-brand-textMuted">{t.note}</div>
          </div>
        ))}
      </div>

      {/* Calculator */}
      <div className="grid grid-cols-1 gap-8 border border-brand-border bg-brand-card p-6 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-7">
          <h2 className="font-display text-[0.9375rem] font-extrabold uppercase tracking-[0.08em] text-brand-heading">
            Work out your price
          </h2>

          <label className="block">
            <span className="eyebrow mb-2 block">Unit price ($)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={unit}
              onChange={(e) => setUnit(Math.max(0, Number(e.target.value)))}
              className="w-full border border-brand-border bg-brand-dark px-3 py-2.5 font-mono text-sm text-brand-heading focus:border-brand-accent focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="eyebrow mb-2 block">Quantity: {qty} vials</span>
            <input
              type="range"
              min={1}
              max={20}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
              className="w-full accent-brand-accent"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            {[1, 3, 5, 10, 20].map((n) => (
              <button
                key={n}
                onClick={() => setQty(n)}
                className={`border px-3 py-1.5 font-display text-[0.625rem] font-extrabold uppercase tracking-[0.1em] transition-colors ${
                  qty === n
                    ? 'border-brand-accent bg-brand-accent text-brand-onAccent'
                    : 'border-brand-borderLight text-brand-heading hover:border-brand-accent'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="border border-brand-border bg-brand-dark">
            <div className="border-b border-brand-border px-5 py-3">
              <span className="eyebrow">Your price</span>
            </div>
            <dl className="divide-y divide-brand-border text-xs">
              {[
                ['List total', `$${listTotal.toFixed(2)}`],
                ['Tier discount', `${(discount * 100).toFixed(0)}%`],
                ['You save', `$${saved.toFixed(2)}`],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between px-5 py-3">
                  <dt className="text-brand-textMuted">{k}</dt>
                  <dd className="font-mono text-brand-body">{v}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between px-5 py-4">
                <dt className="font-display text-xs font-extrabold uppercase tracking-[0.1em] text-brand-heading">
                  Payable
                </dt>
                <dd className="font-display text-xl font-black text-brand-accentGlow">
                  ${payable.toFixed(2)}
                </dd>
              </div>
            </dl>
          </div>

          <Link href="/shop" className="btn-primary mt-4 w-full">
            Shop the catalogue
          </Link>
        </div>
      </div>

      {/* Terms */}
      <div>
        <h2 className="font-display text-[0.9375rem] font-extrabold uppercase tracking-[0.08em] text-brand-heading">
          How it works
        </h2>
        <ul className="mt-4 divide-y divide-brand-border border-y border-brand-border">
          {[
            'Tiers are calculated per product line, not across your whole basket.',
            'Discounts apply automatically in the cart — there is no code to enter.',
            'Free tracked shipping applies once the order passes $100 after discount.',
            'Need more than 20 vials of one compound? Contact us for a quote.',
          ].map((line) => (
            <li key={line} className="flex gap-3 py-3.5">
              <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-brand-accentGlow" />
              <span className="text-xs leading-relaxed text-brand-textMuted">{line}</span>
            </li>
          ))}
        </ul>
      </div>
      <ResearchResources currentPath="/bulk-discounts" />
    </div>
  );
}
