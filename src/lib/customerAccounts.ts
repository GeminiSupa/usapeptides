import 'server-only';

import type { getSupabaseAdmin } from './supabaseAdmin';

type Db = ReturnType<typeof getSupabaseAdmin>;

/**
 * Delete a customer's shop sign-in, unless the same account is also a
 * dashboard login — that one belongs to a member of staff and is never
 * removed from the Customers screen. Returns an error message, or null.
 */
export async function removeCustomerLogin(db: Db, userId: string, email: string): Promise<string | null> {
  const byUser = await db.from('admin_users').select('id').eq('user_id', userId).maybeSingle();
  const byEmail = await db.from('admin_users').select('id').ilike('email', String(email ?? '').trim()).maybeSingle();
  if (byUser.data || byEmail.data) return null;

  const { error } = await db.auth.admin.deleteUser(userId);
  if (error && !/not found/i.test(error.message)) return error.message;
  return null;
}
