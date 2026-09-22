'use client';

import React, { Suspense, useState } from 'react';
import { usePathname } from 'next/navigation';
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
import VisitorTracker from '@/components/VisitorTracker';

/**
 * Everything around a storefront page that needs the browser: cart, wishlist,
 * search, modals. Split out of the root layout so the layout itself can run on
 * the server and emit real SEO tags.
 */
export default function StorefrontShell({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();
  // The dashboard is a separate surface - no storefront chrome around it.
  const isAdmin = pathname?.startsWith('/admin') ?? false;

  return (
    <WishlistProvider>
      <CartProvider>
        {!isAdmin && <AnnouncementBanner />}
        {!isAdmin && <Header onOpenSearch={() => setSearchOpen(true)} />}
        <main className="flex-grow">{children}</main>
        {!isAdmin && <Footer />}

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
            <Suspense fallback={null}><VisitorTracker /></Suspense>
          </>
        )}
      </CartProvider>
    </WishlistProvider>
  );
}
