import 'server-only';

import { getSupabaseAdmin } from './supabaseAdmin';
import type { AdminIdentity } from './adminAuth';

/**
 * Append-only record of privileged actions.
 *
 * Granting a permission, changing a commission rate or suspending an account
 * with no record of who did it is how a dispute becomes unanswerable. The table
 * refuses UPDATE and DELETE at the database level, so this is write-once even
 * for the service role.
 *
 * Never throws. A failed audit write must not undo work that already
 * succeeded — the alternative is an action that half-happened, which is worse
 * than a gap in the log. Failures go to the server log so they are visible.
 */

export type AuditAction =
  | 'user.invite'
  | 'user.create'
  | 'user.update'
  | 'user.permissions'
  | 'user.suspend'
  | 'user.reinstate'
  | 'user.approve'
  | 'user.promote'
  | 'user.demote'
  | 'user.delete'
  | 'user.reassign'
  | 'user.password_set'
  | 'user.profile_update'
  | 'user.password_change'
  | 'order.create'
  | 'order.update'
  | 'order.claim'
  | 'order.assign'
  | 'lead.claim'
  | 'lead.assign'
  | 'affiliate.create'
  | 'affiliate.update'
  | 'affiliate.delete'
  | 'affiliate.code_regenerate'
  | 'commission.approve'
  | 'commission.settle'
  | 'commission.void'
  | 'category.create'
  | 'category.update'
  | 'category.delete'
  | 'product.import'
  | 'customer.create'
  | 'customer.assign'
  | 'customer.delete'
  | 'customer.login_invite'
  | 'prospect.import'
  | 'prospect.delete'
  | 'campaign.send'
  | 'campaign.test'
  | 'campaign.delete'
  | 'content.update';

interface AuditEntry {
  action: AuditAction;
  targetType?: string;
  targetId?: string | null;
  targetLabel?: string | null;
  detail?: Record<string, unknown>;
}

/** Keys whose values must never be written to the log. */
const NEVER_LOG = new Set(['password', 'new_password', 'token', 'secret', 'access_token']);

/**
 * Strips anything sensitive and records only that a field changed.
 *
 * A log that stores the password somebody was given is a second copy of the
 * credential, in a table built to be kept forever.
 */
function scrub(detail: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!detail) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(detail)) {
    if (NEVER_LOG.has(key.toLowerCase())) {
      out[key] = '[redacted]';
      continue;
    }
    out[key] = value;
  }
  return out;
}

export async function writeAudit(actor: AdminIdentity, entry: AuditEntry): Promise<void> {
  try {
    const { error } = await getSupabaseAdmin().from('admin_audit_log').insert({
      actor_id: actor.id,
      actor_email: actor.email,
      action: entry.action,
      target_type: entry.targetType ?? null,
      target_id: entry.targetId ?? null,
      target_label: entry.targetLabel ?? null,
      detail: scrub(entry.detail),
    });

    if (error) console.warn('[audit] could not record', entry.action, error.message);
  } catch (err) {
    console.warn('[audit] could not record', entry.action, err);
  }
}

/**
 * What actually changed, for the log. Only the keys present in `changes`, and
 * only when the value really moved, so the trail reads as a list of edits
 * rather than a copy of the row.
 */
export function diffOf(
  before: Record<string, unknown>,
  changes: Record<string, unknown>
): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  for (const [key, to] of Object.entries(changes)) {
    const from = before[key];
    if (JSON.stringify(from) !== JSON.stringify(to)) diff[key] = { from, to };
  }
  return diff;
}
