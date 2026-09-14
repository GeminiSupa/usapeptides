import 'server-only';

import { getSupabaseAdmin } from './supabaseAdmin';
import { permissionsForPath } from './routePermissions';
import { canAccess, isSubUser, type AdminProfile, type Tier, type UserStatus } from './permissions';

/**
 * Verify that a request comes from a signed-in administrator who is allowed to
 * do this particular thing.
 *
 * Four independent gates, all required:
 *   1. the bearer token is a valid Supabase Auth session
 *   2. that account has a row in admin_users — being able to sign in to the
 *      storefront is not being able to reach the dashboard
 *   3. the account is active, so a pending approval or a suspension takes
 *      effect immediately rather than at next login
 *   4. the account holds the permission this route needs
 *
 * Two defaults carry most of the weight:
 *
 *   SUB-USERS ARE REFUSED unless a route opts in with allowSubUser. Most routes
 *   here are gated on "is an admin", so without this default a sub-user login
 *   would reach the customer list and the order table. Default-deny means the
 *   other routes need no audit and no edit.
 *
 *   AN UNMAPPED PATH REQUIRES THE OWNER ROLE. A route added later is locked
 *   until it is deliberately listed in routePermissions. The opposite default
 *   makes every new endpoint a hole until somebody notices.
 */

export interface AdminIdentity {
  /** admin_users.id, the identity the rest of the system references. */
  id: string;
  /** auth.users.id, when the row has been linked to a login. */
  userId: string | null;
  email: string;
  profile: AdminProfile;
}

export type AdminCheck =
  | { ok: true; admin: AdminIdentity }
  | { ok: false; response: Response };

export interface RequireAdminOptions {
  /** This exact permission, instead of whatever the path maps to. */
  permission?: string;
  /** Any one of these. */
  anyPermission?: string[];
  /** Owner role required regardless of permissions. */
  superadmin?: boolean;
  /** Let a sub-user through. Off by default; see the note above. */
  allowSubUser?: boolean;
  /**
   * Being an active admin of any kind is enough. Used only by the route that
   * reports who you are and what you may open — a sub-user has to be able to
   * ask that question, and they hold no section permission at all.
   *
   * Every other route states a permission or inherits one from the path, so
   * this stays a deliberate exception rather than a convenient default.
   */
  anyAuthenticated?: boolean;
}

const deny = (status: number, message: string, extra?: Record<string, unknown>): AdminCheck => ({
  ok: false,
  response: Response.json(
    { error: status === 401 ? 'unauthorized' : 'forbidden', message, ...extra },
    { status }
  ),
});

/**
 * A row from a database that has not run 0005_users.sql yet is missing tier,
 * status and permissions. Rather than lock the existing owner out of the very
 * screen that would tell them to run it, a missing column reads as the safe
 * pre-migration equivalent: staff, active if the old is_active flag says so,
 * and owner — because before 0005 there was no notion of a restricted admin,
 * so everybody on the allow-list already had full access. Nothing is widened;
 * this is what the deployment did yesterday.
 */
function normalizeProfile(row: Record<string, any>): AdminProfile {
  const hasTierColumn = 'tier' in row;
  const hasStatusColumn = 'status' in row;
  const hasSuperColumn = 'is_superadmin' in row;

  const status: UserStatus = hasStatusColumn
    ? (row.status as UserStatus)
    : row.is_active === false
      ? 'suspended'
      : 'active';

  return {
    id: String(row.id),
    email: String(row.email ?? '').toLowerCase(),
    full_name: row.full_name ?? null,
    tier: (hasTierColumn ? row.tier : 'staff') as Tier,
    // Before 0007 there is no role column, so nobody is an agent and nothing
    // is scoped — the dashboard behaves exactly as it did.
    role: row.role === 'sales_agent' ? 'sales_agent' : 'staff',
    referral_code: row.referral_code ?? null,
    status,
    is_superadmin: hasSuperColumn ? Boolean(row.is_superadmin) : true,
    permissions: Array.isArray(row.permissions) ? row.permissions.map(String) : [],
    parent_user_id: row.parent_user_id ?? null,
    sub_user_cap: row.sub_user_cap ?? null,
    commission_rate: row.commission_rate ?? null,
    override_rate: row.override_rate ?? null,
  };
}

