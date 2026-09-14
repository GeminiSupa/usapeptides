'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import './globals.css';
import { CartProvider } from '@/context/CartContext';
import { WishlistProvider } from '@/context/WishlistContext';
import AnnouncementBanner from '@/components/AnnouncementBanner';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import CartDrawer from '@/components/CartDrawer';
import SearchModal from '@/components/SearchModal';
import COAModal from '@/components/COAModal';
import ComplianceModal from '@/components/ComplianceModal';
import MobileBottomNav from '@/components/MobileBottomNav';
import ChatwootWidget from '@/components/ChatwootWidget';
import ReferralCapture from '@/components/ReferralCapture';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();
  // The dashboard is a separate surface - no storefront chrome around it.
  const isAdmin = pathname?.startsWith('/admin') ?? false;

  return (
    <html lang="en" className="dark">
      <head>
        <title>USA Peptide Depot | HPLC-Tested Research Peptides, Shipped From the USA</title>
        <meta
          name="description"
          content="Lyophilized research peptides with independent HPLC test results published per product. Ships from the United States, tracked. Free shipping over $100. In-vitro research use only."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="/fonts/cera.css" />
      </head>
      <body className="min-h-screen flex flex-col bg-brand-dark text-brand-body pb-16 lg:pb-0">
        <WishlistProvider>
          <CartProvider>
            {!isAdmin && <AnnouncementBanner />}
            {!isAdmin && <Header onOpenSearch={() => setSearchOpen(true)} />}
            <main className="flex-grow">
              {children}
            </main>
            {!isAdmin && <Footer />}

            {/* Global Modals & Drawers */}
            {!isAdmin && (
              <>
                <CartDrawer />
                <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
                <COAModal />
                <ComplianceModal />
                <MobileBottomNav />
                {/* Renders nothing until Chatwoot is configured. Kept off the
                    dashboard: staff answer chats in Chatwoot, not here. */}
                <ChatwootWidget />
                <ReferralCapture />
              </>
            )}
          </CartProvider>
        </WishlistProvider>
      </body>
    </html>
  );
}
