'use client';

import React from 'react';

export interface PolicySection {
  heading: string;
  body: string[];
}

interface PolicyPageProps {
  eyebrow: string;
  title: string;
  intro: string;
  updated: string;
  sections: PolicySection[];
}

/** Shared layout for the static policy pages so they stay visually identical. */
export default function PolicyPage({
  eyebrow,
  title,
  intro,
  updated,
  sections,
}: PolicyPageProps) {
  return (
    <div className="shell max-w-3xl space-y-10 py-10">
      <div className="border-b border-brand-border pb-6">
        <p className="eyebrow mb-2.5">{eyebrow}</p>
        <h1 className="page-title">{title}</h1>
        <p className="mt-3 text-xs leading-relaxed text-brand-textMuted sm:text-sm">{intro}</p>
        <p className="mt-4 text-[0.625rem] uppercase tracking-[0.12em] text-brand-textMuted">
          Last updated {updated}
        </p>
      </div>

      <div className="space-y-8">
        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="font-display text-[0.9375rem] font-extrabold uppercase tracking-[0.08em] text-brand-heading">
              {section.heading}
            </h2>
            <div className="mt-3 space-y-3">
              {section.body.map((para, i) => (
                <p key={i} className="text-xs leading-relaxed text-brand-body">
                  {para}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="border border-brand-border bg-brand-card p-5">
        <p className="text-[0.6875rem] leading-relaxed text-brand-textMuted">
          Questions about this policy? Email{' '}
          <a href="mailto:info@usapeptides.com" className="text-brand-accentGlow hover:underline">
            info@usapeptides.com
          </a>
          .
        </p>
      </div>
    </div>
  );
}
