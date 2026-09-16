'use client';

import React, { useState } from 'react';
import { DollarSign, Award, Users, ArrowRight, ShieldCheck } from 'lucide-react';

export default function AffiliatesPage() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="shell max-w-4xl py-10 space-y-10">
      
      <div className="border-b border-brand-border pb-6">
        <div className="eyebrow mb-2.5">
          Partner Program
        </div>
        <h1 className="page-title">
          Affiliate &amp; Research Referral Portal
        </h1>
        <p className="text-xs sm:text-sm text-brand-textMuted mt-2 max-w-2xl">
          Partner with USA Peptide Depot. Earn commissions on qualified laboratory reference referrals with instant monthly payouts.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl bg-brand-card border border-brand-border space-y-2 text-center">
          <DollarSign className="w-8 h-8 text-brand-success mx-auto" />
          <h3 className="font-bold text-brand-heading text-sm">Competitive Commissions</h3>
          <p className="text-xs text-brand-textMuted">Earn up to 15% on referral purchases.</p>
        </div>

        <div className="p-6 rounded-2xl bg-brand-card border border-brand-border space-y-2 text-center">
          <Award className="w-8 h-8 text-brand-accentGlow mx-auto" />
          <h3 className="font-bold text-brand-heading text-sm">Real-Time Dashboard</h3>
          <p className="text-xs text-brand-textMuted">Live click, conversion, and payout tracking.</p>
        </div>

        <div className="p-6 rounded-2xl bg-brand-card border border-brand-border space-y-2 text-center">
          <ShieldCheck className="w-8 h-8 text-brand-accentGlow mx-auto" />
          <h3 className="font-bold text-brand-heading text-sm">Fast Payouts</h3>
          <p className="text-xs text-brand-textMuted">Monthly payouts via Crypto or Bank Wire.</p>
        </div>
      </div>

      <div className="p-6 sm:p-8 rounded-2xl bg-brand-card border border-brand-border space-y-4">
        <h3 className="font-bold text-brand-heading text-base">Apply for Affiliate Partnership</h3>
        
        {submitted ? (
          <div className="p-6 rounded-xl bg-forest-50 border border-brand-success/40 text-center text-xs text-brand-success">
            Application submitted! Our partner team will review your channel and contact you within 48 hours.
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-brand-textMuted block mb-1">Full Name *</label>
                <input type="text" required className="w-full bg-brand-dark border border-brand-border rounded-xl px-3 py-2 text-brand-heading focus:outline-none focus:" />
              </div>
              <div>
                <label className="text-brand-textMuted block mb-1">Email Address *</label>
                <input type="email" required className="w-full bg-brand-dark border border-brand-border rounded-xl px-3 py-2 text-brand-heading focus:outline-none focus:" />
              </div>
            </div>

            <div>
              <label className="text-brand-textMuted block mb-1">Website / Platform / Channel URL *</label>
              <input type="url" required placeholder="https://" className="w-full bg-brand-dark border border-brand-border rounded-xl px-3 py-2 text-brand-heading focus:outline-none focus:" />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-brand-accent hover:bg-brand-accentHover text-brand-onAccent font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.12em] rounded-xl transition-colors"
            >
              Submit Affiliate Application
            </button>
          </form>
        )}
      </div>

    </div>
  );
}
