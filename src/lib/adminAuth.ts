import 'server-only';

import { getSupabaseAdmin } from './supabaseAdmin';

/**
 * Verify that a request comes from a signed-in administrator.
 *
 * Two independent checks, both required:
 *   1. the bearer token is a valid Supabase Auth session, and
 *   2. that account's email appears in the admin_users allow-list.
 *
 * Holding a valid customer login is therefore not enough to reach admin data.
 */

export interface AdminIdentity {
  email: string;
  userId: string;
}

export type AdminCheck =
  | { ok: true; admin: AdminIdentity }
  | { ok: false; response: Response };

const deny = (status: number, message: string): AdminCheck => ({
  ok: false,
  response: Response.json({ error: 'unauthorized', message }, { status }),
});

export async function requireAdmin(req: Request): Promise<AdminCheck> {
  const header = req.headers.get('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ')
    ? header.slice(7).trim()
    : '';

  if (!token) return deny(401, 'Sign in to access the dashboard.');

  const db = getSupabaseAdmin();

  const { data: userResult, error: authError } = await db.auth.getUser(token);
  if (authError || !userResult?.user?.email) {
    return deny(401, 'Your session has expired. Sign in again.');
  }

  const email = userResult.user.email.toLowerCase();

  const { data: allowed, error: lookupError } = await db
    .from('admin_users')
    .select('email, is_active')
    .ilike('email', email)
    .maybeSingle();

  if (lookupError) {
    return deny(500, 'Could not verify administrator access.');
  }

  if (!allowed || !allowed.is_active) {
    // Deliberately identical to the signed-out message: a non-admin should not
    // learn that the account is valid but unlisted.
    return deny(403, 'This account does not have dashboard access.');
  }

  return { ok: true, admin: { email, userId: userResult.user.id } };
}
