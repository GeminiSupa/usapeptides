import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { featureUnavailable, supabaseEnv } from '@/lib/env';
import { writeAudit } from '@/lib/audit';
import { ok, badRequest, serverError, readJson } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Change your own password.
 *
 *   POST /api/admin/profile/password   { current_password, new_password }
 *
 * The current password is checked first. A session token alone is not enough:
 * somebody who finds a dashboard left open must not be able to lock the real
 * owner of the account out of it.
 *
 * Neither password is logged, returned or written to the audit trail — only
 * that a change happened.
 */

const MIN_PASSWORD = 12;

export async function POST(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const auth = await requireAdmin(req, { anyAuthenticated: true, allowSubUser: true });
  if (!auth.ok) return auth.response;

  const body = await readJson<{ current_password?: unknown; new_password?: unknown }>(req);
  const current = typeof body?.current_password === 'string' ? body.current_password : '';
  const next = typeof body?.new_password === 'string' ? body.new_password : '';

  const fields: Record<string, string> = {};
  if (!current) fields.current_password = 'Enter your current password.';
  if (next.length < MIN_PASSWORD) fields.new_password = `Use at least ${MIN_PASSWORD} characters.`;
  else if (next === current) fields.new_password = 'Choose a password different from your current one.';
  if (Object.keys(fields).length) return badRequest('Could not change your password.', fields);

  if (!auth.admin.userId) {
    return badRequest('Your account has no sign-in linked yet. Sign out and back in, then try again.');
  }
  if (!supabaseEnv.url || !supabaseEnv.anonKey) {
    return serverError('Password changes need NEXT_PUBLIC_SUPABASE_ANON_KEY to be set.');
  }

  try {
    // The same check the sign-in form makes. Supabase rate-limits it, which is
    // what stops this being used to guess the current password.
    const check = await fetch(`${supabaseEnv.url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: supabaseEnv.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: auth.admin.email, password: current }),
      cache: 'no-store',
    });

    if (check.status === 429) {
      return badRequest('Too many attempts. Wait a few minutes and try again.');
    }
    if (!check.ok) {
      return badRequest('Could not change your password.', {
        current_password: 'That is not your current password.',
      });
    }

    const { error } = await getSupabaseAdmin().auth.admin.updateUserById(auth.admin.userId, {
      password: next,
    });
    if (error) return serverError(error.message);

    await writeAudit(auth.admin, {
      action: 'user.password_change',
      targetType: 'admin_user',
      targetId: auth.admin.id,
      targetLabel: auth.admin.email,
    });

    return ok({ message: 'Password changed. Use the new one next time you sign in.' });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
