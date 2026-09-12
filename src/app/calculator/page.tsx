'use client';

import React from 'react';
import Link from 'next/link';
import ReconstitutionCalculator from '@/components/ReconstitutionCalculator';
import { Calculator, ArrowRight, ShieldCheck, HelpCircle } from 'lucide-react';

export default function CalculatorPage() {
  return (
    <div className="shell py-10 space-y-10">
      
      {/* Header */}
      <div className="border-b border-brand-border pb-6">
        <div className="eyebrow mb-2.5">
          Laboratory Research Tools
        </div>
        <h1 className="page-title">
          Peptide Reconstitution &amp; Dilution Calculator
        </h1>
        <p className="text-xs sm:text-sm text-gray-400 mt-2 max-w-2xl leading-relaxed">
          Accurately determine diluent volumes, concentration ratios, and syringe unit tick marks for lyophilized peptide research.
        </p>
      </div>

      {/* Calculator Widget */}
      <ReconstitutionCalculator />

      {/* Mathematical Reference Formula */}
      <div className="p-6 rounded-2xl bg-brand-card border border-brand-border space-y-4 text-xs text-gray-300">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-cyan-400" />
          Reconstitution Calculation Formula &amp; Theory
        </h3>
        
        <p className="leading-relaxed">
          Peptide reconstitution mathematics is based on standard concentration dilution principles:
        </p>

        <div className="p-4 rounded-xl bg-brand-darker border border-brand-border font-mono text-cyan-300 space-y-2">
          <div>Concentration (mcg/mL) = (Vial Mass in mg × 1,000) ÷ Diluent Volume (mL)</div>
          <div>Volume per Dose (mL) = Target Dose (mcg) ÷ Concentration (mcg/mL)</div>
          <div>Syringe Units (U-100) = Volume per Dose (mL) × 100 Units/mL</div>
        </div>

        <p className="text-gray-400 leading-relaxed text-[11px]">
          Example: For a 5mg vial reconstituted with 2.0 mL BAC water, the resulting concentration is 2,500 mcg/mL. To draw a 250 mcg research dose: 250 mcg ÷ 2,500 mcg/mL = 0.10 mL (which corresponds to exactly 10 Units on an insulin U-100 syringe).
        </p>
      </div>

    </div>
  );
}
