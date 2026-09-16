'use client';

import React from 'react';
import Link from 'next/link';
import ProductCard from '@/components/ProductCard';
import { useWishlist } from '@/context/WishlistContext';
import { Heart, ShoppingBag } from 'lucide-react';

export default function WishlistPage() {
  const { wishlist } = useWishlist();

  return (
    <div className="shell py-10 space-y-8">
      
      <div className="border-b border-brand-border pb-6">
        <div className="text-xs font-bold text-red-600 uppercase tracking-widest mb-1 flex items-center gap-1.5">
          <Heart className="w-3.5 h-3.5 fill-red-600" />
          <span>Saved For Later</span>
        </div>
        <h1 className="page-title">
          Researcher Wishlist ({wishlist.length})
        </h1>
      </div>

      {wishlist.length === 0 ? (
        <div className="text-center py-20 p-8 rounded-3xl bg-brand-card border border-brand-border space-y-4">
          <div className="w-16 h-16 bg-brand-darker mx-auto flex items-center justify-center text-brand-textMuted border border-brand-border">
            <Heart className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-brand-heading">Your Wishlist is Empty</h2>
          <p className="text-xs text-brand-textMuted max-w-sm mx-auto">
            Click the heart icon on any compound in our catalog to save it for quick review and ordering.
          </p>
          <Link
            href="/shop"
            className="inline-block px-6 py-3 bg-brand-accent hover:bg-brand-accentHover text-brand-onAccent font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.12em] rounded-xl transition-colors"
          >
            Explore Catalog
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {wishlist.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

    </div>
  );
}
