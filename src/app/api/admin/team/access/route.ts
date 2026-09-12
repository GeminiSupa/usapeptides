import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { featureUnavailable } from '@/lib/env';
import { ok, created, badRequest, serverError, readJson, isEmail, clip } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Dashboard access for a team member.
 *
 * Signing in takes two things, and this route manages both:
 *   1. a Supabase Auth account for the address, and
 *   2. a row in admin_users, the allow-list requireAdmin checks.
 *
 * Having only the first is a customer login. Having only the second cannot sign
 * in at all. Doing this by hand meant two visits to the Supabase console, which
 * is why the dashboard appeared to have no way to add a user.
 *
 *   GET    /api/admin/team/access              who currently has access
 *   POST   /api/admin/team/access  { email, fullName, password }
 *   DELETE /api/admin/team/access?email=...    revoke (keeps the account)
 */

/** Long enough that a hurried choice is still not trivially guessable. */
const MIN_PASSWORD = 10;

/**
 * Insert-or-update keyed on the email address.
 *
 * Not `upsert({ onConflict: 'email' })`: the uniqueness on these tables is a
 * unique index over `lower(email)`, and PostgREST needs a conflict target that
 * matches an index exactly, so naming the bare column fails at runtime. A read
 * followed by a write is dull but correct, and these are one-at-a-time
 * administrative actions rather than a hot path.
 */
async function saveByEmail(
  db: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  email: string,
  row: Record<string, unknown>
): Promise<{ error: { message: string } | null }> {
  const { data: existing, error: lookupError } = await db
    .from(table)
    .select('id')
    .ilike('email', email)
    .maybeSingle();

  if (lookupError) return { error: lookupError };

  if (existing?.id) {
    const { error } = await db.from(table).update(row).eq('id', existing.id);
    return { error };
  }

  const { error } = await db.from(table).insert({ email, ...row });
  return { error };
}

export async function GET(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('admin_users')
      .select('id, email, full_name, is_active, created_at')
      .order('created_at', { ascending: true });

    if (error) return serverError(error.message);

    return ok({ admins: data ?? [], you: auth.admin.email });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}

export async function POST(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const body = await readJson<{ email?: string; fullName?: string; password?: string }>(req);
  if (!body) return badRequest('Request body must be valid JSON.');

  const email = clip(body.email, 200).toLowerCase();
  const fullName = clip(body.fullName, 120);
  const password = typeof body.password === 'string' ? body.password : '';

  const fields: Record<string, string> = {};
  if (!isEmail(email)) fields.email = 'A valid email address is required.';
  if (password.length < MIN_PASSWORD) {
    fields.password = `Use at least ${MIN_PASSWORD} characters.`;
  }
  if (Object.keys(fields).length) return badRequest('Could not grant access.', fields);

  const db = getSupabaseAdmin();

  try {
    // 1. The login itself. An address that already has an account keeps it -
    //    that case is a customer being promoted, or access being restored, and
    //    overwriting their password would be a surprise.
    let userId: string | null = null;
    let accountExisted = false;

    const { data: authData, error: authError } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: fullName ? { full_name: fullName } : undefined,
    });

    if (authError) {
      const alreadyRegistered =
        /already (been )?registered|already exists|duplicate/i.test(authError.message);
      if (!alreadyRegistered) return serverError(authError.message);
      accountExisted = true;
    } else {
      userId = authData.user?.id ?? null;
    }

    // 2. The allow-list row, which is what actually opens the dashboard.
    const { error: listError } = await saveByEmail(db, 'admin_users', email, {
      full_name: fullName || null,
      is_active: true,
    });

    if (listError) {
      // Rolling back the account we just made, so a failure here does not
      // leave a half-created user behind for someone to puzzle over.
      if (userId) await db.auth.admin.deleteUser(userId).catch(() => {});
      return serverError(listError.message);
    }

    // Best effort: keep the staff record in step, without failing the grant.
    await saveByEmail(db, 'team_members', email, {
      full_name: fullName || null,
      has_dashboard_access: true,
    }).catch(() => {});

    return created({
      email,
      accountExisted,
      message: accountExisted
        ? 'That address already had an account, so its existing password still applies. Dashboard access is now on.'
        : 'Account created and dashboard access granted.',
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}

export async function DELETE(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const email = (new URL(req.url).searchParams.get('email') ?? '').trim().toLowerCase();
  if (!email) return badRequest('An "email" is required.');

  // Locking yourself out takes a second administrator and a support request, so
  // it is refused here rather than confirmed with a dialog.
  if (email === auth.admin.email) {
    return badRequest('You cannot remove your own dashboard access.');
  }

  try {
    const db = getSupabaseAdmin();

    // Deactivated, not deleted: the account and its history survive, and access
    // can be restored without recreating the login.
    const { error } = await db
      .from('admin_users')
      .update({ is_active: false })
      .ilike('email', email);

    if (error) return serverError(error.message);

    await db
      .from('team_members')
      .update({ has_dashboard_access: false })
      .ilike('email', email);

    return ok({ email, revoked: true });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
