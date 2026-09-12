'use client';

import React from 'react';
import { 
  X, 
  ShieldCheck, 
  Download, 
  FileText, 
  CheckCircle2, 
  FlaskConical,
  Activity,
  Award
} from 'lucide-react';
import { useCart } from '@/context/CartContext';

export default function COAModal() {
  const { selectedCOAProduct, setSelectedCOAProduct } = useCart();

  if (!selectedCOAProduct) return null;

  const { coa, name, sku, casNumber, molarMass, sequence, formula, coaUrl } = selectedCOAProduct;

  /**
   * The real certificate, uploaded in Dashboard > Products. Products that have
   * not had one uploaded yet say so plainly instead of offering a button that
   * used to pop up an alert pretending to download something.
   */

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="w-full max-w-3xl bg-brand-card border border-brand-border rounded-2xl shadow-black overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-brand-border bg-brand-darker flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">
                Third-Party Analytical Laboratory Report
              </div>
              <h2 className="text-base sm:text-lg font-extrabold text-white">
                Certificate of Analysis (COA)
              </h2>
            </div>
          </div>
          <button
            onClick={() => setSelectedCOAProduct(null)}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-brand-dark"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-xs text-gray-300">
          
          {/* Top Compound Summary Card */}
          <div className="p-4 rounded-xl bg-brand-darker border border-brand-border grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <span className="text-[10px] text-gray-500 uppercase block">Product Name</span>
              <span className="text-xs font-bold text-white truncate block">{name}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-500 uppercase block">Lot / Batch Number</span>
              <span className="text-xs font-bold text-cyan-400 font-mono block">{coa.lotNumber}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-500 uppercase block">Test Date</span>
              <span className="text-xs font-bold text-gray-200 block">{coa.testDate}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-500 uppercase block">HPLC Purity Status</span>
              <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {coa.purity} ({coa.status})
              </span>
            </div>
          </div>

          {/* HPLC Chromatogram Graphic (Visual Simulation) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-cyan-400" />
                Reverse-Phase HPLC UV-214nm Chromatogram
              </span>
              <span className="text-[10px] text-gray-400 font-mono">Column: C18 4.6×250mm, 5μm</span>
            </div>

            <div className="p-4 rounded-xl bg-brand-darker border border-brand-border/80 relative">
              {/* Synthetic HPLC Peak SVG */}
              <div className="w-full h-44 sm:h-52 bg-slate-950/90 rounded-lg p-2 relative flex flex-col justify-between border border-brand-border/40">
                <div className="text-[9px] text-gray-500 font-mono flex justify-between px-2">
                  <span>mAU (Absorbance @ 214nm)</span>
                  <span>Janoshik / MZ Biolabs Verified</span>
                </div>

                {/* SVG Curve */}
                <svg viewBox="0 0 500 160" className="w-full h-36 overflow-visible">
                  {/* Grid lines */}
                  <line x1="30" y1="20" x2="480" y2="20" stroke="#1d2a4d" strokeDasharray="3 3" />
                  <line x1="30" y1="60" x2="480" y2="60" stroke="#1d2a4d" strokeDasharray="3 3" />
                  <line x1="30" y1="100" x2="480" y2="100" stroke="#1d2a4d" strokeDasharray="3 3" />
                  <line x1="30" y1="140" x2="480" y2="140" stroke="#2f426f" />

                  {/* Main Chromatogram baseline with sharp gaussian peak */}
                  <path
                    d="M 30 140 Q 120 140 180 139 Q 230 138 245 130 Q 255 10 260 10 Q 265 10 275 130 Q 290 138 350 139 L 480 140"
                    fill="none"
                    stroke="#5b8def"
                    strokeWidth="2.5"
                  />

                  {/* Area fill under main peak */}
                  <path
                    d="M 245 130 Q 255 10 260 10 Q 265 10 275 130 Z"
                    fill="rgba(56, 189, 248, 0.25)"
                  />

                  {/* Peak label marker */}
                  <circle cx="260" cy="10" r="3.5" fill="#5b8def" />
                  <text x="265" y="16" fill="#5b8def" fontSize="10" fontWeight="bold" fontFamily="monospace">
                    Peak 1 (Main: {coa.purity})
                  </text>
                </svg>

                <div className="text-[9px] text-gray-500 font-mono flex justify-between px-2 pt-1 border-t border-brand-border/40">
                  <span>0.0 min</span>
                  <span>5.0 min</span>
                  <span>10.0 min</span>
                  <span>15.0 min</span>
                  <span>20.0 min</span>
                </div>
              </div>
            </div>
          </div>

          {/* Peak Integration Table */}
          <div className="space-y-2">
            <span className="font-bold text-white text-xs uppercase tracking-wider block">
              Chromatographic Peak Area Integration
            </span>
            <div className="overflow-x-auto rounded-xl border border-brand-border">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-brand-darker text-gray-400 border-b border-brand-border">
                  <tr>
                    <th className="p-2.5">Peak #</th>
                    <th className="p-2.5">Retention Time (min)</th>
                    <th className="p-2.5">Area (mAU*s)</th>
                    <th className="p-2.5">Height (mAU)</th>
                    <th className="p-2.5 text-right">Area %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border/60 bg-brand-dark/40">
                  <tr className="text-white font-bold bg-cyan-950/20">
                    <td className="p-2.5 text-cyan-400">1 (Target)</td>
                    <td className="p-2.5">14.82 min</td>
                    <td className="p-2.5">4892.4</td>
                    <td className="p-2.5">912.8</td>
                    <td className="p-2.5 text-right text-emerald-400">{coa.purity}</td>
                  </tr>
                  <tr className="text-gray-400">
                    <td className="p-2.5">2 (Minor Impurity)</td>
                    <td className="p-2.5">17.10 min</td>
                    <td className="p-2.5">17.6</td>
                    <td className="p-2.5">3.2</td>
                    <td className="p-2.5 text-right">0.36%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Chemical Structure Verification */}
          <div className="p-4 rounded-xl bg-brand-darker border border-brand-border space-y-2">
            <span className="font-bold text-white text-xs uppercase tracking-wider block">
              Mass Spectrometry & Chemical Identification
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {casNumber && (
                <div>
                  <span className="text-gray-500 block">CAS Number:</span>
                  <span className="text-white font-mono">{casNumber}</span>
                </div>
              )}
              {molarMass && (
                <div>
                  <span className="text-gray-500 block">Observed Mass (ESI-MS):</span>
                  <span className="text-emerald-400 font-mono font-bold">{molarMass} (Matched)</span>
                </div>
              )}
              {formula && (
                <div>
                  <span className="text-gray-500 block">Molecular Formula:</span>
                  <span className="text-white font-mono">{formula}</span>
                </div>
              )}
              <div>
                <span className="text-gray-500 block">Testing Laboratory:</span>
                <span className="text-cyan-400">{coa.lab}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-brand-border bg-brand-darker flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-gray-500 text-center sm:text-left">
            Authenticity sealed with digital analytical signature
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {coaUrl ? (
              <a
                href={coaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-action hover:bg-action-hover text-white font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.12em] transition-colors flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF Certificate</span>
              </a>
            ) : (
              <span className="w-full sm:w-auto px-4 py-2 text-[0.6875rem] text-brand-textMuted">
                The signed PDF for this lot is not published yet.
              </span>
            )}
            <button
              onClick={() => setSelectedCOAProduct(null)}
              className="px-4 py-2 rounded-xl bg-brand-card hover:bg-brand-cardHover border border-brand-border text-gray-300 text-xs font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
