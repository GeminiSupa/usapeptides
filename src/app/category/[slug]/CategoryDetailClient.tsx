'use client';

import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ProductCard from '@/components/ProductCard';
import { products } from '@/data/products';
import { categories } from '@/data/categories';
import { ArrowLeft, FlaskConical, ShieldCheck, ChevronRight } from 'lucide-react';

interface CategoryPageProps {
  params: {
    slug: string;
  };
}

export default function CategoryDetailClient({ slug }: { slug: string }) {
  const params = { slug };
  const category = categories.find((c) => c.slug === params.slug);

  if (!category) {
    notFound();
  }

  const categoryProducts = products.filter((p) => p.categorySlug === category.slug);

  return (
    <div className="shell py-10 space-y-8">
      
      {/* Breadcrumb navigation */}
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <Link href="/" className="hover:text-cyan-400">Home</Link>
        <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
        <Link href="/shop" className="hover:text-cyan-400">Categories</Link>
        <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
        <span className="text-white font-medium truncate">{category.name}</span>
      </div>

      {/* Category Banner */}
      <div className="p-8 rounded-3xl bg-brand-card border border-brand-border space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs font-semibold">
          <FlaskConical className="w-3.5 h-3.5" />
          <span>Analytical Pathway Group</span>
        </div>
        <h1 className="page-title">
          {category.name}
        </h1>
        <p className="text-sm text-gray-300 max-w-2xl leading-relaxed">
          {category.description} All compounds tested by analytical RP-HPLC and supplied lyophilized in sterile borosilicate glass vials for in-vitro experimentation.
        </p>
      </div>

      {/* Products Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>Available Compounds: <strong className="text-white font-mono">{categoryProducts.length}</strong></span>
          <Link href="/shop" className="text-cyan-400 hover:underline flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>All Categories</span>
          </Link>
        </div>

        {categoryProducts.length === 0 ? (
          <div className="text-center py-16 p-8 rounded-2xl bg-brand-card border border-brand-border">
            <p className="text-sm text-gray-400">No products currently listed under this category.</p>
            <Link href="/shop" className="mt-4 inline-block px-4 py-2 bg-brand-accent text-white font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.12em] rounded-xl">
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
