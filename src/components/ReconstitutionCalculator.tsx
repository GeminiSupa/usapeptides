'use client';

import React, { useState } from 'react';
import { Calculator, Droplet, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function ReconstitutionCalculator() {
  const [vialMg, setVialMg] = useState<number>(5);
  const [bacMl, setBacMl] = useState<number>(2.0);
  const [targetMcg, setTargetMcg] = useState<number>(250);
  const [syringeType, setSyringeType] = useState<'100' | '50' | '30'>('100');

  // Calculations
  const totalMcg = vialMg * 1000;
  const concentrationMcgPerMl = bacMl > 0 ? totalMcg / bacMl : 0;
  
  // Insulin Syringe units: 1 mL = 100 units (U-100) -> 1 unit = 0.01 mL
  const volumeNeededMl = concentrationMcgPerMl > 0 ? targetMcg / concentrationMcgPerMl : 0;
  const syringeUnits = volumeNeededMl * 100;

  const maxUnits = syringeType === '100' ? 100 : syringeType === '50' ? 50 : 30;
  const fillPercent = Math.min(100, (syringeUnits / maxUnits) * 100);

  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl p-6 sm:p-8 shadow-xl">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-brand-border">
        <div className="w-10 h-10 rounded-xl bg-brand-accent/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
          <Calculator className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Laboratory Reconstitution Calculator</h3>
          <p className="text-xs text-brand-textMuted">Calculate diluent volume, concentration, and insulin syringe unit markings</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Controls Column */}
        <div className="lg:col-span-6 space-y-5">
          {/* Vial Size */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
              1. Peptide Vial Mass (mg)
            </label>
            <div className="grid grid-cols-5 gap-2 mb-2">
              {[2, 5, 10, 15, 50].map((mg) => (
                <button
                  key={mg}
                  onClick={() => setVialMg(mg)}
                  className={`py-2 rounded-lg text-xs font-bold transition-all border ${
                    vialMg === mg
                      ? 'bg-brand-accent text-white border-cyan-400 shadow-md shadow-brand-accent/30'
                      : 'bg-brand-dark/80 text-gray-400 border-brand-border hover:text-white'
                  }`}
                >
                  {mg} mg
                </button>
              ))}
            </div>
            <input
              type="number"
              value={vialMg}
              onChange={(e) => setVialMg(Math.max(0.1, parseFloat(e.target.value) || 0))}
              step="0.5"
              className="w-full bg-brand-dark border border-brand-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
              placeholder="Custom mg"
            />
          </div>

          {/* BAC Water Volume */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
              2. Reconstitution Water Volume (mL)
            </label>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {[1.0, 2.0, 3.0, 5.0].map((ml) => (
                <button
                  key={ml}
                  onClick={() => setBacMl(ml)}
                  className={`py-2 rounded-lg text-xs font-bold transition-all border ${
                    bacMl === ml
                      ? 'bg-brand-accent text-white border-cyan-400 shadow-md shadow-brand-accent/30'
                      : 'bg-brand-dark/80 text-gray-400 border-brand-border hover:text-white'
                  }`}
                >
                  {ml.toFixed(1)} mL
                </button>
              ))}
            </div>
            <input
              type="number"
              value={bacMl}
              onChange={(e) => setBacMl(Math.max(0.1, parseFloat(e.target.value) || 0))}
              step="0.5"
              className="w-full bg-brand-dark border border-brand-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
              placeholder="Custom mL"
            />
          </div>

          {/* Target Microgram Dose */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
              3. Desired Research Aliquot Dose (mcg)
            </label>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {[100, 250, 500, 1000].map((mcg) => (
                <button
                  key={mcg}
                  onClick={() => setTargetMcg(mcg)}
                  className={`py-2 rounded-lg text-xs font-bold transition-all border ${
                    targetMcg === mcg
                      ? 'bg-brand-accent text-white border-cyan-400 shadow-md shadow-brand-accent/30'
                      : 'bg-brand-dark/80 text-gray-400 border-brand-border hover:text-white'
                  }`}
                >
                  {mcg} mcg
                </button>
              ))}
            </div>
            <input
              type="number"
              value={targetMcg}
              onChange={(e) => setTargetMcg(Math.max(1, parseFloat(e.target.value) || 0))}
              step="25"
              className="w-full bg-brand-dark border border-brand-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
              placeholder="Custom mcg dose"
            />
          </div>

          {/* Syringe Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
              4. Syringe Capacity
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { type: '100', label: '1.0 mL (100 Units)' },
                { type: '50', label: '0.5 mL (50 Units)' },
                { type: '30', label: '0.3 mL (30 Units)' },
              ].map((s) => (
                <button
                  key={s.type}
                  onClick={() => setSyringeType(s.type as any)}
                  className={`py-2 px-1 rounded-lg text-xs font-medium transition-all border ${
                    syringeType === s.type
                      ? 'bg-cyan-950/80 text-cyan-300 border-cyan-400'
                      : 'bg-brand-dark/80 text-gray-400 border-brand-border hover:text-white'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Output & Syringe Visualization Column */}
        <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
          
          {/* Readout Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-brand-darker via-brand-dark to-brand-darker border border-brand-accent/40 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-brand-textMuted uppercase font-bold tracking-wider">
                Reconstituted Result
              </span>
              <span className="text-[10px] bg-emerald-950/80 text-emerald-400 px-2 py-0.5 rounded font-mono border border-emerald-500/30">
                Ready for Analysis
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 py-2 border-y border-brand-border/60">
              <div>
                <span className="text-[10px] text-gray-500 uppercase block">Total Solution</span>
                <span className="text-lg font-bold text-white">{bacMl.toFixed(1)} mL</span>
                <span className="text-[10px] text-gray-400 block">{totalMcg.toLocaleString()} mcg total</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase block">Concentration</span>
                <span className="text-lg font-bold text-cyan-400">{concentrationMcgPerMl.toFixed(0)} mcg/mL</span>
                <span className="text-[10px] text-gray-400 block">{(concentrationMcgPerMl / 100).toFixed(1)} mcg / unit</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-cyan-950/40 border border-cyan-500/40 text-center">
              <span className="text-xs text-cyan-300 font-medium block mb-1">
                Draw to Syringe Tick Mark:
              </span>
              <div className="text-3xl sm:text-4xl font-black text-white tracking-tight flex items-baseline justify-center gap-1.5">
                <span>{syringeUnits.toFixed(1)}</span>
                <span className="text-sm font-semibold text-cyan-400">UNITS</span>
              </div>
              <span className="text-[11px] text-gray-400 block mt-1">
                ({volumeNeededMl.toFixed(3)} mL = {targetMcg} mcg)
              </span>
            </div>
          </div>

          {/* Interactive Syringe Visualizer */}
          <div className="p-4 rounded-2xl bg-brand-darker border border-brand-border space-y-2">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Syringe Fill Graphic ({syringeType} U max)</span>
              <span className="font-mono text-cyan-400 font-bold">{syringeUnits.toFixed(1)} / {maxUnits} Units</span>
            </div>

            {/* Syringe Barrel */}
            <div className="relative w-full h-8 bg-slate-900 border-2 border-gray-600 rounded-r-lg overflow-hidden flex items-center">
              {/* Fluid fill */}
              <div
                className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-300"
                style={{ width: `${Math.min(100, fillPercent)}%` }}
              />

              {/* Tick marks overlay */}
              <div className="absolute inset-0 flex justify-between px-2 items-center pointer-events-none opacity-40">
                {Array.from({ length: 11 }).map((_, i) => (
                  <div key={i} className="h-4 w-[1px] bg-white" />
                ))}
              </div>
            </div>

            <div className="text-[10px] text-gray-500 text-center pt-1">
              *Syringe graphic is for calculation aid only. Always verify volume markings on sterile lab equipment.
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
