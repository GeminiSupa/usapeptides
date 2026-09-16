'use client';

import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { useArticles } from '@/hooks/useArticles';
import { ArrowLeft, Clock, User, Tag, Calendar, Share2, ShieldCheck } from 'lucide-react';

interface ArticlePageProps {
  params: {
    slug: string;
  };
}

export default function ArticleDetailClient({ slug }: { slug: string }) {
  const { articles, loading } = useArticles();
  const article = articles.find((a) => a.slug === slug);

  if (!article) {
    if (loading) return <div className="shell py-10 text-sm text-brand-textMuted">Loading article...</div>;
    notFound();
  }

  return (
    <div className="shell max-w-4xl py-10 space-y-8">
      
      <Link href="/blog" className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-accentGlow hover:underline">
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to All Publications</span>
      </Link>

      <div className="space-y-4">
        <div className="flex items-center gap-3 text-xs text-brand-textMuted">
          <span className="px-2.5 py-0.5 rounded-full bg-navy-50 text-brand-accentGlow font-semibold border border-brand-accentGlow/40">
            {article.category}
          </span>
          <span>{article.date}</span>
          <span>•</span>
          <span>{article.readTime}</span>
        </div>

        <h1 className="page-title leading-tight">
          {article.title}
        </h1>

        <div className="flex items-center gap-2 text-xs text-brand-textMuted border-b border-brand-border pb-4">
          <span>Author: <strong className="text-brand-body">{article.author}</strong></span>
        </div>
      </div>

      <div className="aspect-video rounded-2xl overflow-hidden border border-brand-border">
        <img
          src={article.image}
          alt={article.title}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Article Content formatted */}
      <div className="prose prose-invert max-w-none text-xs sm:text-sm text-brand-body leading-relaxed space-y-6">
        <div className="p-4 rounded-xl bg-brand-card border border-brand-border text-xs text-brand-accentGlow font-medium">
          {article.excerpt}
        </div>

        <div className="whitespace-pre-line space-y-4">
          {article.content}
        </div>
      </div>

      {/* Tags */}
      <div className="pt-6 border-t border-brand-border flex items-center gap-2 flex-wrap text-xs">
        <span className="text-brand-textMuted font-semibold">Tags:</span>
        {article.tags.map((tag, i) => (
          <span key={i} className="px-2.5 py-1 rounded-lg bg-brand-card border border-brand-border text-brand-body">
            #{tag}
          </span>
        ))}
      </div>

    </div>
  );
}
