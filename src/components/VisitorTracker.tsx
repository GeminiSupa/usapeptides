'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { track } from '@/lib/track';

/**
 * Reports page views, a heartbeat while the tab is open (for "on the site now"
 * and visit length), and the cart contents (for abandoned-cart follow-up).
 */
export default function VisitorTracker() {
  const pathname = usePathname();
  const search = useSearchParams();
  const { cart, finalTotal } = useCart();
  const lastCart = useRef<string | null>(null);

  useEffect(() => {
    track('page_view');
  }, [pathname, search]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') track('heartbeat');
    }, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  // Cart changes, debounced. The first render only records what is there.
  useEffect(() => {
    const signature = JSON.stringify(cart.map((i) => [i.product.slug, i.quantity]));
    if (lastCart.current === null) {
      lastCart.current = signature;
      if (!cart.length) return;
    }
    if (signature === lastCart.current && cart.length) return;
    lastCart.current = signature;
    const timer = window.setTimeout(() => {
      let email = '';
      try { email = localStorage.getItem('upd_checkout_email') ?? ''; } catch { /* ignore */ }
      track('cart', {
        value: finalTotal,
        email,
        items: cart.map((i) => ({ slug: i.product.slug, name: i.product.name, qty: i.quantity, price: i.selectedPrice })),
      });
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [cart, finalTotal]);

  return null;
}
