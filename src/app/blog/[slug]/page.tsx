'use client';

import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { articles } from '@/data/articles';
import { ArrowLeft, Clock, User, Tag, Calendar, Share2, ShieldCheck } from 'lucide-react';

interface ArticlePageProps {
  params: {
    slug: string;
  };
}

export default function ArticleDetailPage({ params }: ArticlePageProps) {
  const article = articles.find((a) => a.slug === params.slug);

  if (!article) {
    notFound();
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      
      <Link href="/blog" className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:underline">
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to All Publications</span>
      </Link>

      <div className="space-y-4">
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 font-semibold border border-cyan-500/40">
            {article.category}
          </span>
          <span>{article.date}</span>
          <span>•</span>
          <span>{article.readTime}</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
          {article.title}
        </h1>

        <div className="flex items-center gap-2 text-xs text-gray-400 border-b border-brand-border pb-4">
          <span>Author: <strong className="text-gray-200">{article.author}</strong></span>
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
      <div className="prose prose-invert max-w-none text-xs sm:text-sm text-gray-300 leading-relaxed space-y-6">
        <div className="p-4 rounded-xl bg-brand-card border border-brand-border text-xs text-cyan-200 font-medium">
          {article.excerpt}
        </div>

        <div className="whitespace-pre-line space-y-4">
          {article.content}
        </div>
      </div>

      {/* Tags */}
      <div className="pt-6 border-t border-brand-border flex items-center gap-2 flex-wrap text-xs">
        <span className="text-gray-500 font-semibold">Tags:</span>
        {article.tags.map((tag, i) => (
          <span key={i} className="px-2.5 py-1 rounded-lg bg-brand-card border border-brand-border text-gray-300">
            #{tag}
          </span>
        ))}
      </div>

    </div>
  );
}
