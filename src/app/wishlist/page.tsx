'use client';

import React from 'react';
import Link from 'next/link';
import ProductCard from '@/components/ProductCard';
import { useWishlist } from '@/context/WishlistContext';
import { Heart, ShoppingBag } from 'lucide-react';

export default function WishlistPage() {
  const { wishlist } = useWishlist();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      
      <div className="border-b border-brand-border pb-6">
        <div className="text-xs font-bold text-rose-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
          <Heart className="w-3.5 h-3.5 fill-rose-400" />
          <span>Saved For Later</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white">
          Researcher Wishlist ({wishlist.length})
        </h1>
      </div>

      {wishlist.length === 0 ? (
        <div className="text-center py-20 p-8 rounded-3xl bg-brand-card border border-brand-border space-y-4">
          <div className="w-16 h-16 rounded-full bg-brand-darker mx-auto flex items-center justify-center text-gray-600 border border-brand-border">
            <Heart className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-white">Your Wishlist is Empty</h2>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            Click the heart icon on any compound in our catalog to save it for quick review and ordering.
          </p>
          <Link
            href="/shop"
            className="inline-block px-6 py-3 bg-brand-accent hover:bg-blue-600 text-white font-bold text-xs rounded-xl transition-colors"
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
