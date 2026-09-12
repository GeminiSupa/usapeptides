'use client';

import React, { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, KeyRound, ShieldCheck, ShieldOff, User } from 'lucide-react';

/**
 * The Team tab.
 *
 * Two different things live here and confusing them is what made this section
 * look empty and useless:
 *
 *   - a team member is a staff record. It gives nobody a login.
 *   - dashboard access is a Supabase Auth account plus a row on the admin
 *     allow-list. Both are required, and both used to have to be created by
 *     hand in the Supabase console.
 *
 * "Grant access" does both in one step, so adding a colleague who can actually
 * sign in no longer needs the console at all.
 */

interface Props {
  rows: Record<string, any>[];
  onEdit: (row: Record<string, any>) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  authedFetch: (path: string, init?: RequestInit) => Promise<Response>;
  onChanged: () => void;
}

interface AdminRow {
  email: string;
  full_name: string | null;
  is_active: boolean;
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner',
  manager: 'Manager',
  staff: 'Staff',
};

export default function TeamPanel({ rows, onEdit, onDelete, onNew, authedFetch, onChanged }: Props) {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [you, setYou] = useState('');
  const [granting, setGranting] = useState<Record<string, any> | null>(null);

  const loadAccess = () => {
    authedFetch('/api/admin/team/access')
      .then((res) => res.json())
      .then((p) => {
        setAdmins(p?.data?.admins ?? []);
        setYou(p?.data?.you ?? '');
      })
      .catch(() => {});
  };

  useEffect(loadAccess, []); // eslint-disable-line react-hooks/exhaustive-deps

  const accessFor = (email: string) =>
    admins.find((a) => a.email.toLowerCase() === String(email ?? '').toLowerCase());

  const revoke = async (email: string) => {
    if (!window.confirm(`Remove dashboard access for ${email}? Their account is kept and access can be restored.`)) return;
    const res = await authedFetch(`/api/admin/team/access?email=${encodeURIComponent(email)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const p = await res.json().catch(() => null);
      window.alert(p?.message ?? 'Could not remove access.');
      return;
    }
    loadAccess();
    onChanged();
  };

  /** Admin allow-list entries with no matching staff record. */
  const orphanAdmins = admins.filter(
    (a) => a.is_active && !rows.some((r) => String(r.email ?? '').toLowerCase() === a.email.toLowerCase())
  );

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3 border border-brand-border bg-brand-card p-3">
        <p className="text-[0.6875rem] leading-relaxed text-brand-textMuted">
          <span className="font-display font-extrabold uppercase tracking-[0.1em] text-brand-heading">
            {rows.length} on the team
          </span>
          {' · '}
          {admins.filter((a) => a.is_active).length} can sign in to this dashboard
        </p>
        <button
          onClick={onNew}
          className="ml-auto inline-flex items-center gap-1.5 bg-brand-accent px-3 py-1.5 font-display text-[0.625rem] font-extrabold uppercase tracking-[0.1em] text-white transition-colors hover:bg-flag-red"
        >
          <Plus className="h-3 w-3" /> Add team member
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="border border-brand-border bg-brand-card p-10 text-center">
          <User className="mx-auto h-6 w-6 text-brand-textMuted" strokeWidth={1.5} />
          <p className="mt-3 font-display text-sm font-extrabold text-brand-heading">
            Nobody on the team yet
          </p>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-brand-textMuted">
            Add the people who work here. A team record is for your own reference — giving
            somebody a login is the separate Grant access step on their card.
          </p>
          <button onClick={onNew} className="btn-primary mt-5">
            <Plus className="h-3.5 w-3.5" /> Add the first person
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((m) => {
            const access = accessFor(m.email);
            const hasAccess = Boolean(access?.is_active);
            const isYou = String(m.email ?? '').toLowerCase() === you.toLowerCase();

            return (
              <div key={m.id} className="flex flex-col border border-brand-border bg-brand-card">
                <div className="flex gap-3 p-3.5">
                  <div className="h-14 w-14 flex-shrink-0 overflow-hidden border border-brand-border bg-brand-dark">
                    {m.avatar_url ? (
                      <img src={m.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center font-display text-base font-black text-brand-textMuted">
                        {String(m.full_name ?? m.email ?? '?').trim().charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-xs font-extrabold text-brand-heading">
                      {m.full_name || m.email}
                      {isYou && <span className="ml-1.5 text-[0.5625rem] text-brand-textMuted">(you)</span>}
                    </p>
                    <p className="truncate text-[0.6875rem] text-brand-body">
                      {m.job_title || ROLE_LABEL[m.role] || 'Staff'}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[0.5625rem] text-brand-textMuted">
                      {m.email}
                    </p>
                    {m.phone && (
                      <p className="truncate font-mono text-[0.5625rem] text-brand-textMuted">{m.phone}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 px-3.5 pb-3">
                  <span
                    className={`px-2 py-0.5 font-display text-[0.5625rem] font-black uppercase tracking-[0.1em] ${
                      m.is_active
                        ? 'bg-brand-accent text-white'
                        : 'border border-brand-borderLight text-brand-textMuted'
                    }`}
                  >
                    {m.is_active ? ROLE_LABEL[m.role] ?? 'Staff' : 'Former'}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 font-display text-[0.5625rem] font-black uppercase tracking-[0.1em] ${
                      hasAccess
                        ? 'border border-whatsapp text-whatsapp'
                        : 'border border-brand-borderLight text-brand-textMuted'
                    }`}
                  >
                    {hasAccess ? <ShieldCheck className="h-2.5 w-2.5" /> : <ShieldOff className="h-2.5 w-2.5" />}
                    {hasAccess ? 'Can sign in' : 'No login'}
                  </span>
                </div>

                <div className="mt-auto flex items-center gap-1 border-t border-brand-border p-2.5">
                  <button
                    onClick={() => onEdit(m)}
                    className="inline-flex items-center gap-1 border border-brand-borderLight px-2 py-1 font-display text-[0.5625rem] font-black uppercase tracking-[0.1em] text-brand-body transition-colors hover:border-brand-accent hover:text-brand-accentGlow"
                  >
                    <Pencil className="h-2.5 w-2.5" /> Edit
                  </button>

                  {hasAccess ? (
                    <button
                      onClick={() => void revoke(m.email)}
                      disabled={isYou}
                      title={isYou ? 'You cannot remove your own access' : 'Remove dashboard access'}
                      className="inline-flex items-center gap-1 border border-brand-borderLight px-2 py-1 font-display text-[0.5625rem] font-black uppercase tracking-[0.1em] text-brand-textMuted transition-colors hover:border-brand-accent hover:text-brand-accentGlow disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ShieldOff className="h-2.5 w-2.5" /> Remove access
                    </button>
                  ) : (
                    <button
                      onClick={() => setGranting(m)}
                      className="inline-flex items-center gap-1 border border-brand-borderLight px-2 py-1 font-display text-[0.5625rem] font-black uppercase tracking-[0.1em] text-brand-body transition-colors hover:border-brand-accent hover:text-brand-accentGlow"
                    >
                      <KeyRound className="h-2.5 w-2.5" /> Grant access
                    </button>
                  )}

                  <button
                    onClick={() => onDelete(m.id)}
                    title="Delete this team record"
                    className="ml-auto p-1 text-brand-textMuted hover:text-brand-accentGlow"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {orphanAdmins.length > 0 && (
        <div className="mt-6 border border-brand-border bg-brand-card p-4">
          <h3 className="eyebrow mb-2">Also has dashboard access</h3>
          <p className="mb-3 text-[0.625rem] leading-relaxed text-brand-textMuted">
            These addresses are on the allow-list but have no team record. That is usually an
            address added straight into Supabase.
          </p>
          <ul className="space-y-1">
            {orphanAdmins.map((a) => (
              <li key={a.email} className="flex items-center gap-2 font-mono text-[0.6875rem] text-brand-body">
                <ShieldCheck className="h-3 w-3 flex-shrink-0 text-whatsapp" />
                {a.email}
                {a.email.toLowerCase() === you.toLowerCase() && (
                  <span className="text-[0.5625rem] text-brand-textMuted">(you)</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {granting && (
        <GrantAccessModal
          member={granting}
          authedFetch={authedFetch}
          onCancel={() => setGranting(null)}
          onDone={() => { setGranting(null); loadAccess(); onChanged(); }}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function GrantAccessModal({
  member, authedFetch, onCancel, onDone,
}: {
  member: Record<string, any>;
  authedFetch: (path: string, init?: RequestInit) => Promise<Response>;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await authedFetch('/api/admin/team/access', {
        method: 'POST',
        body: JSON.stringify({
          email: member.email,
          fullName: member.full_name ?? '',
          password,
        }),
      });
      const p = await res.json().catch(() => null);
      if (!res.ok) {
        setError(p?.fields?.password ?? p?.message ?? 'Could not grant access.');
        return;
      }
      setNotice(p?.data?.message ?? 'Access granted.');
      // Left on screen for a moment: the message says whether the account was
      // new or already existed, which changes what to tell the person.
      window.setTimeout(onDone, 2200);
    } catch {
      setError('Could not grant access.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/85 p-4 py-12">
      <div className="w-full max-w-md border border-brand-border bg-brand-card">
        <div className="border-b border-brand-border px-5 py-4">
          <h2 className="font-display text-sm font-extrabold uppercase tracking-[0.1em] text-brand-heading">
            Grant dashboard access
          </h2>
          <p className="mt-1 text-[0.625rem] text-brand-textMuted">
            {member.full_name || member.email}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4 p-5">
          <div className="border border-brand-border bg-brand-dark p-3 text-[0.625rem] leading-relaxed text-brand-textMuted">
            This creates a login for <span className="font-mono text-brand-body">{member.email}</span> and
            adds them to the administrator allow-list. Set a starting password, pass it to them
            directly, and have them change it once they are in.
          </div>

          <label className="block">
            <span className="eyebrow mb-1.5 block">Starting password</span>
            <input
              required
              type="text"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 10 characters"
              className="w-full border border-brand-border bg-brand-dark px-3 py-2 font-mono text-xs text-brand-heading placeholder-brand-textMuted focus:border-brand-accent focus:outline-none"
            />
            <span className="mt-1 block text-[0.625rem] text-brand-textMuted">
              Shown as you type so you can copy it. It is not stored anywhere you can read it back.
            </span>
          </label>

          {error && <p className="text-[0.6875rem] text-brand-accentGlow">{error}</p>}
          {notice && <p className="text-[0.6875rem] text-whatsapp">{notice}</p>}

          <div className="flex gap-2 border-t border-brand-border pt-4">
            <button type="submit" disabled={busy || Boolean(notice)} className="btn-primary flex-1 disabled:opacity-60">
              {busy ? 'Granting...' : 'Grant access'}
            </button>
            <button type="button" onClick={onCancel} className="btn-ghost">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
