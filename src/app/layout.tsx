'use client';

import React, { useState } from 'react';
import './globals.css';
import { CartProvider } from '@/context/CartContext';
import { WishlistProvider } from '@/context/WishlistContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import CartDrawer from '@/components/CartDrawer';
import SearchModal from '@/components/SearchModal';
import COAModal from '@/components/COAModal';
import ComplianceModal from '@/components/ComplianceModal';
import MobileBottomNav from '@/components/MobileBottomNav';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <html lang="en" className="dark">
      <head>
        <title>Battle Born Peptides | HPLC-Tested Research Peptides USA</title>
        <meta 
          name="description" 
          content="Buy HPLC-tested research peptides shipped within the USA. Free shipping over $100 and bulk pricing available. For laboratory research use only." 
        />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body className="min-h-screen flex flex-col bg-[#080d1a] text-gray-200 pb-16 lg:pb-0">
        <WishlistProvider>
          <CartProvider>
            <Header onOpenSearch={() => setSearchOpen(true)} />
            <main className="flex-grow">
              {children}
            </main>
            <Footer />
            
            {/* Global Modals & Drawers */}
            <CartDrawer />
            <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
            <COAModal />
            <ComplianceModal />
            <MobileBottomNav />
          </CartProvider>
        </WishlistProvider>
      </body>
    </html>
  );
}
