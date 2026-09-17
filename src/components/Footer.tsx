'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';

export default function Footer() {
  const categories = useCategories();
  return (
    <footer className="theme-navy mt-24 border-t border-brand-border bg-brand-dark text-brand-body">
      <div className="shell grid grid-cols-1 gap-10 py-16 md:grid-cols-2 lg:grid-cols-5">
        {/* Brand + newsletter */}
        <div className="space-y-5 lg:col-span-2">
          <Link href="/" className="inline-block" aria-label="USA Peptide Depot home">
            <Image
              src="/logo.png"
              alt="USA Peptide Depot"
              width={622}
              height={205}
              className="h-14 w-auto"
            />
          </Link>

          <p className="max-w-sm text-xs leading-relaxed text-brand-textMuted">
            Lyophilized research peptides and laboratory reagents supplied to research institutions,
            licensed researchers and university laboratories across the United States. Every item is
            supplied as a laboratory reference material for in-vitro research use only.
          </p>

          <div>
            <div className="eyebrow mb-3 text-brand-textMuted">Laboratory newsletter</div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
              }}
              className="flex max-w-sm"
            >
              <input
                type="email"
                required
                placeholder="name@institution.edu"
                className="min-w-0 flex-grow border border-brand-border bg-brand-card px-3 py-2.5 text-xs text-brand-heading placeholder-brand-textMuted focus:border-brand-accent focus:outline-none"
              />
              <button
                type="submit"
                className="flex flex-shrink-0 items-center gap-1 bg-brand-accent px-4 font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.1em] text-brand-onAccent transition-colors hover:bg-brand-accentHover"
              >
                <span>Join</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </form>
          </div>
        </div>

        {/* Categories */}
        <div>
          <h4 className="eyebrow mb-4 text-brand-textMuted">Categories</h4>
          <ul className="space-y-2.5 text-xs">
            {categories.slice(0, 6).map((cat) => (
              <li key={cat.id}>
                <Link href={`/category/${cat.slug}`} className="transition-colors hover:text-brand-accentGlow">
                  {cat.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Navigation */}
        <div>
          <h4 className="eyebrow mb-4 text-brand-textMuted">Navigation</h4>
          <ul className="space-y-2.5 text-xs">
            {[
              { href: '/shop', label: 'All research peptides' },
              { href: '/coa-database', label: 'COA database' },
              { href: '/bulk-discounts', label: 'Bulk discounts' },
              { href: '/calculator', label: 'Reconstitution calculator' },
              { href: '/order-received', label: 'Track an order' },
              { href: '/blog', label: 'Research & test results' },
              { href: '/about-us', label: 'About our standards' },
              { href: '/faq', label: 'Frequently asked questions' },
              { href: '/contact-us', label: 'Contact support' },
              { href: '/affiliates', label: 'Affiliate portal' },
            ].map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="transition-colors hover:text-brand-accentGlow">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Support */}
        <div>
          <h4 className="eyebrow mb-4 text-brand-textMuted">Support</h4>
          <div className="space-y-3.5 text-xs text-brand-textMuted">
            <p>
              <span className="block text-brand-textMuted/70">Orders &amp; enquiries</span>
              <a href="mailto:info@usapeptides.com" className="text-brand-accentGlow hover:underline">
                info@usapeptides.com
              </a>
            </p>
            <p>
              <span className="block text-brand-textMuted/70">Ships from</span>
              <span className="text-brand-body">United States</span>
            </p>
            <p>
              <span className="block text-brand-textMuted/70">Hours</span>
              <span className="text-brand-body">Mon&ndash;Fri, 8:00am&ndash;6:00pm ET</span>
            </p>
          </div>
        </div>
      </div>

      {/* Regulatory disclaimer */}
      <div className="border-t border-brand-border bg-brand-card/40">
        <div className="shell space-y-5 py-8">
          <div className="border border-brand-border bg-brand-card p-5">
            <p className="eyebrow mb-2 text-brand-accentGlow">Research compliance notice</p>
            <p className="text-[0.6875rem] leading-relaxed text-brand-textMuted">
              All products listed are supplied strictly for in-vitro laboratory research by qualified
              institutions, universities and licensed laboratory personnel. None of these compounds are
              intended for human consumption, clinical diagnostic application or veterinary use, and none
              are approved by the FDA or any other health authority. Purchasers are responsible for
              handling, storage and disposal in accordance with their own institutional requirements.
            </p>
          </div>

          <div className="flex flex-col items-center justify-between gap-3 text-[0.6875rem] text-brand-textMuted sm:flex-row">
            <p>&copy; {new Date().getFullYear()} USA Peptide Depot. All rights reserved.</p>
            <div className="flex flex-wrap items-center justify-center gap-5">
              {[
                { href: '/privacy-policy', label: 'Privacy policy' },
                { href: '/shipping-policy', label: 'Shipping policy' },
                { href: '/return-refund-policy', label: 'Returns & refunds' },
                { href: '/unsubscribe', label: 'Unsubscribe' },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="transition-colors hover:text-brand-accentGlow"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
