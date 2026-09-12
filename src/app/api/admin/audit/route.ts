import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { featureUnavailable } from '@/lib/env';
import { ok, serverError } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * Read the audit trail. Owner only, and read-only — the table refuses UPDATE
 * and DELETE in the database, so there is deliberately no way to write or tidy
 * it from here.
 *
 *   GET /api/admin/audit?limit=&offset=&action=&target=
 */

export async function GET(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const auth = await requireAdmin(req, { superadmin: true });
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 500);
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);
  const action = url.searchParams.get('action')?.trim();
  const target = url.searchParams.get('target')?.trim();

  try {
    let query = getSupabaseAdmin()
      .from('admin_audit_log')
      .select('id, actor_email, action, target_type, target_id, target_label, detail, created_at',
        { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (action) query = query.eq('action', action);
    if (target) query = query.ilike('target_label', `%${target}%`);

    const { data, error, count } = await query;

    if (error) {
      const missing =
        error.code === '42P01' || /does not exist|schema cache/i.test(error.message ?? '');
      return serverError(
        missing
          ? 'The audit trail needs a database update that has not been run yet. Run ' +
            'supabase/migrations/0005_users.sql in the Supabase SQL editor, then reload.'
          : error.message
      );
    }

    return ok({ entries: data ?? [], total: count ?? 0, limit, offset });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
