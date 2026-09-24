'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSiteContent } from '@/components/SiteContentProvider';
import { parseFaqs } from '@/lib/siteContent';
import { ChevronDown, HelpCircle, Search } from 'lucide-react';

export default function FAQPage() {
  const { t } = useSiteContent();
  const faqs = React.useMemo(() => parseFaqs(t('faq.items')), [t('faq.items')]); // eslint-disable-line react-hooks/exhaustive-deps
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('All');

  const categories = ['All', ...Array.from(new Set(faqs.map((f) => f.category)))];

  const filteredFaqs = faqs.filter((faq) => {
    if (selectedCat !== 'All' && faq.category !== selectedCat) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return faq.question.toLowerCase().includes(q) || faq.answer.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="shell max-w-4xl py-10 space-y-8">
      
      <div className="border-b border-brand-border pb-6">
        <div className="eyebrow mb-2.5">
          {t('faq.eyebrow')}
        </div>
        <h1 className="page-title">
          {t('faq.title')}
        </h1>
        <p className="text-xs sm:text-sm text-brand-textMuted mt-2">
          {t('faq.intro')}
        </p>
      </div>

      {/* Search & Category Filter */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="w-4 h-4 text-brand-textMuted absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search FAQs..."
            className="w-full bg-brand-card border border-brand-border rounded-xl pl-10 pr-4 py-2.5 text-xs text-brand-heading placeholder-brand-textMuted focus:outline-none focus:"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCat(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                selectedCat === cat
                  ? 'bg-brand-accent text-brand-onAccent border-brand-accentGlow font-bold'
                  : 'bg-brand-dark border-brand-border text-brand-textMuted hover:text-brand-heading'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Accordion List */}
      <div className="space-y-3">
        {filteredFaqs.map((faq, idx) => (
          <div
            key={idx}
            className="rounded-2xl bg-brand-card border border-brand-border overflow-hidden transition-colors"
          >
            <button
              onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
              className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 text-xs sm:text-sm font-bold text-brand-heading hover:text-brand-accentGlow transition-colors"
            >
              <span className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-brand-accentGlow flex-shrink-0" />
                {faq.question}
              </span>
              <ChevronDown className={`w-4 h-4 text-brand-textMuted flex-shrink-0 transition-transform ${
                openIndex === idx ? 'rotate-180 text-brand-accentGlow' : ''
              }`} />
            </button>

            {openIndex === idx && (
              <div className="px-5 pb-5 pt-1 text-xs text-brand-body leading-relaxed border-t border-brand-border/40 bg-brand-dark/30 animate-fadeIn">
                {faq.answer}
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredFaqs.length === 0 && (
        <p className="border border-brand-border bg-brand-card p-5 text-xs text-brand-textMuted">
          No question matches that search yet. Try a different word, or ask us directly.
        </p>
      )}

      {/* The writer's research and handling questions live with the articles
          that explain them, so this page stays about ordering and policy. */}
      <div className="space-y-4 border-t border-brand-border pt-8">
        <h2 className="section-title">Looking for the science?</h2>
        <p className="max-w-2xl text-xs leading-relaxed text-brand-body sm:text-sm">
          Questions about research peptides, Certificates of Analysis, HPLC, lot numbers, storage
          and laboratory terminology are answered in the Knowledge Center.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/knowledge-center" className="btn-ghost">Knowledge Center</Link>
          <Link href="/coa-database" className="btn-ghost">COA database</Link>
          <Link href="/contact-us" className="btn-ghost">Contact support</Link>
        </div>
      </div>

    </div>
  );
}
