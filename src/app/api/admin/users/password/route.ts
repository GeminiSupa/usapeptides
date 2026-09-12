import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { featureUnavailable } from '@/lib/env';
import { writeAudit } from '@/lib/audit';
import { ok, badRequest, notFound, serverError, readJson } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Set somebody's dashboard password.
 *
 *   POST /api/admin/users/password   { id, password }
 *
 * Owner only. The new password is never written to the audit log, never
 * returned in the response, and never logged — the log records that a reset
 * happened and who did it, which is the part that matters after the fact.
 *
 * There is no "show me their password" anywhere, because Supabase stores a
 * hash and nothing can read one back. Somebody who has forgotten theirs gets a
 * new one set here.
 */

const MIN_PASSWORD = 12;

export async function POST(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const auth = await requireAdmin(req, { superadmin: true });
  if (!auth.ok) return auth.response;

  const body = await readJson<{ id?: string; password?: string }>(req);
  if (!body?.id) return badRequest('An "id" is required.');

  const password = typeof body.password === 'string' ? body.password : '';
  if (password.length < MIN_PASSWORD) {
    return badRequest('Could not set that password.', {
      password: `Use at least ${MIN_PASSWORD} characters.`,
    });
  }

  const db = getSupabaseAdmin();

  const { data: target, error: lookupError } = await db
    .from('admin_users')
    .select('id, email, user_id, full_name')
    .eq('id', body.id)
    .maybeSingle();

  if (lookupError) return serverError(lookupError.message);
  if (!target) return notFound('No such user.');

  if (!target.user_id) {
    return badRequest(
      'That person has no sign-in account linked yet. They need to sign in once, ' +
      'or be re-added, before a password can be set here.'
    );
  }

  try {
    const { error } = await db.auth.admin.updateUserById(target.user_id, { password });
    if (error) return serverError(error.message);

    await writeAudit(auth.admin, {
      action: 'user.password_set',
      targetType: 'admin_user',
      targetId: target.id,
      targetLabel: target.email,
      // Deliberately no value, not even a length: the log is kept forever.
      detail: { by: auth.admin.email },
    });

    return ok({
      id: target.id,
      message: 'Password set. Give it to them directly and have them change it.',
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