export async function requireAdmin(
  req: Request,
  options: RequireAdminOptions = {}
): Promise<AdminCheck> {
  const header = req.headers.get('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';

  if (!token) return deny(401, 'Sign in to access the dashboard.');

  const db = getSupabaseAdmin();

  const { data: userResult, error: authError } = await db.auth.getUser(token);
  if (authError || !userResult?.user?.email) {
    return deny(401, 'Your session has expired. Sign in again.');
  }

  const authUser = userResult.user;
  const email = authUser.email!.toLowerCase();

  // Matched on the auth id first: an address can be changed in Supabase Auth,
  // and an identity that survives that is worth more than one that does not.
  // Falling back to the address covers rows added by hand in the SQL editor,
  // which is how the first owner always arrives.
  //
  // `*` rather than a column list on purpose — see normalizeProfile. Naming a
  // column 0005 adds would break sign-in entirely on a database a migration
  // behind, which is the moment you least want to be locked out.
  let row: Record<string, any> | null = null;

  const byId = await db.from('admin_users').select('*').eq('user_id', authUser.id).maybeSingle();
  if (byId.error && !isMissingColumn(byId.error)) {
    return deny(500, 'Could not verify administrator access.');
  }
  row = byId.data ?? null;

  if (!row) {
    const byEmail = await db.from('admin_users').select('*').ilike('email', email).maybeSingle();
    if (byEmail.error) return deny(500, 'Could not verify administrator access.');
    row = byEmail.data ?? null;

    // Link the row to the login so the next request matches on the id.
    if (row && !row.user_id) {
      await db
        .from('admin_users')
        .update({ user_id: authUser.id })
        .eq('id', row.id)
        .then(() => {}, () => {}); // best effort; never block sign-in on it
    }
  }

  if (!row) {
    // Deliberately the same wording a suspended account gets: somebody probing
    // addresses should not learn which ones exist.
    return deny(403, 'This account does not have dashboard access.');
  }

  const profile = normalizeProfile(row);

  if (profile.status === 'pending') {
    return deny(403, 'Your account is waiting for a super admin to approve it.');
  }
  if (profile.status !== 'active') {
    return deny(403, 'This account does not have dashboard access.');
  }

  if (isSubUser(profile) && !options.allowSubUser) {
    return deny(403, 'This part of the dashboard is not available to sub-users.');
  }

  if (options.superadmin && !profile.is_superadmin) {
    return deny(403, 'Only a super admin can do that.');
  }

  const required = options.anyAuthenticated
    ? null
    : options.anyPermission ??
      (options.permission ? [options.permission] : permissionsForPath(pathOf(req)));

  if (required === null) {
    // Nothing further to check: active, and not a sub-user unless allowed.
  } else if (required.length === 0) {
    // Nothing matched, so this is an unmapped route. Owner only.
    if (!profile.is_superadmin) {
      return deny(403, 'Only a super admin can do that.');
    }
  } else if (!required.some((p) => canAccess(p, profile))) {
    return deny(403, 'You do not have permission for that.', { requires: required });
  }

  void touchLastSeen(row);

  return {
    ok: true,
    admin: { id: profile.id, userId: row.user_id ?? authUser.id, email, profile },
  };
}

/* -------------------------------------------------------------------------- */

const pathOf = (req: Request): string => {
  try {
    return new URL(req.url).pathname;
  } catch {
    return '';
  }
};

const isMissingColumn = (error: { code?: string; message?: string }): boolean =>
  error.code === '42703' ||
  error.code === 'PGRST204' ||
  /column .* does not exist|could not find the .* column/i.test(error.message ?? '');

/** How stale last_seen_at may get before it is worth another write. */
const SEEN_INTERVAL_MS = 10 * 60 * 1000;

/**
 * Records that somebody is using the dashboard, at most once every ten minutes
 * per account. Writing it on every request would double the writes of a page
 * that makes several calls, to record a figure nobody reads to the second.
 */
async function touchLastSeen(row: Record<string, any>): Promise<void> {
  if (!('last_seen_at' in row)) return; // pre-0005 database

  const last = row.last_seen_at ? new Date(row.last_seen_at).getTime() : 0;
  if (Date.now() - last < SEEN_INTERVAL_MS) return;

  await getSupabaseAdmin()
    .from('admin_users')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', row.id)
    .then(() => {}, () => {});
}
