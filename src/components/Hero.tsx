'use client';

import React from 'react';
import Link from 'next/link';

/**
 * Centered hero. No gradient, no glow, no ornament — the headline and the
 * hairline rules do the work, which is how the reference layout holds up.
 */
export default function Hero() {
  return (
    <section className="theme-forest border-b border-brand-border bg-brand-dark">
      <div className="shell py-20 sm:py-28 lg:py-32">
        <div className="mx-auto max-w-4xl text-center">
          <p className="eyebrow text-brand-textMuted">
            In-vitro research materials &mdash; stocked and shipped in the USA
          </p>

          <h1 className="mt-6 font-display uppercase text-brand-heading text-hero">
            High-Purity
            <br />
            Research Peptides
          </h1>

          <ul className="mt-9 flex flex-col items-center justify-center divide-y divide-brand-border border-y border-brand-border sm:flex-row sm:divide-x sm:divide-y-0">
            {[
              'Every lot carries an HPLC report',
              'Analysed by an outside laboratory',
              'Tracked domestic delivery',
            ].map((item) => (
              <li
                key={item}
                className="w-full px-6 py-4 text-[0.8125rem] font-medium text-brand-body sm:w-auto"
              >
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/shop" className="btn-primary w-full sm:w-auto">
              Shop Research Peptides
            </Link>
            <Link href="/blog" className="btn-ghost w-full sm:w-auto">
              View Test Reports
            </Link>
          </div>

          <p className="mx-auto mt-12 max-w-3xl text-xs leading-relaxed text-brand-textMuted">
            Sold for laboratory research only. These materials are not drugs, not intended for human or
            animal use, and may be purchased only by universities, research institutions and other
            qualified laboratory buyers.
          </p>
        </div>
      </div>
    </section>
  );
}
