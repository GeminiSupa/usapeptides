'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Truck, Sparkles, ArrowRight, Award, FlaskConical } from 'lucide-react';

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-brand-darker via-brand-dark to-brand-darker py-16 lg:py-24 border-b border-brand-border">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-brand-accent/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Text Column */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-card border border-brand-accent/40 text-cyan-400 text-xs font-semibold shadow-inner">
              <Sparkles className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
              <span>For In-Vitro Research • Supplied in the USA</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.15]">
              High-Purity <br className="hidden sm:inline" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500">
                Research Peptides
              </span>
            </h1>

            <p className="text-base sm:text-lg text-gray-300 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-normal">
              HPLC-verified laboratory peptides shipped directly from our USA facility. Third-party tested with published Certificates of Analysis per product.
            </p>

            {/* Bullet points */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-left max-w-xl mx-auto lg:mx-0">
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-brand-card/60 border border-brand-border/60">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span className="text-xs font-medium text-gray-200">HPLC Verified &gt;99%</span>
              </div>
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-brand-card/60 border border-brand-border/60">
                <Award className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <span className="text-xs font-medium text-gray-200">3rd-Party Lab Tested</span>
              </div>
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-brand-card/60 border border-brand-border/60">
                <Truck className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <span className="text-xs font-medium text-gray-200">Fast USA Tracked</span>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-4">
              <Link
                href="/shop"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-brand-accent via-blue-600 to-cyan-500 hover:from-blue-500 hover:to-brand-accent text-white font-bold text-sm shadow-xl shadow-brand-accent/30 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 border border-cyan-300/40"
              >
                <span>Shop Research Peptides</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/blog"
                className="w-full sm:w-auto px-6 py-4 rounded-xl bg-brand-card hover:bg-brand-cardHover border border-brand-border text-gray-200 hover:text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
              >
                <FlaskConical className="w-4 h-4 text-cyan-400" />
                <span>Verify HPLC Reports</span>
              </Link>
            </div>

            {/* Micro disclaimer */}
            <p className="text-[11px] text-gray-500 leading-tight pt-2">
              *Research use only. Not for human or veterinary use. Sale is restricted to laboratory institutions, universities, and licensed researchers.
            </p>
          </div>

          {/* Right Showcase Column */}
          <div className="lg:col-span-5 relative flex items-center justify-center">
            <div className="relative w-full max-w-md aspect-square rounded-3xl bg-gradient-to-tr from-brand-card via-brand-dark to-brand-card p-4 border border-brand-border shadow-2xl shadow-cyan-950/40 flex items-center justify-center group overflow-hidden">
              
              {/* Glow ring */}
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-blue-600/10 rounded-3xl" />
              
              {/* Product Vials Image */}
              <img
                src="https://battlebornresearch.com/wp-content/uploads/2025/11/3-Vials-BPC-TB-CJCb-1.png"
                alt="Lyophilized research peptide vials"
                className="w-4/5 h-auto object-contain relative z-10 filter drop-shadow-[0_20px_30px_rgba(0,180,255,0.25)] group-hover:scale-105 transition-transform duration-500"
              />

              {/* Floating verification badge */}
              <div className="absolute bottom-4 left-4 right-4 bg-brand-darker/90 backdrop-blur-md border border-brand-border/80 p-3 rounded-2xl flex items-center justify-between z-20 shadow-lg">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Batch Lot Verified</div>
                    <div className="text-[10px] text-brand-textMuted">Purity: 99.64% HPLC</div>
                  </div>
                </div>
                <Link
                  href="/shop"
                  className="px-3 py-1.5 rounded-lg bg-brand-accent/20 hover:bg-brand-accent/30 text-cyan-400 text-xs font-semibold border border-cyan-500/30 transition-colors"
                >
                  View COA
                </Link>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
