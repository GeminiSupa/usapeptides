import 'server-only';

import { createHash } from 'node:crypto';

import { getSupabaseAdmin } from './supabaseAdmin';
import { missingLeadSites, type LeadSite } from './leadIntake';

/**
 * The database half of lead intake: looking a site key up, and the rate limit.
 *
 * Split from `leadIntake.ts` so the payload rules, the option lists and the
 * domain allow-list stay free of the database and can be tested on their own.
 */

export async function findLeadSite(
  siteKey: string
): Promise<{ site?: LeadSite; migrationMissing?: boolean; error?: string }> {
  if (!siteKey) return {};

  const { data, error } = await getSupabaseAdmin()
    .from('lead_sites')
    .select('id, site_key, label, domains, tracking_phone, post_secret, is_active')
    .eq('site_key', siteKey)
    .maybeSingle();

  if (error) {
    if (missingLeadSites(error)) return { migrationMissing: true };
    return { error: error.message };
  }
  return { site: (data as LeadSite) ?? undefined };
}

/** The hostname of an Origin or Referer header, lower-cased, without `www.`. */
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

const recent = new Map<string, number[]>();

/** Used only when the rate-limit function is unreachable. Per-instance. */
function memoryLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (recent.get(key) ?? []).filter((at) => now - at < windowMs);
  if (hits.length >= limit) {
    recent.set(key, hits);
    return true;
  }
  hits.push(now);
  recent.set(key, hits);
  if (recent.size > 2_000) recent.clear();
  return false;
}

/**
 * Five submissions per IP and twenty per site every ten minutes. Uses the
 * atomic database function added in 0021 — the same one the customer login
 * uses — so the limit holds across Vercel instances.
 */
export async function intakeRateLimited(ip: string, siteKey: string): Promise<boolean> {
  const checks = [
    { scope: 'lead_intake:ip', value: ip || 'unknown', limit: 5 },
    { scope: 'lead_intake:site', value: siteKey || 'unknown', limit: 20 },
  ];

  for (const check of checks) {
    const { data, error } = await getSupabaseAdmin().rpc('customer_auth_rate_limit', {
      p_scope: check.scope,
      p_identifier_hash: hash(check.value),
      p_limit: check.limit,
      p_window_seconds: 600,
    });

    if (error) {
      if (memoryLimited(`${check.scope}:${check.value}`, check.limit, 600_000)) return true;
      continue;
    }
    if (data !== true) return true;
  }
  return false;
}
