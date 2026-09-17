'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Grid, Heart, ShoppingBag, User } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { totalItems, setIsCartOpen } = useCart();
  const { wishlist } = useWishlist();

  return (
    <nav aria-label="Mobile navigation" className="theme-forest fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-brand-border bg-brand-darker/95 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md lg:hidden">
      <Link
        href="/"
        className={`flex min-h-11 min-w-14 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium transition-colors ${
          pathname === '/' ? 'text-brand-accentGlow' : 'text-brand-textMuted hover:text-brand-heading'
        }`}
      >
        <Home className="w-5 h-5" />
        <span>Home</span>
      </Link>

      <Link
        href="/shop"
        className={`flex min-h-11 min-w-14 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium transition-colors ${
          pathname === '/shop' ? 'text-brand-accentGlow' : 'text-brand-textMuted hover:text-brand-heading'
        }`}
      >
        <Grid className="w-5 h-5" />
        <span>Shop</span>
      </Link>

      <Link
        href="/wishlist"
        className={`relative flex min-h-11 min-w-14 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium transition-colors ${
          pathname === '/wishlist' ? 'text-brand-accentGlow' : 'text-brand-textMuted hover:text-brand-heading'
        }`}
      >
        <Heart className="w-5 h-5" />
        <span>Wishlist</span>
        {wishlist.length > 0 && (
          <span className="absolute -top-1 right-2 bg-rose-500 text-white text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
            {wishlist.length}
          </span>
        )}
      </Link>

      <button
        onClick={() => setIsCartOpen(true)}
        className="relative flex min-h-11 min-w-14 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium text-brand-textMuted transition-colors hover:text-brand-heading"
      >
        <ShoppingBag className="w-5 h-5 text-brand-accentGlow" />
        <span>Cart</span>
        {totalItems > 0 && (
          <span className="absolute -top-1 right-1 bg-brand-accent text-brand-onAccent font-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
            {totalItems}
          </span>
        )}
      </button>

      <Link
        href="/my-account"
        className={`flex min-h-11 min-w-14 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium transition-colors ${
          pathname === '/my-account' ? 'text-brand-accentGlow' : 'text-brand-textMuted hover:text-brand-heading'
        }`}
      >
        <User className="w-5 h-5" />
        <span>Account</span>
      </Link>
    </nav>
  );
}
