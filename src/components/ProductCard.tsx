'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Heart, Check, FileText } from 'lucide-react';
import { Product } from '@/types';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';

interface ProductCardProps {
  product: Product;
}

/**
 * Derive the displayed price range the way the reference catalogue does:
 * the cheapest bulk tier through the single-vial price.
 */
function priceRange(product: Product): { low: number; high: number } {
  const tiers = product.bulkPricing?.map((t) => t.pricePerUnit) ?? [];
  const candidates = [product.price, product.salePrice, ...tiers].filter(
    (n): n is number => typeof n === 'number' && n > 0
  );
  return { low: Math.min(...candidates), high: Math.max(...candidates) };
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addToCart, setSelectedCOAProduct } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const [added, setAdded] = useState(false);

  const isFavorited = isInWishlist(product.id);
  const { low, high } = priceRange(product);

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    addToCart(product, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  };

  return (
    <div className="group relative flex flex-col border border-brand-border bg-brand-card transition-colors duration-200 hover:border-brand-accent/60">
      {/* Wishlist toggle floats over the image. */}
      <button
        onClick={(e) => {
          e.preventDefault();
          toggleWishlist(product);
        }}
        aria-label={isFavorited ? 'Remove from wishlist' : 'Add to wishlist'}
        className={`absolute right-2 top-2 z-10 p-2 transition-colors ${
          isFavorited ? 'text-brand-accentGlow' : 'text-brand-textMuted hover:text-brand-heading'
        }`}
      >
        <Heart className={`h-4 w-4 ${isFavorited ? 'fill-current' : ''}`} />
      </button>

      <Link
        href={`/product/${product.slug}`}
        className="block aspect-square overflow-hidden bg-brand-darker p-5"
      >
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
        />
      </Link>

      <div className="flex flex-1 flex-col border-t border-brand-border p-4 text-center">
        <Link href={`/product/${product.slug}`} className="block">
          <h3 className="font-display text-[0.8125rem] font-extrabold leading-snug text-brand-heading transition-colors group-hover:text-brand-accentGlow">
            {product.name}
          </h3>
        </Link>

        <div className="mt-2 font-display text-[0.8125rem] font-bold text-brand-body">
          {low === high ? (
            <span>${high.toFixed(2)}</span>
          ) : (
            <span>
              ${low.toFixed(2)} <span className="text-brand-textMuted">–</span> ${high.toFixed(2)}
            </span>
          )}
        </div>

        <button
          onClick={(e) => {
            e.preventDefault();
            setSelectedCOAProduct(product);
          }}
          className="mx-auto mt-2 inline-flex items-center gap-1 text-[0.6875rem] font-semibold text-brand-textMuted transition-colors hover:text-brand-accentGlow"
        >
          <FileText className="h-3 w-3" />
          <span>HPLC test result</span>
        </button>

        <div className="flex-1" />

        <button
          onClick={handleQuickAdd}
          className={`mt-4 w-full border px-4 py-2.5 font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.12em] transition-colors ${
            added
              ? 'border-whatsapp bg-whatsapp text-whatsapp-ink'
              : 'border-action bg-action text-white hover:border-action-hover hover:bg-action-hover'
          }`}
        >
          {added ? (
            <span className="inline-flex items-center justify-center gap-1.5">
              <Check className="h-3.5 w-3.5" /> Added
            </span>
          ) : (
            'Add to cart'
          )}
        </button>
      </div>
    </div>
  );
}
