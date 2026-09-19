'use client';

import React, { useState, useMemo } from 'react';
import ProductCard from '@/components/ProductCard';
import CatalogueViewToggle, { useCatalogueView } from '@/components/CatalogueViewToggle';
import { useCatalogue } from '@/hooks/useCatalogue';
import { useCategories } from '@/hooks/useCategories';
import { useSiteContent } from '@/components/SiteContentProvider';
import { 
  Filter, 
  Search, 
  ArrowUpDown, 
  Check, 
  ShieldCheck, 
  FlaskConical,
  X
} from 'lucide-react';

export default function ShopPage() {
  const categories = useCategories();
  const { t } = useSiteContent();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'featured' | 'price-low' | 'price-high' | 'name'>('featured');
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [filtersOpen, setFiltersOpen] = useState<boolean>(false);

  const { products } = useCatalogue();
  const [view, setView] = useCatalogueView();

  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        if (selectedCategory !== 'all' && !(p.categorySlugs?.includes(selectedCategory) || p.categorySlug === selectedCategory)) {
          return false;
        }
        if (inStockOnly && !p.inStock) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = p.name.toLowerCase().includes(q);
          const matchSku = p.sku.toLowerCase().includes(q);
          const matchCat = (p.categories ?? [p.category]).some((name) => name.toLowerCase().includes(q));
          const matchTag = p.tags.some((t) => t.toLowerCase().includes(q));
          if (!matchName && !matchSku && !matchCat && !matchTag) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const priceA = a.salePrice ?? a.price;
        const priceB = b.salePrice ?? b.price;
        if (sortBy === 'price-low') return priceA - priceB;
        if (sortBy === 'price-high') return priceB - priceA;
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0);
      });
  }, [products, selectedCategory, searchQuery, sortBy, inStockOnly]);

  return (
    <div className="shell space-y-6 py-7 sm:space-y-8 sm:py-10">
      
      {/* Page Header */}
      <div className="border-b border-brand-border pb-6">
        <div className="eyebrow mb-2.5">
          {t('shop.eyebrow')}
        </div>
        <h1 className="page-title">
          {t('shop.title')}
        </h1>
        <p className="text-xs sm:text-sm text-brand-textMuted mt-2 max-w-2xl leading-relaxed">
          {t('shop.intro')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left Sidebar Filters */}
        <div className="space-y-3 lg:space-y-6">
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            className="flex min-h-12 w-full items-center justify-between border border-brand-border bg-brand-card px-4 font-display text-xs font-extrabold uppercase tracking-[0.1em] text-brand-heading lg:hidden"
          >
            <span className="flex items-center gap-2"><Filter className="h-4 w-4" /> Filter products</span>
            <span className="text-brand-textMuted">{filtersOpen ? 'Close' : 'Open'}</span>
          </button>
          <div className={`${filtersOpen ? 'block' : 'hidden'} space-y-6 border border-brand-border bg-brand-card p-4 lg:block lg:p-5`}>
            <div className="flex items-center justify-between pb-3 border-b border-brand-border">
              <span className="font-bold text-xs uppercase text-brand-heading flex items-center gap-2">
                <Filter className="w-4 h-4 text-brand-accentGlow" />
                Filter Compounds
              </span>
              {(selectedCategory !== 'all' || searchQuery || inStockOnly) && (
                <button
                  onClick={() => {
                    setSelectedCategory('all');
                    setSearchQuery('');
                    setInStockOnly(false);
                  }}
                  className="text-[11px] text-red-600 hover:underline flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            {/* Keyword Search */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-brand-body block">
                Search Within Catalog
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-brand-textMuted absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. BPC, Tirz, 10mg..."
                  className="w-full bg-brand-dark border border-brand-border rounded-xl pl-9 pr-3 py-2 text-xs text-brand-heading placeholder-brand-textMuted focus:outline-none focus:"
                />
              </div>
            </div>

            {/* In Stock toggle */}
            <div className="pt-2">
              <label 
                className="flex items-center gap-2.5 text-xs text-brand-body cursor-pointer select-none"
                onClick={() => setInStockOnly(!inStockOnly)}
              >
                <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                  inStockOnly ? 'bg-cyan-500 border-brand-accentGlow text-black' : 'bg-brand-dark border-brand-border'
                }`}>
                  {inStockOnly && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <span>In-Stock Items Only</span>
              </label>
            </div>

            {/* Category Filter */}
            <div className="space-y-2 pt-2 border-t border-brand-border/60">
              <label className="text-xs font-semibold text-brand-body block">
                Research Categories
              </label>
              <div className="space-y-1">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                    selectedCategory === 'all'
                      ? 'bg-brand-accent text-brand-onAccent font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.12em]'
                      : 'text-brand-textMuted hover:text-brand-heading hover:bg-brand-dark'
                  }`}
                >
                  <span>All Categories</span>
                  <span className="text-[10px] opacity-70 font-mono">{products.length}</span>
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.slug)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                      selectedCategory === cat.slug
                        ? 'bg-brand-accent text-brand-onAccent font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.12em]'
                        : 'text-brand-textMuted hover:text-brand-heading hover:bg-brand-dark'
                    }`}
                  >
                    <span className="truncate pr-2">{cat.name}</span>
                    <span className="text-[10px] opacity-70 font-mono flex-shrink-0">{cat.count}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Products Area */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Top Bar Sort & Count */}
          <div className="flex flex-col items-start justify-between gap-3 border border-brand-border bg-brand-card p-4 text-xs sm:flex-row sm:items-center">
            <span className="text-brand-textMuted">
              Showing <strong className="text-brand-heading">{filteredProducts.length}</strong> research compounds
            </span>

            <div className="flex w-full items-center gap-2 sm:w-auto sm:justify-end">
              <span className="text-brand-textMuted flex items-center gap-1 flex-shrink-0">
                <ArrowUpDown className="w-3.5 h-3.5 text-brand-accentGlow" />
                Sort By:
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="min-h-11 min-w-0 flex-1 border border-brand-border bg-brand-dark px-3 py-2 text-xs text-brand-heading focus:outline-none sm:flex-none"
              >
                <option value="featured">Featured / Popular</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="name">Product Name (A-Z)</option>
              </select>
              <CatalogueViewToggle view={view} onChange={setView} />
            </div>
          </div>

          {/* Product Grid */}
          {filteredProducts.length === 0 ? (
            <div className="text-center py-20 p-8 rounded-2xl bg-brand-card border border-brand-border space-y-3">
              <FlaskConical className="w-12 h-12 mx-auto text-brand-textMuted animate-pulse" />
              <h3 className="text-base font-bold text-brand-heading">No research peptides match your filters</h3>
              <p className="text-xs text-brand-textMuted max-w-sm mx-auto">
                Try selecting &quot;All Categories&quot; or clearing your active search terms.
              </p>
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setSearchQuery('');
                  setInStockOnly(false);
                }}
                className="px-4 py-2 bg-brand-accent rounded-xl text-xs font-bold text-brand-onAccent"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className={view === 'row' ? 'space-y-3' : 'grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3'}>
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} layout={view} />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
