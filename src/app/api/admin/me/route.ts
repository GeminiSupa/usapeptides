import { requireAdmin } from '@/lib/adminAuth';
import { featureUnavailable } from '@/lib/env';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { uniqueReferralCode } from '@/lib/referralCodes';
import { canAccess, defaultModule, isSalesAgent, isSubUser, MODULE_IDS } from '@/lib/permissions';
import { ok } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * Who am I, and what may I open?
 *
 * The dashboard asks this once on load so the sidebar shows only sections the
 * person can actually use. A sub-user therefore never sees Orders in the nav,
 * and a staff member never sees Users.
 *
 * This is presentation, not protection. Every route re-checks the same rules,
 * so a hand-crafted request to a hidden section is refused regardless of what
 * the sidebar chose to draw.
 *
 * Open to sub-users — it is how they discover they have a dashboard at all.
 *
 * Sales agents and sub-users are given a referral code here the first time they
 * ask, if they have none. Doing it at first sign-in rather than at creation
 * covers everybody made before codes existed, with no backfill script.
 */
export async function GET(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const auth = await requireAdmin(req, { allowSubUser: true, anyAuthenticated: true });
  if (!auth.ok) return auth.response;

  const p = auth.admin.profile;
  const earnsOnLinks = isSalesAgent(p) || isSubUser(p);

  let referralCode = p.referral_code ?? null;
  if (earnsOnLinks && !referralCode) {
    const db = getSupabaseAdmin();
    const code = await uniqueReferralCode(db);
    if (code) {
      // Only fills a gap, so two tabs loading at once cannot swap a code that
      // is already printed on somebody's card. Fails quietly before 0007.
      const { data } = await db
        .from('admin_users')
        .update({ referral_code: code })
        .eq('id', p.id)
        .is('referral_code', null)
        .select('referral_code')
        .maybeSingle();
      referralCode = (data as { referral_code?: string } | null)?.referral_code ?? null;
    }
  }

  return ok({
    id: p.id,
    email: p.email,
    fullName: p.full_name ?? null,
    tier: p.tier,
    role: p.role ?? 'staff',
    status: p.status,
    isOwner: p.is_superadmin,
    permissions: p.permissions,
    // Their own rate only. A sub-user seeing anybody else's would be a leak.
    commissionRate: p.commission_rate ?? null,
    referralCode,
    // Resolved server-side so the UI never has to work out the precedence
    // between owner, always-on, owner-only and sub-user rules.
    allowed: MODULE_IDS.filter((id) => canAccess(id, p)),
    defaultModule: defaultModule(p),
  });
}
