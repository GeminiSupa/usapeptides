'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Search, X, ShieldCheck, ArrowRight, FlaskConical } from 'lucide-react';
import { products } from '@/data/products';
import { Product } from '@/types';
import { useCart } from '@/context/CartContext';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const { addToCart } = useCart();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Keyboard shortcut Cmd/Ctrl + K and Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredProducts = query.trim() === ''
    ? products.slice(0, 6)
    : products.filter((p) => {
        const q = query.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.casNumber?.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
        );
      });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="w-full max-w-2xl bg-brand-card border border-brand-border rounded-2xl shadow-2xl shadow-black overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="p-4 border-b border-brand-border flex items-center gap-3 bg-brand-darker">
          <Search className="w-5 h-5 text-cyan-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search peptides by name, CAS, SKU, or pathway..."
            className="w-full bg-transparent text-white placeholder-gray-500 text-sm focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-xs bg-brand-card px-2.5 py-1 rounded-lg border border-brand-border text-gray-400 hover:text-white"
          >
            ESC
          </button>
        </div>

        {/* Search Results List */}
        <div className="p-4 overflow-y-auto space-y-2 flex-grow">
          <div className="text-[11px] font-semibold text-brand-textMuted uppercase tracking-wider mb-2 px-2">
            {query.trim() === '' ? 'Popular Research Peptides' : `Matching Results (${filteredProducts.length})`}
          </div>

          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FlaskConical className="w-10 h-10 mx-auto mb-3 text-gray-600 animate-pulse" />
              <p className="text-sm">No research compounds found matching &quot;{query}&quot;</p>
              <p className="text-xs text-gray-600 mt-1">Try searching by category or CAS number</p>
            </div>
          ) : (
            filteredProducts.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between p-3 rounded-xl bg-brand-dark/50 hover:bg-brand-darker border border-brand-border/60 hover:border-cyan-500/40 transition-colors group"
              >
                <Link
                  href={`/product/${product.slug}`}
                  onClick={onClose}
                  className="flex items-center gap-3 flex-grow min-w-0 pr-3"
                >
                  <div className="w-12 h-12 rounded-lg bg-brand-card p-1 border border-brand-border/40 flex-shrink-0 flex items-center justify-center">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-cyan-400 truncate">
                        {product.name}
                      </h4>
                      <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-500/30 flex-shrink-0">
                        {product.purity}
                      </span>
                    </div>
                    <p className="text-[11px] text-brand-textMuted truncate">
                      {product.category}
                    </p>
                  </div>
                </Link>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs sm:text-sm font-extrabold text-white">
                    ${product.salePrice ? product.salePrice.toFixed(2) : product.price.toFixed(2)}
                  </span>
                  <button
                    onClick={() => {
                      addToCart(product, 1);
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-brand-accent hover:bg-blue-600 text-white text-xs font-semibold transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-brand-darker border-t border-brand-border text-center text-xs text-gray-500 flex items-center justify-between px-4">
          <span>All compounds strictly for in-vitro research use only</span>
          <Link 
            href="/shop" 
            onClick={onClose}
            className="text-cyan-400 hover:underline flex items-center gap-1 font-medium"
          >
            <span>Browse Full Catalog</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
