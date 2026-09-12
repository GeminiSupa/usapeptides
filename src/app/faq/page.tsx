'use client';

import React, { useState } from 'react';
import { faqs } from '@/data/faqs';
import { ChevronDown, HelpCircle, Search } from 'lucide-react';

export default function FAQPage() {
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
          Support &amp; Answers
        </div>
        <h1 className="page-title">
          Frequently Asked Questions
        </h1>
        <p className="text-xs sm:text-sm text-gray-400 mt-2">
          Find answers regarding ordering, HPLC testing verification, domestic shipping, and laboratory peptide storage.
        </p>
      </div>

      {/* Search & Category Filter */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search FAQs..."
            className="w-full bg-brand-card border border-brand-border rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCat(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                selectedCat === cat
                  ? 'bg-brand-accent text-white border-cyan-400 font-bold'
                  : 'bg-brand-dark border-brand-border text-gray-400 hover:text-white'
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
              className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 text-xs sm:text-sm font-bold text-white hover:text-cyan-400 transition-colors"
            >
              <span className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                {faq.question}
              </span>
              <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${
                openIndex === idx ? 'rotate-180 text-cyan-400' : ''
              }`} />
            </button>

            {openIndex === idx && (
              <div className="px-5 pb-5 pt-1 text-xs text-gray-300 leading-relaxed border-t border-brand-border/40 bg-brand-dark/30 animate-fadeIn">
                {faq.answer}
              </div>
            )}
          </div>
        ))}
      </div>

    </div>
  );
}
