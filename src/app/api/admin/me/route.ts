import { requireAdmin } from '@/lib/adminAuth';
import { featureUnavailable } from '@/lib/env';
import { canAccess, defaultModule, MODULE_IDS } from '@/lib/permissions';
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
 */
export async function GET(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const auth = await requireAdmin(req, { allowSubUser: true, anyAuthenticated: true });
  if (!auth.ok) return auth.response;

  const p = auth.admin.profile;

  return ok({
    id: p.id,
    email: p.email,
    fullName: p.full_name ?? null,
    tier: p.tier,
    status: p.status,
    isOwner: p.is_superadmin,
    permissions: p.permissions,
    // Their own rate only. A sub-user seeing anybody else's would be a leak.
    commissionRate: p.commission_rate ?? null,
    // Resolved server-side so the UI never has to work out the precedence
    // between owner, always-on, owner-only and sub-user rules.
    allowed: MODULE_IDS.filter((id) => canAccess(id, p)),
    defaultModule: defaultModule(p),
  });
}
