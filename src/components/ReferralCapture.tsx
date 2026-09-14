'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Remembers the referral code from a `?ref=` link so checkout can send it.
 *
 * Customers rarely buy on the page the link opened; they browse first. The
 * code is kept for 30 days in this browser, and a newer link replaces an older
 * one. It is only a claim — the server decides whether the code is real and
 * belongs to somebody still active.
 *
 * Reads window.location rather than useSearchParams, which would force every
 * statically built page into a Suspense boundary just to render nothing.
 */

const KEY = 'referral';
const KEEP_MS = 30 * 24 * 60 * 60 * 1000;

const clean = (value: unknown): string | null => {
  const raw = String(value ?? '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 32);
  return raw.length >= 4 ? raw : null;
};

export function readReferral(): string | null {
  try {
    const stored = window.localStorage.getItem(KEY);
    if (!stored) return null;
    const { code, at } = JSON.parse(stored) as { code?: string; at?: number };
    if (!code || !at || Date.now() - at > KEEP_MS) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return clean(code);
  } catch {
    return null;
  }
}

export default function ReferralCapture() {
  const pathname = usePathname();

  useEffect(() => {
    try {
      const code = clean(new URLSearchParams(window.location.search).get('ref'));
      if (code) window.localStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() }));
    } catch {
      // Storage blocked: the sale still goes through, just unattributed.
    }
  }, [pathname]);

  return null;
}
