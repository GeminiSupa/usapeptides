'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { chatwootEnv, features } from '@/lib/env';
import { useCart } from '@/context/CartContext';

/**
 * Chatwoot live chat.
 *
 * Renders nothing at all until the base URL and website token are set, so the
 * site runs unchanged without a Chatwoot account and the widget appears the
 * moment those two values are in place.
 *
 * Two things beyond the stock embed:
 *
 *  - a signed-in customer is identified, using a signature produced server-side
 *    by /api/chat/identity. Signing in the browser would mean shipping the
 *    inbox HMAC secret to every visitor, which would let anyone impersonate any
 *    customer and read their chat history.
 *
 *  - what is in the cart and which page they are on are attached to the
 *    conversation, because "which product?" is the first thing an agent asks
 *    and it is already known.
 */

declare global {
  interface Window {
    chatwootSettings?: Record<string, unknown>;
    chatwootSDK?: { run: (opts: { websiteToken: string; baseUrl: string }) => void };
    $chatwoot?: {
      setUser: (identifier: string, attrs: Record<string, unknown>) => void;
      setCustomAttributes: (attrs: Record<string, unknown>) => void;
      reset: () => void;
      toggle: (state?: 'open' | 'close') => void;
    };
  }
}

const SCRIPT_ID = 'chatwoot-sdk';

export default function ChatwootWidget() {
  const pathname = usePathname();
  const { cart, totalItems, finalTotal } = useCart();

  /* ------------------------------------------------------- load the SDK --- */
  useEffect(() => {
    if (!features.liveChat) return;
    if (document.getElementById(SCRIPT_ID)) return;

    window.chatwootSettings = {
      position: 'right',
      type: 'standard',
      // The site is dark; letting the widget follow the visitor's own setting
      // rather than forcing either way.
      darkMode: 'auto',
      launcherTitle: 'Questions? Talk to us',
      showPopoutButton: true,
    };

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = `${chatwootEnv.baseUrl}/packs/js/sdk.js`;
    script.defer = true;
    script.async = true;

    script.onload = () => {
      window.chatwootSDK?.run({
        websiteToken: chatwootEnv.websiteToken,
        baseUrl: chatwootEnv.baseUrl,
      });
    };

    // A Chatwoot instance that is down or misconfigured must not break the
    // page or fill the console on every load.
    script.onerror = () => {
      console.warn('[chat] Chatwoot did not load from', chatwootEnv.baseUrl);
    };

    document.head.appendChild(script);
  }, []);

  /* ------------------------------------------- identify the signed-in user --- */
  useEffect(() => {
    if (!features.liveChat || !supabase) return;
    let cancelled = false;

    const identify = async (accessToken: string | null) => {
      if (!accessToken) {
        // Signed out. Clearing the contact stops the next visitor on a shared
        // machine inheriting the previous one's conversation.
        window.$chatwoot?.reset();
        return;
      }

      try {
        const res = await fetch('/api/chat/identity', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) return;

        const { data } = await res.json();
        if (cancelled || !data?.identifier) return;

        // The widget may still be loading; wait for it rather than dropping
        // the identity on the floor.
        await waitForChatwoot();
        if (cancelled) return;

        window.$chatwoot?.setUser(data.identifier, {
          email: data.email,
          name: data.name,
          ...(data.identifierHash ? { identifier_hash: data.identifierHash } : {}),
          ...(data.phone ? { phone_number: data.phone } : {}),
        });

        if (data.institution) {
          window.$chatwoot?.setCustomAttributes({ institution: data.institution });
        }
      } catch {
        // Chat identity is a convenience. Never surface it to the visitor.
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      void identify(data.session?.access_token ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      void identify(session?.access_token ?? null);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  /* --------------------------------------------------- cart and page context --- */
  useEffect(() => {
    if (!features.liveChat) return;
    let cancelled = false;

    (async () => {
      await waitForChatwoot();
      if (cancelled) return;

      window.$chatwoot?.setCustomAttributes({
        current_page: pathname ?? '/',
        cart_items: totalItems,
        cart_value: Number(finalTotal.toFixed(2)),
        // Capped: an agent needs to know what they are looking at, not the
        // whole basket serialised into a contact attribute.
        cart_contents: cart.slice(0, 8).map((i) => `${i.quantity}x ${i.product.name}`).join(', '),
      });
    })();

    return () => { cancelled = true; };
  }, [pathname, totalItems, finalTotal, cart]);

  return null;
}

/**
 * Resolve once the widget is ready, giving up after a while.
 *
 * `chatwoot:ready` is the documented event but it has already fired by the time
 * a later effect runs, so both the event and a poll are needed.
 */
function waitForChatwoot(timeoutMs = 15000): Promise<void> {
  if (window.$chatwoot) return Promise.resolve();

  return new Promise((resolve) => {
    const done = () => {
      window.removeEventListener('chatwoot:ready', done);
      window.clearInterval(poll);
      window.clearTimeout(giveUp);
      resolve();
    };

    window.addEventListener('chatwoot:ready', done);
    const poll = window.setInterval(() => { if (window.$chatwoot) done(); }, 250);
    const giveUp = window.setTimeout(done, timeoutMs);
  });
}
