import 'server-only';

import type { getSupabaseAdmin } from './supabaseAdmin';
import { normalizeReferralCode } from './referralCodes';

/**
 * Which agent, if any, a new order is credited to.
 *
 * Decided on the server from what we already know, never from what the browser
 * says an order is worth or who it belongs to. The browser may only pass the
 * referral code it was given in a link.
 *
 *   1. referral link    the code belongs to an active agent or sub-user
 *   2. customer history this email ordered before, and that order belongs to
 *                       somebody still active — the customer stays with them
 *   3. nothing          the order arrives unclaimed, for an agent to claim
 *
 * The link wins over history, as in the reference project: a customer who
 * deliberately used a new agent's link is that agent's sale.
 *
 * Never throws and never blocks a sale. On a database that has not had
 * 0007_sales_agents.sql, every lookup below fails quietly and the order saves
 * unclaimed, which is exactly what happened before this existed.
 */

type Db = ReturnType<typeof getSupabaseAdmin>;

export type AgentSource = 'referral_link' | 'customer_history' | 'claim' | 'assigned';

export interface Attribution {
  referred_by: string | null;
  affiliate_id?: string | null;
  agent_source: AgentSource | null;
  referral_code: string | null;
}

interface Candidate {
  id: string;
  role?: string | null;
  tier?: string | null;
  status?: string | null;
  referral_code?: string | null;
}

/** Who may be credited with a sale: an active sales agent or an active sub-user. */
export const isCreditable = (row: Candidate | null | undefined): row is Candidate =>
  Boolean(row && row.status === 'active' && (row.role === 'sales_agent' || row.tier === 'sub_user'));

export async function resolveOrderAttribution(
  db: Db,
  { ref, email }: { ref?: unknown; email?: string | null }
): Promise<Attribution | null> {
  try {
    const code = normalizeReferralCode(ref);
    if (code) {
      const { data: affiliate } = await db
        .from('affiliates')
        .select('id, referral_code, is_active')
        .ilike('referral_code', code)
        .maybeSingle();
      if (affiliate?.is_active) {
        return {
          referred_by: null,
          affiliate_id: affiliate.id,
          agent_source: null,
          referral_code: affiliate.referral_code ?? code,
        };
      }

      // The code alphabet has no % or _, so ilike here is an exact,
      // case-insensitive match rather than a pattern.
      const { data } = await db
        .from('admin_users')
        .select('id, role, tier, status, referral_code')
        .ilike('referral_code', code)
        .maybeSingle();

      if (isCreditable(data)) {
        return { referred_by: data.id, affiliate_id: null, agent_source: 'referral_link', referral_code: data.referral_code ?? code };
      }
    }

    const address = String(email ?? '').trim().toLowerCase();
    if (address) {
      // Orders store the address lower-cased (see /api/orders), so eq is exact.
      const { data: first } = await db
        .from('orders')
        .select('referred_by')
        .eq('email', address)
        .not('referred_by', 'is', null)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (first?.referred_by) {
        const { data: owner } = await db
          .from('admin_users')
          .select('id, role, tier, status')
          .eq('id', first.referred_by)
          .maybeSingle();

        // Somebody who has left or been suspended does not keep collecting on
        // the customer; the order arrives unclaimed and a current agent picks it up.
        if (isCreditable(owner)) {
          return { referred_by: owner.id, affiliate_id: null, agent_source: 'customer_history', referral_code: null };
        }
      }
    }
  } catch (err) {
    console.warn('[attribution] skipped:', err instanceof Error ? err.message : err);
  }
  return null;
}
