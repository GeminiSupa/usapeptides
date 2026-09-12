import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { featureUnavailable } from '@/lib/env';
import { writeAudit, diffOf } from '@/lib/audit';
import {
  GRANTABLE_MODULES, DEFAULT_SUB_USER_CAP,
  canBecomeSubUser, guardSelfEdit, parseRate, sanitizePermissions,
  subUserCapFor, subUserSpotsUsed, validateReassignment, validateSupervisor,
  isSubUser, type AdminProfile, type Tier, type UserStatus,
} from '@/lib/permissions';
import { ok, created, badRequest, notFound, serverError, readJson, isEmail, clip } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Everyone who can sign in to the dashboard: staff and sub-users.
 *
 * The whole route is owner-only. `users` is an ownerOnly module, so
 * requireAdmin refuses anybody else before a handler runs; the mutating
 * handlers also ask for the owner role explicitly, because this is the one
 * place in the application where a bug escalates privilege.
 *
 *   GET    /api/admin/users
 *   POST   /api/admin/users            create staff or a sub-user, with a login
 *   PATCH  /api/admin/users            { id, changes }
 *   DELETE /api/admin/users?id=        revoke dashboard access
 */

/**
 * Long enough that a rushed choice is not guessable. Twelve rather than the
 * eight people reach for: these accounts can read every customer record and
 * every order in the business.
 */
const MIN_PASSWORD = 12;

const SELECT =
  'id, user_id, email, full_name, job_title, phone, avatar_url, tier, status,' +
  ' is_superadmin, permissions, parent_user_id, sub_user_cap, commission_rate,' +
  ' override_rate, invited_by, approved_by, approved_at, suspended_at,' +
  ' last_seen_at, created_at';

/** 0005 has not been run. Say which file, not "column does not exist". */
const SETUP_MESSAGE =
  'The Users section needs a database update that has not been run yet. Open the ' +
  'Supabase SQL editor, run supabase/migrations/0005_users.sql, then reload.';

const needsMigration = (error: { code?: string; message?: string } | null): boolean => {
  if (!error) return false;
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    error.code === '42P01' ||
    /column .* does not exist|could not find the .* column|schema cache/i.test(error.message ?? '')
  );
};

/** A database exception raised by one of the 0005 triggers, in plain words. */
const triggerMessage = (error: { message?: string } | null): string | null => {
  const message = error?.message ?? '';
  if (/only two levels are allowed|cannot become a sub-user|own supervisor/i.test(message)) return message;
  if (/only active owner/i.test(message)) return message;
  return null;
};

/* -------------------------------------------------------------------------- */

