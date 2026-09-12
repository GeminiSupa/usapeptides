'use client';

import React, { useState, useMemo } from 'react';
import ProductCard from '@/components/ProductCard';
import { products } from '@/data/products';
import { categories } from '@/data/categories';
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
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'featured' | 'price-low' | 'price-high' | 'name'>('featured');
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);

  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        if (selectedCategory !== 'all' && p.categorySlug !== selectedCategory) {
          return false;
        }
        if (inStockOnly && !p.inStock) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = p.name.toLowerCase().includes(q);
          const matchSku = p.sku.toLowerCase().includes(q);
          const matchCat = p.category.toLowerCase().includes(q);
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
  }, [selectedCategory, searchQuery, sortBy, inStockOnly]);

  return (
    <div className="shell py-10 space-y-8">
      
      {/* Page Header */}
      <div className="border-b border-brand-border pb-6">
        <div className="eyebrow mb-2.5">
          Catalog &amp; Reference Materials
        </div>
        <h1 className="page-title">
          All Research Peptides
        </h1>
        <p className="text-xs sm:text-sm text-gray-400 mt-2 max-w-2xl leading-relaxed">
          HPLC-verified lyophilized peptides for in-vitro research use. Bulk volume tiers calculated automatically with verified Certificate of Analysis available per batch.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left Sidebar Filters */}
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-brand-card border border-brand-border space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-brand-border">
              <span className="font-bold text-xs uppercase text-white flex items-center gap-2">
                <Filter className="w-4 h-4 text-cyan-400" />
                Filter Compounds
              </span>
              {(selectedCategory !== 'all' || searchQuery || inStockOnly) && (
                <button
                  onClick={() => {
                    setSelectedCategory('all');
                    setSearchQuery('');
                    setInStockOnly(false);
                  }}
                  className="text-[11px] text-rose-400 hover:underline flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            {/* Keyword Search */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-300 block">
                Search Within Catalog
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. BPC, Tirz, 10mg..."
                  className="w-full bg-brand-dark border border-brand-border rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:"
                />
              </div>
            </div>

            {/* In Stock toggle */}
            <div className="pt-2">
              <label 
                className="flex items-center gap-2.5 text-xs text-gray-300 cursor-pointer select-none"
                onClick={() => setInStockOnly(!inStockOnly)}
              >
                <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                  inStockOnly ? 'bg-cyan-500 border-cyan-400 text-black' : 'bg-brand-dark border-brand-border'
                }`}>
                  {inStockOnly && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <span>In-Stock Items Only</span>
              </label>
            </div>

            {/* Category Filter */}
            <div className="space-y-2 pt-2 border-t border-brand-border/60">
              <label className="text-xs font-semibold text-gray-300 block">
                Research Categories
              </label>
              <div className="space-y-1">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                    selectedCategory === 'all'
                      ? 'bg-brand-accent text-white font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.12em]'
                      : 'text-gray-400 hover:text-white hover:bg-brand-dark'
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
                        ? 'bg-brand-accent text-white font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.12em]'
                        : 'text-gray-400 hover:text-white hover:bg-brand-dark'
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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-brand-card border border-brand-border text-xs">
            <span className="text-gray-400">
              Showing <strong className="text-white">{filteredProducts.length}</strong> research compounds
            </span>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <span className="text-gray-400 flex items-center gap-1 flex-shrink-0">
                <ArrowUpDown className="w-3.5 h-3.5 text-cyan-400" />
                Sort By:
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-brand-dark border border-brand-border rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:"
              >
                <option value="featured">Featured / Popular</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="name">Product Name (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Product Grid */}
          {filteredProducts.length === 0 ? (
            <div className="text-center py-20 p-8 rounded-2xl bg-brand-card border border-brand-border space-y-3">
              <FlaskConical className="w-12 h-12 mx-auto text-gray-600 animate-pulse" />
              <h3 className="text-base font-bold text-white">No research peptides match your filters</h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                Try selecting &quot;All Categories&quot; or clearing your active search terms.
              </p>
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setSearchQuery('');
                  setInStockOnly(false);
                }}
                className="px-4 py-2 bg-brand-accent rounded-xl text-xs font-bold text-white"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
