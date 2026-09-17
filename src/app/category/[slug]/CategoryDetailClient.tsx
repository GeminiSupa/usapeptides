'use client';

import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ProductCard from '@/components/ProductCard';
import { useCatalogue } from '@/hooks/useCatalogue';
import { useCategory } from '@/hooks/useCategories';
import { ArrowLeft, FlaskConical, ShieldCheck, ChevronRight } from 'lucide-react';

interface CategoryPageProps {
  params: {
    slug: string;
  };
}

export default function CategoryDetailClient({ slug }: { slug: string }) {
  const { category, loading } = useCategory(slug);

  if (loading) {
    return <div className="shell py-16 text-sm text-brand-textMuted">Loading category…</div>;
  }

  if (!category) {
    notFound();
  }

  const { products } = useCatalogue();
  const categoryProducts = products.filter((p) => p.categorySlug === category.slug);

  return (
    <div className="shell py-10 space-y-8">
      
      {/* Breadcrumb navigation */}
      <div className="flex items-center gap-2 text-xs text-brand-textMuted">
        <Link href="/" className="hover:text-brand-accentGlow">Home</Link>
        <ChevronRight className="w-3.5 h-3.5 text-brand-textMuted" />
        <Link href="/shop" className="hover:text-brand-accentGlow">Categories</Link>
        <ChevronRight className="w-3.5 h-3.5 text-brand-textMuted" />
        <span className="text-brand-heading font-medium truncate">{category.name}</span>
      </div>

      {/* Category Banner */}
      <div className="p-8 rounded-3xl bg-brand-card border border-brand-border space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-navy-50 border border-brand-accentGlow/40 text-brand-accentGlow text-xs font-semibold">
          <FlaskConical className="w-3.5 h-3.5" />
          <span>Analytical Pathway Group</span>
        </div>
        <h1 className="page-title">
          {category.name}
        </h1>
        <p className="text-sm text-brand-body max-w-2xl leading-relaxed">
          {category.description} All compounds tested by analytical RP-HPLC and supplied lyophilized in sterile borosilicate glass vials for in-vitro experimentation.
        </p>
      </div>

      {/* Products Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-brand-textMuted">
          <span>Available Compounds: <strong className="text-brand-heading font-mono">{categoryProducts.length}</strong></span>
          <Link href="/shop" className="text-brand-accentGlow hover:underline flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>All Categories</span>
          </Link>
        </div>

        {categoryProducts.length === 0 ? (
          <div className="text-center py-16 p-8 rounded-2xl bg-brand-card border border-brand-border">
            <p className="text-sm text-brand-textMuted">No products currently listed under this category.</p>
            <Link href="/shop" className="mt-4 inline-block px-4 py-2 bg-brand-accent text-brand-onAccent font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.12em] rounded-xl">
              Back to Catalog
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {categoryProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
