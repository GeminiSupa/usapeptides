import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { featureUnavailable } from '@/lib/env';
import { writeAudit, diffOf } from '@/lib/audit';
import { isOwnMediaUrl } from '@/lib/media';
import { ok, badRequest, notFound, serverError, readJson, clip } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Your own account, and only your own.
 *
 *   GET   /api/admin/profile
 *   PATCH /api/admin/profile   { full_name?, phone?, avatar_url? }
 *
 * Open to every active admin, sub-users included, because everybody should be
 * able to fix their own phone number without asking a super admin. That is
 * safe only because of two things this route does NOT do:
 *
 *   - it never takes an id. The row is always the caller's own, so there is no
 *     way to aim it at somebody else.
 *   - it writes three columns and ignores everything else posted. Role, status,
 *     permissions, pay, rates and email stay with the super-admin-only Users
 *     route, so this cannot be used to promote yourself.
 *
 * Not listed in routePermissions: like /api/admin/me it passes
 * anyAuthenticated, which is a deliberate, per-route exception.
 */

const PROFILE_COLUMNS = 'id, email, full_name, job_title, phone, avatar_url';

/** Mirrors the users route, so both forms refuse the same passwords. */
const MIN_PASSWORD = 12;

export async function GET(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const auth = await requireAdmin(req, { anyAuthenticated: true, allowSubUser: true });
  if (!auth.ok) return auth.response;

  const { data, error } = await getSupabaseAdmin()
    .from('admin_users')
    .select(PROFILE_COLUMNS)
    .eq('id', auth.admin.id)
    .maybeSingle();

  if (error) return serverError(error.message);
  if (!data) return notFound('Your account could not be found.');

  return ok({ profile: data, minPassword: MIN_PASSWORD });
}

export async function PATCH(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const auth = await requireAdmin(req, { anyAuthenticated: true, allowSubUser: true });
  if (!auth.ok) return auth.response;

  const body = await readJson<Record<string, unknown>>(req);
  if (!body) return badRequest('Request body must be valid JSON.');

  const changes: Record<string, unknown> = {};
  const fields: Record<string, string> = {};

  if ('full_name' in body) {
    const name = clip(body.full_name, 120).trim();
    if (!name) fields.full_name = 'Your name cannot be blank.';
    else changes.full_name = name;
  }

  if ('phone' in body) {
    changes.phone = clip(body.phone, 40).trim() || null;
  }

  if ('avatar_url' in body) {
    const url = clip(body.avatar_url, 600).trim();
    if (!url) changes.avatar_url = null;
    else if (!isOwnMediaUrl(url, 'avatars')) fields.avatar_url = 'Upload the photo here rather than pasting a link.';
    else changes.avatar_url = url;
  }

  if (Object.keys(fields).length) return badRequest('Could not save.', fields);
  if (Object.keys(changes).length === 0) return badRequest('Nothing to change.');

  const db = getSupabaseAdmin();

  const before = await db.from('admin_users').select(PROFILE_COLUMNS).eq('id', auth.admin.id).maybeSingle();
  if (before.error) return serverError(before.error.message);
  if (!before.data) return notFound('Your account could not be found.');

  const { data, error } = await db
    .from('admin_users')
    .update(changes)
    .eq('id', auth.admin.id)
    .select(PROFILE_COLUMNS)
    .maybeSingle();

  if (error) return serverError(error.message);
  if (!data) return notFound('Your account could not be found.');

  await writeAudit(auth.admin, {
    action: 'user.profile_update',
    targetType: 'admin_user',
    targetId: auth.admin.id,
    targetLabel: auth.admin.email,
    detail: diffOf(before.data as Record<string, unknown>, changes),
  });

  return ok({ profile: data });
}
