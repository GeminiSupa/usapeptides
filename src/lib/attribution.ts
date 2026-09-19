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
 *   1. customer owner   a completed first order permanently attached this
 *                       customer to an active agent (0019)
 *   2. referral link    for a customer who does not have an owner yet
 *   3. legacy history   preserves ownership before 0019 is applied
 *   4. nothing          the order arrives unclaimed, for an agent to claim
 *
 * A durable customer owner wins over a new referral link. This prevents a
 * returning customer from being moved between agents without the explicit,
 * confirmed super-admin reassignment workflow.
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
    const address = String(email ?? '').trim().toLowerCase();
    let durableOwnershipReady = false;
    if (address) {
      const { data: customer, error: customerError } = await db
        .from('customer_profiles')
        .select('owner_id, owner_source')
        .eq('email', address)
        .maybeSingle();
      durableOwnershipReady = !customerError;
      if (customer?.owner_id) {
        const { data: owner } = await db
          .from('admin_users')
          .select('id, role, tier, status')
          .eq('id', customer.owner_id)
          .maybeSingle();
        if (isCreditable(owner)) {
          return { referred_by: owner.id, affiliate_id: null, agent_source: 'customer_history', referral_code: null };
        }
      }
    }

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

    // Once migration 0019 is present, a null owner is a deliberate durable
    // state. Do not let legacy order history silently restore an agent whom a
    // super admin explicitly removed. A valid referral above may still own the
    // new order and become the customer owner when that order is completed.
    if (durableOwnershipReady) return null;

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
