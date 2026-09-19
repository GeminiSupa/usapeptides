import { requireAdmin } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { featureUnavailable } from '@/lib/env';
import { ok, badRequest, notFound, serverError } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** Customers owned by one sales agent, opened from that agent's profile. */
export async function GET(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;
  const auth = await requireAdmin(req, { superadmin: true });
  if (!auth.ok) return auth.response;
  const agentId = new URL(req.url).searchParams.get('agentId');
  if (!agentId) return badRequest('Choose a sales agent.');

  try {
    const db = getSupabaseAdmin();
    const { data: agent } = await db.from('admin_users').select('id, full_name, email, role, tier, status').eq('id', agentId).maybeSingle();
    if (!agent) return notFound('No sales agent with that id.');
    const { data, error } = await db.from('customer_profiles')
      .select('id, full_name, email, phone, institution, owner_assigned_at, owner_source, created_at')
      .eq('owner_id', agentId).order('owner_assigned_at', { ascending: false }).limit(500);
    if (error) return serverError(/owner_id|schema cache/i.test(error.message)
      ? 'Customer ownership needs supabase/migrations/0019_customer_ownership.sql to be run in Supabase first.'
      : error.message);
    return ok({ agent, customers: data ?? [] });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
