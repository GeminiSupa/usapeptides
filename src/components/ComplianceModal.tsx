'use client';

import React, { useState, useEffect } from 'react';
import { ShieldAlert, CheckCircle2, Lock } from 'lucide-react';

export default function ComplianceModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [remember, setRemember] = useState(true);

  useEffect(() => {
    try {
      const acknowledged = localStorage.getItem('bbp_research_disclaimer_ack');
      if (!acknowledged) {
        setIsOpen(true);
      }
    } catch (e) {
      setIsOpen(true);
    }
  }, []);

  const handleAccept = () => {
    if (remember) {
      try {
        localStorage.setItem('bbp_research_disclaimer_ack', 'true');
      } catch (e) {}
    }
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
      <div 
        className="w-full max-w-lg bg-brand-card border border-brand-border rounded-2xl p-6 space-y-5 text-center sm:text-left"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 border border-amber-500/40 flex items-center justify-center text-red-700 flex-shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-red-700 tracking-wider block">
              Mandatory Regulatory Notice
            </span>
            <h2 className="text-lg sm:text-xl font-extrabold text-brand-heading">
              Laboratory Research Use Only
            </h2>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-brand-darker border border-brand-border text-xs text-brand-body space-y-3 leading-relaxed">
          <p>
            Please confirm and acknowledge the following conditions before accessing this catalog:
          </p>
          <ul className="space-y-2 text-left text-[11px] text-brand-body">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-brand-accentGlow flex-shrink-0 mt-0.5" />
              <span>You represent an institution, university, corporate R&D facility, or qualified researcher.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-brand-accentGlow flex-shrink-0 mt-0.5" />
              <span>All compounds are purchased strictly for <strong>in-vitro laboratory experimentation</strong>.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-brand-accentGlow flex-shrink-0 mt-0.5" />
              <span>These products are <strong>NOT for human consumption</strong>, clinical use, or veterinary application.</span>
            </li>
          </ul>
        </div>

        <div className="flex items-center gap-2 text-xs text-brand-textMuted cursor-pointer justify-center sm:justify-start" onClick={() => setRemember(!remember)}>
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="rounded bg-brand-dark border-brand-border text-brand-accent focus:ring-0"
          />
          <span>Remember my acknowledgment on this browser</span>
        </div>

        <div className="pt-2">
          <button
            onClick={handleAccept}
            className="w-full py-3.5 px-6 rounded-xl bg-brand-accent hover:bg-brand-accentHover text-brand-onAccent font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.12em] transition-all"
          >
            I Acknowledge & Agree (Enter Site)
          </button>
        </div>
      </div>
    </div>
  );
}
