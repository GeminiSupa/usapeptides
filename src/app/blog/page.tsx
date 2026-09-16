'use client';

import React from 'react';
import Link from 'next/link';
import { useArticles } from '@/hooks/useArticles';
import { FileText, ArrowRight, Clock, User, Sparkles } from 'lucide-react';

export default function BlogIndexPage() {
  const { articles } = useArticles();
  return (
    <div className="shell py-10 space-y-10">
      
      <div className="border-b border-brand-border pb-6">
        <div className="eyebrow mb-2.5">
          Scientific Library &amp; COA Analysis
        </div>
        <h1 className="page-title">
          Peptide Research &amp; Analytical Guides
        </h1>
        <p className="text-xs sm:text-sm text-brand-textMuted mt-2 max-w-2xl">
          Explore laboratory protocols, HPLC chromatogram reading guides, receptor pathways, and peptide stability research.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {articles.map((art) => (
          <article
            key={art.id}
            className="group rounded-2xl bg-brand-card hover:bg-brand-cardHover border border-brand-border hover:border-brand-accentGlow/40 p-5 flex flex-col justify-between transition-all"
          >
            <div className="space-y-4">
              <div className="aspect-video rounded-xl bg-brand-darker overflow-hidden">
                <img
                  src={art.image}
                  alt={art.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>

              <div className="flex items-center gap-2 text-[10px] text-brand-textMuted">
                <span className="text-brand-accentGlow font-bold uppercase">{art.category}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {art.readTime}
                </span>
              </div>

              <Link href={`/blog/${art.slug}`}>
                <h2 className="text-base font-bold text-brand-heading group-hover:text-brand-accentGlow transition-colors line-clamp-2 leading-snug">
                  {art.title}
                </h2>
              </Link>

              <p className="text-xs text-brand-textMuted line-clamp-3 leading-relaxed">
                {art.excerpt}
              </p>
            </div>

            <div className="pt-4 mt-4 border-t border-brand-border/60 flex items-center justify-between text-xs font-bold text-brand-accentGlow">
              <Link href={`/blog/${art.slug}`} className="hover:underline flex items-center gap-1">
                <span>Read Full Publication</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </article>
        ))}
      </div>

    </div>
  );
}
