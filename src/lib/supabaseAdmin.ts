import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseEnv } from './env';

/**
 * Service-role Supabase client. Bypasses row-level security, so it must only
 * ever be constructed inside route handlers or server actions.
 *
 * The `server-only` import above makes the build fail loudly if this module is
 * ever pulled into a client component, which is the mistake that would leak
 * the service role key to the browser.
 */

let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const { url, serviceRoleKey } = supabaseEnv;
  if (!url || !serviceRoleKey) {
    throw new Error(
      'Supabase admin client unavailable: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    );
  }

  cached = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { 'x-application-name': 'usa-peptides' } },
  });

  return cached;
}
