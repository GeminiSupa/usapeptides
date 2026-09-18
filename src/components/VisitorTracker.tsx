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

  // Record useful clicks and taps without collecting anything a customer types.
  // A click event also fires after a tap, so this covers mouse, touch and
  // keyboard activation without counting the same action twice.
  useEffect(() => {
    let pointer: { type: string; at: number; control: Element | null } | null = null;
    const onPointer = (event: PointerEvent) => {
      const raw = event.target instanceof Element ? event.target : null;
      pointer = { type: event.pointerType || 'mouse', at: Date.now(), control: raw?.closest('a, button, [role="button"], input[type="submit"], input[type="button"]') ?? null };
    };
    const onClick = (event: MouseEvent) => {
      const raw = event.target instanceof Element ? event.target : null;
      const target = raw?.closest('a, button, [role="button"], input[type="submit"], input[type="button"]') as HTMLElement | null;
      if (!target || target.closest('[data-analytics-ignore]')) return;

      const text = (target.getAttribute('aria-label') || target.getAttribute('title') || target.textContent || target.tagName)
        .replace(/\s+/g, ' ').trim().slice(0, 120);
      const href = target instanceof HTMLAnchorElement
        ? (() => { try { const u = new URL(target.href); return u.origin === location.origin ? u.pathname.slice(0, 200) : u.hostname.slice(0, 120); } catch { return ''; } })()
        : '';
      const pageHeight = Math.max(document.documentElement.scrollHeight, window.innerHeight, 1);
      const x = Math.max(0, Math.min(99, Math.floor((event.clientX / Math.max(window.innerWidth, 1)) * 100)));
      const y = Math.max(0, Math.min(99, Math.floor(((event.clientY + window.scrollY) / pageHeight) * 100)));
      const horizontal = x < 34 ? 'Left' : x < 67 ? 'Center' : 'Right';
      const vertical = y < 34 ? 'Top' : y < 67 ? 'Middle' : 'Bottom';

      track('interaction', {
        label: text || target.tagName.toLowerCase(),
        element: target.tagName.toLowerCase(),
        href,
        input: pointer && pointer.control === target && Date.now() - pointer.at < 1500 ? pointer.type : 'keyboard',
        zone: `${vertical} ${horizontal}`,
      });
    };
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('click', onClick, true);
    };
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
