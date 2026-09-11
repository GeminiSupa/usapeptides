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
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-brand-darker/95 backdrop-blur-md border-t border-brand-border px-4 py-2 flex items-center justify-around shadow-2xl">
      <Link
        href="/"
        className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${
          pathname === '/' ? 'text-cyan-400' : 'text-gray-400 hover:text-white'
        }`}
      >
        <Home className="w-5 h-5" />
        <span>Home</span>
      </Link>

      <Link
        href="/shop"
        className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${
          pathname === '/shop' ? 'text-cyan-400' : 'text-gray-400 hover:text-white'
        }`}
      >
        <Grid className="w-5 h-5" />
        <span>Shop</span>
      </Link>

      <Link
        href="/wishlist"
        className={`relative flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${
          pathname === '/wishlist' ? 'text-cyan-400' : 'text-gray-400 hover:text-white'
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
        className="relative flex flex-col items-center gap-1 text-[10px] font-medium text-gray-400 hover:text-white transition-colors"
      >
        <ShoppingBag className="w-5 h-5 text-cyan-400" />
        <span>Cart</span>
        {totalItems > 0 && (
          <span className="absolute -top-1 right-1 bg-emerald-500 text-brand-darker font-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
            {totalItems}
          </span>
        )}
      </button>

      <Link
        href="/my-account"
        className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${
          pathname === '/my-account' ? 'text-cyan-400' : 'text-gray-400 hover:text-white'
        }`}
      >
        <User className="w-5 h-5" />
        <span>Account</span>
      </Link>
    </div>
  );
}
