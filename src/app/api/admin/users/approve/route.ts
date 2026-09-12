import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { featureUnavailable } from '@/lib/env';
import { writeAudit } from '@/lib/audit';
import {
  subUserCapFor, subUserSpotsUsed, validateSupervisor, type AdminProfile,
} from '@/lib/permissions';
import { ok, badRequest, notFound, serverError, readJson } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Approve a pending invite, which is what creates the login.
 *
 *   POST /api/admin/users/approve   { id, password }
 *
 * Owner only. An invite from a staff member deliberately creates no Supabase
 * Auth account, so until an owner acts here the row cannot sign in at all —
 * that is what makes the invite safe to hand to staff.
 *
 * The supervisor's place count is re-checked at this moment rather than trusted
 * from invite time. Several invites can be pending against one staff member
 * whose last place has since been filled, and approving them all would put
 * somebody over their cap.
 */

const MIN_PASSWORD = 12;

const SELECT =
  'id, user_id, email, full_name, tier, status, is_superadmin, permissions,' +
  ' parent_user_id, sub_user_cap, commission_rate, override_rate, created_at';

export async function POST(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const auth = await requireAdmin(req, { permission: 'users', superadmin: true });
  if (!auth.ok) return auth.response;

  const body = await readJson<{ id?: string; password?: string }>(req);
  if (!body?.id) return badRequest('An "id" is required.');

  const password = typeof body.password === 'string' ? body.password : '';
  if (password.length < MIN_PASSWORD) {
    return badRequest('Could not approve.', {
      password: `Use at least ${MIN_PASSWORD} characters.`,
    });
  }

  const db = getSupabaseAdmin();

  const { data: allRows, error: listError } = await db.from('admin_users').select(SELECT);
  if (listError) return serverError(listError.message);
  const all = (allRows ?? []) as unknown as AdminProfile[];

  const target = all.find((u) => u.id === body.id);
  if (!target) return notFound('No such invite.');

  if (target.status !== 'pending') {
    return badRequest('That person is not waiting for approval.');
  }

  // Re-check the cap now, not as it was when the invite was sent.
  if (target.tier === 'sub_user') {
    const parent = all.find((u) => u.id === target.parent_user_id);
    const supervisor = validateSupervisor(parent);
    if (!supervisor.ok) return badRequest(supervisor.reason!);

    const cap = subUserCapFor(parent!);
    if (subUserSpotsUsed(parent!, all) >= cap) {
      return badRequest(
        `${parent!.full_name || 'Their supervisor'} has all ${cap} places filled. ` +
        'Raise their limit or move this person to somebody else before approving.'
      );
    }
  }

  try {
    // 1. Create the login, or adopt one that already exists for the address.
    let userId = target.user_id ?? null;

    if (!userId) {
      const { data: authData, error: authError } = await db.auth.admin.createUser({
        email: target.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: target.full_name ?? undefined },
      });

      if (authError) {
        if (!/already (been )?registered|already exists|duplicate/i.test(authError.message)) {
          return serverError(authError.message);
        }
        // The address already had an account. Their existing password stands —
        // resetting it here could lock them out of a customer account they use.
        userId = null;
      } else {
        userId = authData.user?.id ?? null;
      }
    }

    // 2. Activate.
    const updateResult = await db
      .from('admin_users')
      .update({
        status: 'active',
        user_id: userId,
        approved_by: auth.admin.id,
        approved_at: new Date().toISOString(),
        suspended_at: null,
      })
      .eq('id', target.id)
      .select(SELECT)
      .maybeSingle();

    const data = updateResult.data as unknown as AdminProfile | null;
    const error = updateResult.error;

    if (error) {
      // Roll back only a login this call created, never a pre-existing one.
      if (userId && !target.user_id) {
        await db.auth.admin.deleteUser(userId).then(() => {}, () => {});
      }
      if (/only two levels are allowed/i.test(error.message)) return badRequest(error.message);
      return serverError(error.message);
    }

    await writeAudit(auth.admin, {
      action: 'user.approve',
      targetType: 'admin_user',
      targetId: target.id,
      targetLabel: target.email,
      detail: { tier: target.tier, parent_user_id: target.parent_user_id, login_created: Boolean(userId && !target.user_id) },
    });

    return ok({
      user: data,
      message: userId && !target.user_id
        ? 'Approved. Give them the password directly and have them change it.'
        : 'Approved. That address already had an account, so its existing password still applies.',
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