export async function GET(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('admin_users')
      .select(SELECT)
      .order('tier', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) return serverError(needsMigration(error) ? SETUP_MESSAGE : error.message);

    const rows = (data ?? []) as unknown as AdminProfile[];

    return ok({
      users: rows,
      you: auth.admin.id,
      // The UI builds its permission grid from this rather than its own copy,
      // so the two can never drift apart.
      grantable: GRANTABLE_MODULES,
      defaultSubUserCap: DEFAULT_SUB_USER_CAP,
      minPassword: MIN_PASSWORD,
      counts: {
        staff: rows.filter((r) => !isSubUser(r)).length,
        subUsers: rows.filter((r) => isSubUser(r)).length,
        owners: rows.filter((r) => r.is_superadmin && r.status === 'active').length,
        pending: rows.filter((r) => r.status === 'pending').length,
      },
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}

/* -------------------------------------------------------------------------- */

export async function POST(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const auth = await requireAdmin(req, { superadmin: true });
  if (!auth.ok) return auth.response;

  const body = await readJson<Record<string, unknown>>(req);
  if (!body) return badRequest('Request body must be valid JSON.');

  const email = clip(body.email, 200).toLowerCase();
  const fullName = clip(body.full_name, 120);
  const password = typeof body.password === 'string' ? body.password : '';
  const tier: Tier = body.tier === 'sub_user' ? 'sub_user' : 'staff';

  const fields: Record<string, string> = {};
  if (!isEmail(email)) fields.email = 'A valid email address is required.';
  if (!fullName) fields.full_name = 'A name is required.';
  if (password.length < MIN_PASSWORD) {
    fields.password = `Use at least ${MIN_PASSWORD} characters.`;
  }

  const db = getSupabaseAdmin();

  // Everyone, so the tier rules can be checked against the real tree rather
  // than against whatever the form believed.
  const { data: allRows, error: listError } = await db.from('admin_users').select(SELECT);
  if (listError) return serverError(needsMigration(listError) ? SETUP_MESSAGE : listError.message);
  const all = (allRows ?? []) as unknown as AdminProfile[];

  if (all.some((u) => u.email.toLowerCase() === email)) {
    fields.email = 'Somebody with that address already has dashboard access.';
  }

  let parent: AdminProfile | undefined;
  if (tier === 'sub_user') {
    const parentId = clip(body.parent_user_id, 60);
    parent = all.find((u) => u.id === parentId);

    const verdict = validateSupervisor(parent);
    if (!verdict.ok) {
      fields.parent_user_id = verdict.reason!;
    } else if (subUserSpotsUsed(parent!, all) >= subUserCapFor(parent!)) {
      fields.parent_user_id =
        `${parent!.full_name || 'That staff member'} has used all ${subUserCapFor(parent!)} of their places.`;
    }
  }

  const commissionRate = body.commission_rate === undefined || body.commission_rate === ''
    ? 0
    : parseRate(body.commission_rate);
  if (commissionRate === null) fields.commission_rate = 'Use a percentage between 0 and 100.';

  const overrideRate = body.override_rate === undefined || body.override_rate === ''
    ? 0
    : parseRate(body.override_rate);
  if (overrideRate === null) fields.override_rate = 'Use a percentage between 0 and 100.';

  if (Object.keys(fields).length) return badRequest('Could not add that person.', fields);

  // A sub-user is never born an owner, whatever was posted. The database has
  // the same rule as a constraint.
  const isOwner = tier === 'staff' && body.is_superadmin === true;

  try {
    // 1. The login.
    const { data: authData, error: authError } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    let userId: string | null = authData?.user?.id ?? null;

    if (authError) {
      if (!/already (been )?registered|already exists|duplicate/i.test(authError.message)) {
        return serverError(authError.message);
      }
      // The address already has an account — a customer being taken on, or an
      // account whose dashboard row was deleted. Their existing password
      // stands; silently resetting it would lock them out of the other one.
      userId = null;
    }

    // 2. The dashboard profile.
    const row = {
      user_id: userId,
      email,
      full_name: fullName,
      job_title: clip(body.job_title, 120) || null,
      phone: clip(body.phone, 40) || null,
      tier,
      // Somebody an owner adds by hand is active at once. The pending state is
      // for sub-users invited by staff, which is a different route.
      status: 'active' as UserStatus,
      is_superadmin: isOwner,
      permissions: sanitizePermissions(body.permissions),
      parent_user_id: tier === 'sub_user' ? parent!.id : null,
      sub_user_cap: tier === 'staff'
        ? Math.max(0, Math.min(200, Number(body.sub_user_cap ?? DEFAULT_SUB_USER_CAP) || 0))
        : 0,
      commission_rate: commissionRate,
      override_rate: overrideRate,
      invited_by: auth.admin.id,
      approved_by: auth.admin.id,
      approved_at: new Date().toISOString(),
    };

    const inserted = await db.from('admin_users').insert(row).select(SELECT).single();
    const profile = inserted.data as unknown as AdminProfile | null;
    const insertError = inserted.error;

    if (insertError) {
      // Roll the login back, but only one we just made. Deleting an account
      // that already existed would destroy somebody else's access.
      if (userId) await db.auth.admin.deleteUser(userId).then(() => {}, () => {});

      const fromTrigger = triggerMessage(insertError);
      if (fromTrigger) return badRequest(fromTrigger);
      return serverError(needsMigration(insertError) ? SETUP_MESSAGE : insertError.message);
    }

    await writeAudit(auth.admin, {
      action: 'user.create',
      targetType: 'admin_user',
      targetId: profile!.id,
      targetLabel: email,
      detail: {
        tier,
        is_superadmin: isOwner,
        permissions: row.permissions,
        parent_user_id: row.parent_user_id,
        reused_existing_login: userId === null,
      },
    });

    return created({
      user: profile!,
      reusedExistingLogin: userId === null,
      message: userId === null
        ? 'That address already had an account, so its existing password still applies. Dashboard access is on.'
        : 'Added. Pass the password to them directly and have them change it.',
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}

/* -------------------------------------------------------------------------- */

/** Columns this route will write, and how each is cleaned. */
const WRITABLE: Record<string, (value: unknown) => unknown> = {
  full_name: (v) => clip(v, 120) || null,
  job_title: (v) => clip(v, 120) || null,
  phone: (v) => clip(v, 40) || null,
  avatar_url: (v) => clip(v, 600) || null,
  tier: (v) => (v === 'sub_user' ? 'sub_user' : 'staff'),
  status: (v) => (v === 'pending' || v === 'suspended' ? v : 'active'),
  is_superadmin: (v) => Boolean(v),
  permissions: (v) => sanitizePermissions(v),
  parent_user_id: (v) => clip(v, 60) || null,
  sub_user_cap: (v) => Math.max(0, Math.min(200, Number(v) || 0)),
  commission_rate: (v) => parseRate(v),
  override_rate: (v) => parseRate(v),
};

export async function PATCH(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const auth = await requireAdmin(req, { superadmin: true });
  if (!auth.ok) return auth.response;

  const body = await readJson<{ id?: string; changes?: Record<string, unknown> }>(req);
  if (!body?.id || !body.changes || typeof body.changes !== 'object') {
    return badRequest('Both "id" and "changes" are required.');
  }

  const db = getSupabaseAdmin();

  const { data: allRows, error: listError } = await db.from('admin_users').select(SELECT);
  if (listError) return serverError(needsMigration(listError) ? SETUP_MESSAGE : listError.message);
  const all = (allRows ?? []) as unknown as AdminProfile[];

  const target = all.find((u) => u.id === body.id);
  if (!target) return notFound('No such user.');

  // Only columns on the list, cleaned on the way in. Anything else posted is
  // dropped rather than written.
  const changes: Record<string, unknown> = {};
  const fields: Record<string, string> = {};

  for (const [key, raw] of Object.entries(body.changes)) {
    const clean = WRITABLE[key];
    if (!clean) continue;
    const value = clean(raw);
    if (value === null && (key === 'commission_rate' || key === 'override_rate')) {
      fields[key] = 'Use a percentage between 0 and 100.';
      continue;
    }
    changes[key] = value;
  }

  if (Object.keys(fields).length) return badRequest('Could not save.', fields);
  if (Object.keys(changes).length === 0) return badRequest('Nothing to change.');

  // Nobody edits their own role, status or permissions — owner included. This
  // is what stops the single click that leaves a business with no owner and no
  // route back except the SQL editor.
  const selfGuard = guardSelfEdit(auth.admin.id, target.id, changes);
  if (!selfGuard.ok) return badRequest(selfGuard.reason!);

  // Becoming a sub-user: refused if anybody is parented to them, or they own
  // the place. The database trigger says the same; this gets there first with
  // a sentence a person can read.
  if (changes.tier === 'sub_user' && target.tier !== 'sub_user') {
    const verdict = canBecomeSubUser(target, all);
    if (!verdict.ok) return badRequest(verdict.reason!);

    const parentId = (changes.parent_user_id ?? target.parent_user_id) as string | null;
    const parent = all.find((u) => u.id === parentId);
    const supervisor = validateSupervisor(parent);
    if (!supervisor.ok) return badRequest(supervisor.reason!, { parent_user_id: supervisor.reason! });
  }

  // Moving a sub-user to a different supervisor.
  if (
    changes.parent_user_id !== undefined &&
    changes.parent_user_id !== target.parent_user_id &&
    (changes.tier ?? target.tier) === 'sub_user'
  ) {
    const parent = all.find((u) => u.id === changes.parent_user_id);
    const verdict = validateReassignment(target, parent, all);
    if (!verdict.ok) return badRequest(verdict.reason!, { parent_user_id: verdict.reason! });
  }

  // An owner must be staff. Enforced by a database constraint too; caught here
  // so the message names the actual problem.
  if (changes.is_superadmin === true && (changes.tier ?? target.tier) === 'sub_user') {
    return badRequest('A sub-user cannot be an owner. Move them to staff first.');
  }

  // Losing the last owner is refused by a database trigger as well, because it
  // must hold for a direct write too.
  const losingOwner =
    target.is_superadmin &&
    target.status === 'active' &&
    (changes.is_superadmin === false || (changes.status !== undefined && changes.status !== 'active'));

  if (losingOwner) {
    const otherOwners = all.filter(
      (u) => u.id !== target.id && u.is_superadmin && u.status === 'active'
    );
    if (otherOwners.length === 0) {
      return badRequest('This is the only active owner. Make somebody else an owner first.');
    }
  }

  // Sub-users hold no permissions and supervise nobody, so demoting somebody
  // clears both rather than leaving stale values behind.
  if (changes.tier === 'sub_user') {
    changes.permissions = [];
    changes.sub_user_cap = 0;
    changes.is_superadmin = false;
  }
  if (changes.tier === 'staff' && target.tier === 'sub_user') {
    changes.parent_user_id = null;
  }

  // An invited sub-user has no login yet: the invite deliberately creates no
  // account, so approving one is what brings the account into existence and
  // that needs a password. Sending them here instead of silently activating a
  // row nobody can sign in to.
  if (changes.status === 'active' && target.status === 'pending') {
    const { data: row } = await db
      .from('admin_users')
      .select('user_id')
      .eq('id', target.id)
      .maybeSingle();

    if (!row?.user_id) {
      return badRequest(
        'Approving this person creates their login, so it needs a starting password. ' +
        'Use Approve on their card rather than the status dropdown.',
        { status: 'Use Approve to set a password.' }
      );
    }
  }

  if (changes.status === 'suspended') changes.suspended_at = new Date().toISOString();
  if (changes.status === 'active' && target.status !== 'active') {
    changes.approved_by = auth.admin.id;
    changes.approved_at = new Date().toISOString();
    changes.suspended_at = null;
  }

  try {
    const { data, error } = await db
      .from('admin_users')
      .update(changes)
      .eq('id', target.id)
      .select(SELECT)
      .maybeSingle();

    if (error) {
      const fromTrigger = triggerMessage(error);
      if (fromTrigger) return badRequest(fromTrigger);
      return serverError(needsMigration(error) ? SETUP_MESSAGE : error.message);
    }
    if (!data) return notFound('No such user.');

    const action =
      changes.status === 'suspended' ? 'user.suspend'
      : changes.status === 'active' && target.status === 'pending' ? 'user.approve'
      : changes.status === 'active' && target.status === 'suspended' ? 'user.reinstate'
      : changes.is_superadmin === true && !target.is_superadmin ? 'user.promote'
      : changes.is_superadmin === false && target.is_superadmin ? 'user.demote'
      : changes.parent_user_id !== undefined && changes.parent_user_id !== target.parent_user_id ? 'user.reassign'
      : changes.permissions !== undefined ? 'user.permissions'
      : 'user.update';

    await writeAudit(auth.admin, {
      action,
      targetType: 'admin_user',
      targetId: target.id,
      targetLabel: target.email,
      detail: diffOf(target as unknown as Record<string, unknown>, changes),
    });

    return ok({ user: data });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}

/* -------------------------------------------------------------------------- */

export async function DELETE(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const auth = await requireAdmin(req, { superadmin: true });
  if (!auth.ok) return auth.response;

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return badRequest('An "id" is required.');

  if (id === auth.admin.id) {
    return badRequest('You cannot remove your own access. Another owner has to do it.');
  }

  const db = getSupabaseAdmin();

  const found = await db.from('admin_users').select(SELECT).eq('id', id).maybeSingle();
  if (found.error) return serverError(needsMigration(found.error) ? SETUP_MESSAGE : found.error.message);

  const target = found.data as unknown as AdminProfile | null;
  if (!target) return notFound('No such user.');

  // Their sub-users would be orphaned, and an orphaned sub-user earns
  // commission nobody is overriding. Reassign first, deliberately.
  const { data: children } = await db
    .from('admin_users')
    .select('id, full_name')
    .eq('parent_user_id', id);

  if (children && children.length > 0) {
    return badRequest(
      `${target.full_name || target.email} supervises ${children.length} sub-user(s). ` +
      'Move them to somebody else first.'
    );
  }

  try {
    const { error } = await db.from('admin_users').delete().eq('id', id);
    if (error) {
      const fromTrigger = triggerMessage(error);
      if (fromTrigger) return badRequest(fromTrigger);
      return serverError(error.message);
    }

    await writeAudit(auth.admin, {
      action: 'user.delete',
      targetType: 'admin_user',
      targetId: id,
      targetLabel: target.email,
      detail: { tier: target.tier, was_owner: target.is_superadmin },
    });

    // The Supabase Auth account is deliberately left alone. Removing dashboard
    // access should not destroy a login that may also be a customer account,
    // and it means re-adding somebody does not mean a new password.
    return ok({
      deleted: true,
      id,
      note: 'Dashboard access removed. Their sign-in account still exists and can be re-added.',
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
