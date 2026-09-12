'use client';

import React from 'react';
import Link from 'next/link';
import {
  Flame,
  Zap,
  Shield,
  Sun,
  Activity,
  Cpu,
  Dna,
  Sparkles,
  Layers,
  Droplet,
  ArrowRight,
} from 'lucide-react';
import { categories } from '@/data/categories';

/** One accent colour throughout — the icon carries shape, not hue. */
const iconMap: Record<string, React.ElementType> = {
  Flame,
  Zap,
  Shield,
  Sun,
  Activity,
  Cpu,
  Dna,
  Sparkles,
  Layers,
  Droplet,
};

export default function CategoryNav() {
  return (
    <section className="border-y border-brand-border bg-brand-card/40">
      <div className="shell py-20">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow mb-2.5">Browse the shelf</p>
            <h2 className="section-title">Shop by research pathway</h2>
          </div>
          <Link
            href="/shop"
            className="inline-flex items-center gap-1.5 font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.12em] text-brand-accentGlow hover:text-brand-heading"
          >
            <span>View all categories</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {categories.map((cat) => {
            const Icon = iconMap[cat.iconName] ?? Zap;
            return (
              <Link
                key={cat.id}
                href={`/category/${cat.slug}`}
                className="group flex flex-col border border-brand-border bg-brand-card p-5 transition-colors hover:border-brand-accent/60"
              >
                <Icon className="h-5 w-5 text-brand-accentGlow" strokeWidth={1.75} />

                <h3 className="mt-4 font-display text-[0.8125rem] font-extrabold leading-snug text-brand-heading transition-colors group-hover:text-brand-accentGlow">
                  {cat.name}
                </h3>
                <p className="mt-2 text-[0.6875rem] leading-relaxed text-brand-textMuted">
                  {cat.description}
                </p>

                <div className="flex-1" />

                <div className="mt-4 flex items-center justify-between border-t border-brand-border pt-3 text-[0.625rem] uppercase tracking-[0.12em] text-brand-textMuted">
                  <span>{cat.count} compounds</span>
                  <ArrowRight className="h-3 w-3 text-brand-accentGlow transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
