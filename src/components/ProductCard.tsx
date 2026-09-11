'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  ShoppingBag, 
  Heart, 
  ShieldCheck, 
  Check, 
  FileText,
  Eye
} from 'lucide-react';
import { Product } from '@/types';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addToCart, setSelectedCOAProduct } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const [added, setAdded] = useState(false);

  const isFavorited = isInWishlist(product.id);

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    addToCart(product, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  };

  const handleOpenCOA = (e: React.MouseEvent) => {
    e.preventDefault();
    setSelectedCOAProduct(product);
  };

  return (
    <div className="group relative bg-brand-card hover:bg-brand-cardHover border border-brand-border hover:border-cyan-500/40 rounded-2xl p-4 transition-all duration-300 flex flex-col justify-between shadow-lg shadow-black/40 hover:shadow-cyan-950/30">
      
      {/* Top Badges & Wishlist */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 text-[10px] font-bold">
              <ShieldCheck className="w-3 h-3" />
              <span>{product.purity}</span>
            </span>
            {product.isFeatured && (
              <span className="px-2 py-0.5 rounded-md bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[10px] font-semibold">
                Popular
              </span>
            )}
          </div>

          <button
            onClick={(e) => {
              e.preventDefault();
              toggleWishlist(product);
            }}
            className={`p-2 rounded-xl border transition-colors ${
              isFavorited
                ? 'bg-rose-950/80 border-rose-500 text-rose-400'
                : 'bg-brand-dark/60 border-brand-border text-gray-400 hover:text-white'
            }`}
            aria-label="Wishlist toggle"
          >
            <Heart className={`w-3.5 h-3.5 ${isFavorited ? 'fill-rose-400' : ''}`} />
          </button>
        </div>

        {/* Product Image Link */}
        <Link href={`/product/${product.slug}`} className="block relative aspect-square rounded-xl bg-brand-darker/60 overflow-hidden mb-4 p-4 border border-brand-border/40 group-hover:border-brand-accent/30 transition-colors">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-contain filter drop-shadow-[0_10px_15px_rgba(0,0,0,0.5)] group-hover:scale-108 transition-transform duration-300"
          />
        </Link>

        {/* Category & Title */}
        <div className="space-y-1.5">
          <span className="text-[10px] uppercase tracking-wider text-brand-textMuted block truncate font-medium">
            {product.category}
          </span>
          <Link href={`/product/${product.slug}`} className="block">
            <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-cyan-400 transition-colors line-clamp-2 leading-snug">
              {product.name}
            </h3>
          </Link>
        </div>
      </div>

      {/* Pricing & Actions */}
      <div className="mt-4 pt-3 border-t border-brand-border/60">
        <div className="flex items-baseline justify-between gap-2 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold text-white">
                ${product.salePrice ? product.salePrice.toFixed(2) : product.price.toFixed(2)}
              </span>
              {product.salePrice && (
                <span className="text-xs text-gray-500 line-through">
                  ${product.price.toFixed(2)}
                </span>
              )}
            </div>
            <div className="text-[10px] text-emerald-400 font-medium">
              Save up to 20% in bulk
            </div>
          </div>

          {/* Quick COA button */}
          <button
            onClick={handleOpenCOA}
            className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium bg-brand-dark/60 hover:bg-brand-dark px-2 py-1 rounded-lg border border-brand-border"
            title="Inspect HPLC Report"
          >
            <FileText className="w-3 h-3" />
            <span>COA</span>
          </button>
        </div>

        {/* Add to Cart button */}
        <button
          onClick={handleQuickAdd}
          className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md ${
            added
              ? 'bg-emerald-600 text-white shadow-emerald-600/30'
              : 'bg-brand-accent hover:bg-blue-600 text-white shadow-brand-accent/20 active:scale-98 border border-cyan-400/30'
          }`}
        >
          {added ? (
            <>
              <Check className="w-4 h-4" />
              <span>Added to Cart!</span>
            </>
          ) : (
            <>
              <ShoppingBag className="w-4 h-4" />
              <span>Add to Cart</span>
            </>
          )}
        </button>
      </div>

    </div>
  );
}
