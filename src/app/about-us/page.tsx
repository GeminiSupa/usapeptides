'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Award, FlaskConical, Truck, CheckCircle2, FileText, ArrowRight } from 'lucide-react';

export default function AboutUsPage() {
  return (
    <div className="shell py-10 space-y-12">
      
      {/* Header */}
      <div className="border-b border-brand-border pb-6">
        <div className="eyebrow mb-2.5">
          Laboratory Standards
        </div>
        <h1 className="page-title">
          About USA Peptide Depot
        </h1>
        <p className="text-xs sm:text-sm text-brand-textMuted mt-2 max-w-2xl leading-relaxed">
          Supplying HPLC-tested research peptides and reference materials to academic universities, private laboratories, and biotechnology institutions.
        </p>
      </div>

      {/* Mission & Vision */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <div className="space-y-4 text-xs sm:text-sm text-brand-body leading-relaxed">
          <h2 className="text-xl font-bold text-brand-heading">
            Uncompromising Chemical Integrity
          </h2>
          <p>
            USA Peptide Depot was founded to eliminate the variance and lack of transparency historically associated with research chemical procurement. We believe researchers deserve clear, reproducible purity data before running critical in-vitro assays.
          </p>
          <p>
            Every peptide batch we distribute is synthesized via automated solid-phase peptide synthesis (SPPS), purified with preparative RP-HPLC, lyophilized into sterile Type I borosilicate vials under inert argon atmosphere, and validated through independent third-party laboratories.
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-brand-card border border-brand-border space-y-4">
          <h3 className="font-bold text-brand-heading text-sm flex items-center gap-2">
            <Award className="w-5 h-5 text-brand-accentGlow" />
            Our Laboratory Guarantees
          </h3>
          <ul className="space-y-2.5 text-xs text-brand-body">
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-brand-success flex-shrink-0 mt-0.5" />
              <span><strong>Guaranteed Purity:</strong> Minimum 99.0% chromatographic purity on every peptide.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-brand-success flex-shrink-0 mt-0.5" />
              <span><strong>Full Analytical Transparency:</strong> Publicly verifiable RP-HPLC UV-214nm chromatograms and MS spectra.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-brand-success flex-shrink-0 mt-0.5" />
              <span><strong>USA Domestic Operations:</strong> Climate-controlled warehousing and expedited same-day dispatch.</span>
            </li>
          </ul>
        </div>
      </div>

      {/* 3 Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        <div className="p-6 rounded-2xl bg-brand-card border border-brand-border space-y-3">
          <FlaskConical className="w-8 h-8 text-brand-accentGlow" />
          <h3 className="font-bold text-brand-heading text-sm">Automated SPPS Synthesis</h3>
          <p className="text-xs text-brand-textMuted leading-relaxed">
            Solid-phase peptide synthesis utilizing Fmoc chemistry ensuring precise amino acid chain sequencing and minimizing deletion impurities.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-brand-card border border-brand-border space-y-3">
          <ShieldCheck className="w-8 h-8 text-brand-success" />
          <h3 className="font-bold text-brand-heading text-sm">Independent 3rd-Party Audits</h3>
          <p className="text-xs text-brand-textMuted leading-relaxed">
            Analytical validation conducted by recognized independent facilities including Janoshik Analytical and MZ Biolabs.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-brand-card border border-brand-border space-y-3">
          <Truck className="w-8 h-8 text-brand-accentGlow" />
          <h3 className="font-bold text-brand-heading text-sm">Cold-Chain Delivery</h3>
          <p className="text-xs text-brand-textMuted leading-relaxed">
            Protective thermal insulated packaging ensuring lyophilized peptide stability during domestic transit.
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="p-8 rounded-3xl bg-brand-card border border-brand-border flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
        <div>
          <h3 className="text-lg font-bold text-brand-heading">Have Custom Synthesis or Bulk Institutional Inquiries?</h3>
          <p className="text-xs text-brand-textMuted mt-1">Our team provides custom aliquot packaging and academic department invoicing.</p>
        </div>
        <Link
          href="/contact-us"
          className="px-6 py-3 bg-brand-accent hover:bg-brand-accentHover text-brand-onAccent font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.12em] rounded-xl transition-colors flex-shrink-0"
        >
          Contact Laboratory Team
        </Link>
      </div>

    </div>
  );
}
