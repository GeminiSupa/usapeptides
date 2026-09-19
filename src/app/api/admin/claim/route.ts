import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { featureUnavailable } from '@/lib/env';
import { writeAudit } from '@/lib/audit';
import { canAccess, isSalesAgent } from '@/lib/permissions';
import { isCreditable } from '@/lib/attribution';
import { ok, badRequest, notFound, serverError, readJson, clip } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Claim an unclaimed order or lead, or hand one to somebody.
 *
 *   POST /api/admin/claim   { resource: 'orders' | 'leads', id, agent_id? }
 *
 * A sales agent claims for themselves, and only while nobody owns the record.
 * The write carries that condition, so when two agents press Claim at the same
 * moment exactly one wins and the other is told who did — a plain update would
 * let the second silently overwrite the first.
 *
 * A super admin assigns to any active agent or sub-user, or clears the owner
 * with agent_id null. Staff who are not agents cannot claim at all: they would
 * be taking commission they are not on.
 */

const CLAIMABLE = {
  orders: { table: 'orders', column: 'referred_by', label: 'order' },
  leads: { table: 'leads', column: 'owner_id', label: 'lead' },
} as const;

type Claimable = keyof typeof CLAIMABLE;

const SETUP_MESSAGE =
  'Claiming needs supabase/migrations/0007_sales_agents.sql to be run in the Supabase SQL editor first.';

const isMissingColumn = (error: { code?: string; message?: string } | null): boolean =>
  Boolean(error) &&
  (error!.code === '42703' || error!.code === 'PGRST204' ||
    /column .* does not exist|could not find the .* column|schema cache/i.test(error!.message ?? ''));

export async function POST(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const body = await readJson<{ resource?: string; id?: string; agent_id?: string | null }>(req);
  const resource = body?.resource as Claimable;
  if (!body?.id || !(resource in CLAIMABLE)) {
    return badRequest('Send "resource" (orders or leads) and "id".');
  }

  const me = auth.admin.profile;
  if (!canAccess(resource, me)) {
    return Response.json({ error: 'forbidden', message: 'You do not have permission for that.' }, { status: 403 });
  }

  const target = CLAIMABLE[resource];
  const db = getSupabaseAdmin();
  const now = new Date().toISOString();

  try {
    /* ----------------------------------------------------- super admin -- */
    if (me.is_superadmin) {
      const agentId = body.agent_id ? clip(body.agent_id, 60) : null;

      if (resource === 'orders') {
        const { data: order } = await db.from('orders').select('status, referred_by').eq('id', body.id).maybeSingle();
        if (!order) return notFound('No such order.');
        if (order.status === 'completed' && order.referred_by !== agentId) {
          return badRequest('A completed order keeps its historical agent and commission. Change the customer owner for future orders instead.');
        }
      }

      if (agentId) {
        const { data: person, error } = await db
          .from('admin_users')
          .select('id, role, tier, status, email')
          .eq('id', agentId)
          .maybeSingle();
        if (isMissingColumn(error)) return serverError(SETUP_MESSAGE);
        if (!isCreditable(person)) {
          return badRequest('Choose an active sales agent or sub-user.');
        }
      }

      const patch: Record<string, unknown> = { [target.column]: agentId };
      if (resource === 'orders') {
        patch.agent_source = agentId ? 'assigned' : null;
        patch.agent_claimed_at = agentId ? now : null;
      }

      const { data, error } = await db.from(target.table).update(patch).eq('id', body.id).select('id');
      if (error) return serverError(isMissingColumn(error) ? SETUP_MESSAGE : error.message);
      if (!data?.length) return notFound(`No such ${target.label}.`);

      await writeAudit(auth.admin, {
        action: resource === 'orders' ? 'order.assign' : 'lead.assign',
        targetType: target.label,
        targetId: body.id,
        detail: { agent_id: agentId },
      });

      return ok({ id: body.id, owner: agentId, message: agentId ? 'Assigned.' : 'Now unclaimed.' });
    }

    /* ----------------------------------------------------- sales agent -- */
    if (!isSalesAgent(me)) {
      return badRequest('Only sales agents can claim. A super admin can assign it to one.');
    }

    const patch: Record<string, unknown> = { [target.column]: auth.admin.id };
    if (resource === 'orders') {
      patch.agent_source = 'claim';
      patch.agent_claimed_at = now;
    }

    let claimQuery = db
      .from(target.table)
      .update(patch)
      .eq('id', body.id)
      .is(target.column, null);
    if (resource === 'orders') claimQuery = claimQuery.neq('status', 'completed');
    const { data, error } = await claimQuery.select('id');

    if (error) return serverError(isMissingColumn(error) ? SETUP_MESSAGE : error.message);

    if (!data?.length) {
      const select = resource === 'orders' ? 'referred_by, status' : 'owner_id';
      const { data: current } = await db
        .from(target.table)
        .select(select)
        .eq('id', body.id)
        .maybeSingle();

      if (!current) return notFound(`No such ${target.label}.`);

      if (resource === 'orders' && (current as any).status === 'completed') {
        return badRequest('A completed order cannot be claimed. A super admin must change its ownership.');
      }

      const owner = (current as any)[target.column] as string | null;
      if (owner === auth.admin.id) return ok({ id: body.id, owner, message: 'Already yours.' });

      // Deliberately no name: an agent has no business learning which colleague
      // holds which customer.
      return Response.json(
        { error: 'conflict', message: `Another agent claimed this ${target.label} first.` },
        { status: 409 }
      );
    }

    await writeAudit(auth.admin, {
      action: resource === 'orders' ? 'order.claim' : 'lead.claim',
      targetType: target.label,
      targetId: body.id,
    });

    return ok({ id: body.id, owner: auth.admin.id, message: 'Claimed. It is yours.' });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
