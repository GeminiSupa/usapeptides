'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ScrollText } from 'lucide-react';

/**
 * The audit trail: who did what to whom.
 *
 * Read-only, because the table refuses UPDATE and DELETE in the database. A
 * trail somebody can tidy up is not a trail, so there is deliberately no
 * button here to remove an entry.
 */

interface Entry {
  id: string;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_label: string | null;
  detail: Record<string, unknown>;
  created_at: string;
}

interface Props {
  authedFetch: (path: string, init?: RequestInit) => Promise<Response>;
}

/** Plain-English names, so the log reads as sentences rather than event codes. */
const ACTION_LABEL: Record<string, string> = {
  'user.invite': 'invited',
  'user.create': 'added',
  'user.update': 'edited',
  'user.permissions': 'changed permissions for',
  'user.suspend': 'suspended',
  'user.reinstate': 'reinstated',
  'user.approve': 'approved',
  'user.promote': 'made a super admin',
  'user.demote': 'removed super admin from',
  'user.delete': 'removed access for',
  'user.reassign': 'reassigned',
  'user.password_set': 'set a new password for',
  'user.profile_update': 'updated their own profile',
  'user.password_change': 'changed their own password',
  'order.claim': 'claimed order',
  'order.update': 'updated order',
  'order.assign': 'assigned order',
  'lead.claim': 'claimed lead',
  'customer.assign': 'changed customer owner for',
  'lead.assign': 'assigned lead',
  'affiliate.create': 'added affiliate',
  'affiliate.update': 'edited affiliate',
  'affiliate.delete': 'deleted affiliate',
  'affiliate.code_regenerate': 'reissued the code for',
  'commission.approve': 'approved commission for',
  'commission.settle': 'paid commission to',
  'commission.void': 'voided commission for',
};

export default function AuditPanel({ authedFetch }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authedFetch('/api/admin/audit?limit=200');
      const p = await res.json();
      if (!res.ok) { setError(p?.message ?? 'Could not load the audit trail.'); return; }
      setEntries(p.data.entries ?? []);
      setTotal(p.data.total ?? 0);
    } catch (err) {
      if ((err as Error).message !== 'denied') setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => { void load(); }, [load]);

  /** The diff, rendered as "field: from → to". Never shows a secret. */
  const describe = (detail: Record<string, unknown>): string => {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(detail ?? {})) {
      if (value && typeof value === 'object' && 'from' in (value as any) && 'to' in (value as any)) {
        const v = value as { from: unknown; to: unknown };
        parts.push(`${key.replace(/_/g, ' ')}: ${format(v.from)} → ${format(v.to)}`);
      } else {
        parts.push(`${key.replace(/_/g, ' ')}: ${format(value)}`);
      }
    }
    return parts.join(' · ');
  };

  const format = (v: unknown): string => {
    if (v === null || v === undefined || v === '') return '—';
    if (Array.isArray(v)) return v.length ? v.join(', ') : 'none';
    if (typeof v === 'boolean') return v ? 'yes' : 'no';
    return String(v);
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 border border-brand-border bg-brand-card p-3">
        <p className="text-[0.8125rem] leading-relaxed text-brand-textMuted">
          <span className="font-display font-extrabold uppercase tracking-[0.1em] text-brand-heading">
            {total} recorded action{total === 1 ? '' : 's'}
          </span>
          {' · '}append-only, so nothing here can be edited or removed
        </p>
        <button
          onClick={() => void load()}
          title="Refresh"
          className="ml-auto border border-brand-borderLight p-1.5 text-brand-body hover:border-brand-accent hover:text-brand-accentGlow"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="mb-4 border border-brand-accent/50 bg-brand-card p-4 text-xs leading-relaxed text-brand-body">
          {error}
        </div>
      )}

      {loading && entries.length === 0 ? (
        <p className="text-xs text-brand-textMuted">Loading...</p>
      ) : entries.length === 0 ? (
        <div className="border border-brand-border bg-brand-card p-10 text-center">
          <ScrollText className="mx-auto h-6 w-6 text-brand-textMuted" strokeWidth={1.5} />
          <p className="mt-3 font-display text-sm font-extrabold text-brand-heading">Nothing recorded yet</p>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-brand-textMuted">
            Adding, approving, suspending or removing a user, changing permissions or a commission
            rate, and anything to do with affiliate payments all appear here with who did it.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-brand-border">
          <table className="w-full min-w-[48rem] text-left text-xs">
            <thead className="border-b border-brand-border bg-brand-card">
              <tr>
                {['When', 'Who', 'Did what', 'Details'].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2.5 font-display text-[0.75rem] font-extrabold uppercase tracking-[0.12em] text-brand-textMuted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-brand-border/60 align-top last:border-b-0 hover:bg-brand-card">
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[0.75rem] text-brand-textMuted">
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[0.75rem] text-brand-body">
                    {e.actor_email ?? '—'}
                  </td>
                  <td className="px-3 py-2.5 text-brand-heading">
                    {ACTION_LABEL[e.action] ?? e.action}
                    {e.target_label && (
                      <span className="ml-1 font-mono text-[0.75rem] text-brand-body">{e.target_label}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-[0.75rem] leading-relaxed text-brand-textMuted">
                    {describe(e.detail) || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
