'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseEnv, isSupabaseConfigured } from './env';

/**
 * Browser Supabase client, using the anon key and row-level security.
 *
 * Resolves to `null` when Supabase is not configured so the storefront still
 * renders from its local catalogue data. Always null-check before use.
 */

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseEnv.url, supabaseEnv.anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export { isSupabaseConfigured };

const STALE_TOKEN_HINTS = [
  'Refresh Token Not Found',
  'Invalid Refresh Token',
  'invalid_grant',
];

const isStaleAuthError = (message: string): boolean =>
  STALE_TOKEN_HINTS.some((hint) => message.includes(hint));

const clearAuthStorage = () => {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('sb-'))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // Storage can be unavailable in private mode; nothing to clean up.
  }
};

/**
 * A stale refresh token otherwise throws on every page load. Clear it once on
 * boot and again if a background refresh fails.
 */
if (supabase && typeof window !== 'undefined') {
  supabase.auth
    .getSession()
    .then(({ error }) => {
      if (error && isStaleAuthError(error.message || '')) {
        clearAuthStorage();
        supabase.auth.signOut().catch(() => {});
      }
    })
    .catch(() => {
      // Offline or blocked by an extension — not actionable here.
    });

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' && !session) clearAuthStorage();
  });
}
