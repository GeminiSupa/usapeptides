import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { featureUnavailable } from '@/lib/env';
import { writeAudit } from '@/lib/audit';
import {
  canInviteSubUser, isSubUser, sanitizePermissions, subUserCapFor, subUserSpotsUsed,
  parseRate, type AdminProfile,
} from '@/lib/permissions';
import { ok, created, badRequest, serverError, readJson, isEmail, clip } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Sub-users, from the point of view of the staff member who has them.
 *
 * This is the one route in the Users area a non-owner can reach, and it needs
 * the grantable `my_team` permission. A staff member invites; the invite lands
 * as **pending** and an owner has to approve it on the Users tab before the
 * person can sign in. So this cannot be used to manufacture access — the worst
 * a compromised staff account can do is create a row an owner must then
 * approve.
 *
 *   GET  /api/admin/sub-users     my own sub-users, and how many places are left
 *   POST /api/admin/sub-users     invite one (pending)
 *
 * There is no PATCH or DELETE here on purpose. Approving, suspending,
 * reassigning and deleting are owner actions and live on /api/admin/users, so
 * a staff member cannot quietly reactivate somebody an owner suspended.
 */

const SELECT =
  'id, user_id, email, full_name, job_title, phone, tier, status, is_superadmin,' +
  ' permissions, parent_user_id, sub_user_cap, commission_rate, override_rate,' +
  ' invited_by, approved_at, last_seen_at, created_at';

const SETUP_MESSAGE =
  'Sub-users need a database update that has not been run yet. Open the Supabase ' +
  'SQL editor, run supabase/migrations/0005_users.sql, then reload.';

const needsMigration = (error: { code?: string; message?: string } | null): boolean => {
  if (!error) return false;
  return (
    error.code === '42703' || error.code === 'PGRST204' || error.code === '42P01' ||
    /column .* does not exist|could not find the .* column|schema cache/i.test(error.message ?? '')
  );
};

/** Defaults for the deal, held as columns rather than constants in code. */
const DEFAULT_SUB_USER_RATE = 8;
const DEFAULT_OVERRIDE_RATE = 2;

export async function GET(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const { data, error } = await getSupabaseAdmin().from('admin_users').select(SELECT);
    if (error) return serverError(needsMigration(error) ? SETUP_MESSAGE : error.message);

    const all = (data ?? []) as unknown as AdminProfile[];
    const me = auth.admin.profile;

    // An owner sees the whole tree; a staff member sees only their own people.
    // Not a filter for tidiness: without it, a staff member with my_team could
    // read every colleague's commission rate.
    const mine = me.is_superadmin
      ? all.filter(isSubUser)
      : all.filter((u) => isSubUser(u) && u.parent_user_id === me.id);

    const staff = all.filter((u) => !isSubUser(u) && u.status === 'active');

    return ok({
      subUsers: mine,
      // Only an owner needs the list of possible supervisors, and only an
      // owner should see who else works here through this route.
      supervisors: me.is_superadmin
        ? staff.map((s) => ({
            id: s.id,
            full_name: s.full_name,
            email: s.email,
            used: subUserSpotsUsed(s, all),
            cap: subUserCapFor(s),
          }))
        : [],
      me: {
        id: me.id,
        isOwner: me.is_superadmin,
        used: subUserSpotsUsed(me, all),
        cap: subUserCapFor(me),
      },
      defaults: { commission_rate: DEFAULT_SUB_USER_RATE, override_rate: DEFAULT_OVERRIDE_RATE },
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}

export async function POST(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const body = await readJson<Record<string, unknown>>(req);
  if (!body) return badRequest('Request body must be valid JSON.');

  const email = clip(body.email, 200).toLowerCase();
  const fullName = clip(body.full_name, 120);

  const fields: Record<string, string> = {};
  if (!isEmail(email)) fields.email = 'A valid email address is required.';
  if (!fullName) fields.full_name = 'A name is required.';

  const db = getSupabaseAdmin();

  const { data: allRows, error: listError } = await db.from('admin_users').select(SELECT);
  if (listError) return serverError(needsMigration(listError) ? SETUP_MESSAGE : listError.message);
  const all = (allRows ?? []) as unknown as AdminProfile[];

  if (all.some((u) => u.email.toLowerCase() === email)) {
    fields.email = 'That address already has dashboard access.';
  }

  // An owner may invite on somebody else's behalf; a staff member may only
  // invite beneath themselves. Taking the supervisor from the request without
  // this check would let a staff member fill up a colleague's team.
  const me = auth.admin.profile;
  const requestedParent = clip(body.parent_user_id, 60);
  const parentId = me.is_superadmin && requestedParent ? requestedParent : me.id;
  const parent = all.find((u) => u.id === parentId);

  if (!parent) {
    fields.parent_user_id = 'That supervisor does not exist.';
  } else {
    // The cap and the two-level rule, checked against the inviter that will
    // actually own this person.
    const verdict = canInviteSubUser(parent, all);
    if (!verdict.ok) fields.parent_user_id = verdict.reason!;
  }

  const commissionRate = body.commission_rate === undefined || body.commission_rate === ''
    ? DEFAULT_SUB_USER_RATE
    : parseRate(body.commission_rate);
  if (commissionRate === null) fields.commission_rate = 'Use a percentage between 0 and 100.';

  const overrideRate = body.override_rate === undefined || body.override_rate === ''
    ? DEFAULT_OVERRIDE_RATE
    : parseRate(body.override_rate);
  if (overrideRate === null) fields.override_rate = 'Use a percentage between 0 and 100.';

  // Only an owner sets the money. A staff member inviting somebody gets the
  // defaults and can ask for them to be changed.
  const rates = me.is_superadmin
    ? { commission_rate: commissionRate, override_rate: overrideRate }
    : { commission_rate: DEFAULT_SUB_USER_RATE, override_rate: DEFAULT_OVERRIDE_RATE };

  if (Object.keys(fields).length) return badRequest('Could not send that invite.', fields);

  try {
    // No login is created here. The row is pending, and an owner approving it
    // is what creates the account — so an invite alone can never sign in.
    const insertResult = await db
      .from('admin_users')
      .insert({
        email,
        full_name: fullName,
        job_title: clip(body.job_title, 120) || null,
        phone: clip(body.phone, 40) || null,
        tier: 'sub_user',
        status: 'pending',
        is_superadmin: false,
        permissions: sanitizePermissions([]),
        parent_user_id: parent!.id,
        sub_user_cap: 0,
        ...rates,
        invited_by: auth.admin.id,
      })
      .select(SELECT)
      .single();

    const profile = insertResult.data as unknown as AdminProfile | null;
    const error = insertResult.error;

    if (error) {
      if (/only two levels are allowed|own supervisor/i.test(error.message)) {
        return badRequest(error.message);
      }
      return serverError(needsMigration(error) ? SETUP_MESSAGE : error.message);
    }

    await writeAudit(auth.admin, {
      action: 'user.invite',
      targetType: 'admin_user',
      targetId: profile!.id,
      targetLabel: email,
      detail: { parent_user_id: parent!.id, ...rates },
    });

    return created({
      subUser: profile!,
      message: 'Invited. An owner has to approve them before they can sign in.',
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
