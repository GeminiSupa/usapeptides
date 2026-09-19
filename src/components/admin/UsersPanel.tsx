'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Plus, Pencil, Trash2, KeyRound, ShieldCheck, ShieldOff, Crown, Clock,
  UserCog, GitBranch, Handshake, RefreshCw, Users as UsersIcon, QrCode,
} from 'lucide-react';
import type { AdminProfile, ModuleDef } from '@/lib/permissions';
import UserFormModal, { type Supervisor } from './UserFormModal';
import PasswordModal from './PasswordModal';
import AffiliatesTab from './AffiliatesTab';
import CustomersPanel from './CustomersPanel';
import QrCodesTab from './QrCodesTab';
import AgentCustomersModal from './AgentCustomersModal';
import type { UploadKind } from './UploadField';

/**
 * The Users umbrella: internal team, sub-users, and outside affiliates.
 *
 * Three different relationships with the business, which is why they are three
 * tabs rather than one list:
 *
 *   Team        staff with a dashboard login and a set of permissions
 *   Sub-users   a second level beneath a staff member. No dashboard beyond
 *               their own earnings, and capped at two levels deep
 *   Affiliates  outside partners. No login at all, only a referral code
 *   Customers   clients of the shop. A sign-in for My account, never the dashboard
 *   QR codes    printable codes for everyone's referral link
 *
 * Everything here is checked again server-side. Hiding a button is a courtesy,
 * not a control.
 */

type Tab = 'team' | 'sub' | 'affiliates' | 'customers' | 'qr';

const TABS: { id: Tab; label: string; icon: typeof UserCog }[] = [
  { id: 'team',       label: 'Team',       icon: UserCog },
  { id: 'sub',        label: 'Sub-users',  icon: GitBranch },
  { id: 'affiliates', label: 'Affiliates', icon: Handshake },
  { id: 'customers',  label: 'Customers',  icon: UsersIcon },
  { id: 'qr',         label: 'QR codes',   icon: QrCode },
];

interface UsersResponse {
  users: AdminProfile[];
  you: string;
  grantable: ModuleDef[];
  defaultSubUserCap: number;
  minPassword: number;
  /** False until 0006 has been run; the wage fields are hidden without it. */
  hasPay: boolean;
  /** False until 0007 has been run; the Sales agent choice is hidden without it. */
  hasRoles?: boolean;
  salesAgentModules?: string[];
  counts: { staff: number; subUsers: number; owners: number; pending: number };
}

interface Props {
  authedFetch: (path: string, init?: RequestInit) => Promise<Response>;
  /** True when the person viewing is an owner. */
  isOwner: boolean;
  upload: (file: File, kind: UploadKind) => Promise<string>;
}

const pct = (v: unknown) => `${Number(v ?? 0)}%`;

/** Short forms for the pay chip, so a card does not read "per fortnight". */
const PERIOD_SHORT: Record<string, string> = {
  hourly: 'hr', weekly: 'wk', fortnightly: '2wk', monthly: 'mo', annual: 'yr',
};

export default function UsersPanel({ authedFetch, isOwner, upload }: Props) {
  const [tab, setTab] = useState<Tab>('team');
  const [data, setData] = useState<UsersResponse | null>(null);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [form, setForm] = useState<{ mode: 'create' | 'edit'; user?: AdminProfile | null; tier?: 'staff' | 'sub_user' } | null>(null);
  const [secret, setSecret] = useState<{ kind: 'approve' | 'password'; user: AdminProfile } | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const [customerAgentId, setCustomerAgentId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authedFetch('/api/admin/users');
      const p = await res.json();
      if (!res.ok) { setError(p?.message ?? 'Could not load users.'); return; }
      setData(p.data);

      // Supervisor places come from the sub-users route, which computes them
      // against the whole tree rather than the page's own arithmetic.
      const subRes = await authedFetch('/api/admin/sub-users');
      if (subRes.ok) {
        const sub = await subRes.json();
        setSupervisors(sub?.data?.supervisors ?? []);
      }
    } catch (err) {
      if ((err as Error).message !== 'denied') setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => { void load(); }, [load]);

  /* ------------------------------------------------------------- actions -- */

  const save = async (values: Record<string, unknown>) => {
    if (!form) return;
    setBusy(true); setFormError(''); setFieldErrors({}); setNotice('');
    try {
      const editing = form.mode === 'edit';
      const res = await authedFetch(
        editing ? '/api/admin/users' : form.tier === 'sub_user' ? '/api/admin/sub-users' : '/api/admin/users',
        {
          method: editing ? 'PATCH' : 'POST',
          body: JSON.stringify(editing ? { id: form.user!.id, changes: values } : values),
        }
      );
      const p = await res.json().catch(() => null);
      if (!res.ok) {
        setFormError(p?.message ?? 'Could not save.');
        setFieldErrors(p?.fields ?? {});
        return;
      }
      setForm(null);
      setNotice(p?.data?.message ?? 'Saved.');
      void load();
    } catch { /* denied surfaced upstream */ }
    finally { setBusy(false); }
  };

  const patch = async (id: string, changes: Record<string, unknown>) => {
    setError(''); setNotice('');
    try {
      const res = await authedFetch('/api/admin/users', {
        method: 'PATCH',
        body: JSON.stringify({ id, changes }),
      });
      const p = await res.json().catch(() => null);
      if (!res.ok) { setError(p?.message ?? 'Could not save.'); return; }
      void load();
    } catch { /* denied surfaced upstream */ }
  };

  const remove = async (user: AdminProfile) => {
    if (!window.confirm(
      `Remove dashboard access for ${user.full_name || user.email}?\n\n` +
      'Their sign-in account is kept, so they can be added again later.'
    )) return;

    setError(''); setNotice('');
    try {
      const res = await authedFetch(`/api/admin/users?id=${user.id}`, { method: 'DELETE' });
      const p = await res.json().catch(() => null);
      if (!res.ok) { setError(p?.message ?? 'Could not remove.'); return; }
      setNotice(p?.data?.note ?? 'Removed.');
      void load();
    } catch { /* denied surfaced upstream */ }
  };

  const submitSecret = async (password: string) => {
    if (!secret) return;
    setBusy(true); setFormError('');
    try {
      const path = secret.kind === 'approve'
        ? '/api/admin/users/approve'
        : '/api/admin/users/password';
      const res = await authedFetch(path, {
        method: 'POST',
        body: JSON.stringify({ id: secret.user.id, password }),
      });
      const p = await res.json().catch(() => null);
      if (!res.ok) {
        setFormError(p?.fields?.password ?? p?.message ?? 'Could not save.');
        return;
      }
      setSecret(null);
      setNotice(p?.data?.message ?? 'Done.');
      void load();
    } catch { /* denied surfaced upstream */ }
    finally { setBusy(false); }
  };

  /* --------------------------------------------------------------- render -- */

  const staff = (data?.users ?? []).filter((u) => u.tier !== 'sub_user');
  const subUsers = (data?.users ?? []).filter((u) => u.tier === 'sub_user');
  const nameOf = (id?: string | null) =>
    data?.users.find((u) => u.id === id)?.full_name
    ?? data?.users.find((u) => u.id === id)?.email
    ?? '—';

  const statusChip = (u: AdminProfile) => {
    const styles = {
      active: 'border border-whatsapp text-whatsapp',
      pending: 'border border-action text-action',
      suspended: 'border border-brand-borderLight text-brand-textMuted',
    } as const;
    const icons = { active: ShieldCheck, pending: Clock, suspended: ShieldOff } as const;
    const Icon = icons[u.status];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 font-display text-[0.6875rem] font-black uppercase tracking-[0.1em] ${styles[u.status]}`}>
        <Icon className="h-2.5 w-2.5" />
        {u.status === 'pending' ? 'Awaiting approval' : u.status}
      </span>
    );
  };

  const card = (u: AdminProfile, kind: 'staff' | 'sub') => {
    const isYou = u.id === data?.you;

    return (
      <div key={u.id} className="flex flex-col border border-brand-border bg-brand-card">
        <div className="flex gap-3 p-3.5">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden border border-brand-border bg-brand-dark font-display text-base font-black text-brand-textMuted">
            {(u as any).avatar_url
              ? <img src={(u as any).avatar_url} alt="" className="h-full w-full object-cover" />
              : String(u.full_name || u.email).trim().charAt(0).toUpperCase()}
          </div>

          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate font-display text-xs font-extrabold text-brand-heading">
              {u.full_name || u.email}
              {u.is_superadmin && (
                <span title="Super admin"><Crown className="h-3 w-3 flex-shrink-0 text-action" /></span>
              )}
              {isYou && <span className="text-[0.6875rem] font-normal text-brand-textMuted">(you)</span>}
            </p>
            <p className="truncate text-[0.8125rem] text-brand-body">
              {(u as any).job_title || (u.is_superadmin ? 'Super admin' : kind === 'sub' ? 'Sub-user' : (u as any).role === 'sales_agent' ? 'Sales agent' : 'Staff')}
            </p>
            <p className="truncate font-mono text-[0.6875rem] text-brand-textMuted">{u.email}</p>
            {kind === 'sub' && (
              <p className="mt-0.5 truncate text-[0.6875rem] text-brand-textMuted">
                Under {nameOf(u.parent_user_id)}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 px-3.5 pb-3">
          {statusChip(u)}
          {(u as any).role === 'sales_agent' && (
            <span className="border border-brand-borderLight px-2 py-0.5 font-display text-[0.6875rem] font-black uppercase tracking-[0.1em] text-brand-body">
              Sales agent
            </span>
          )}
          {(u as any).base_salary != null && (
            <span className="px-2 py-0.5 font-display text-[0.6875rem] font-black uppercase tracking-[0.1em] text-brand-body">
              {(u as any).salary_currency ?? 'USD'} {Number((u as any).base_salary).toFixed(2)}
              <span className="ml-1 opacity-70">/{PERIOD_SHORT[String((u as any).salary_period ?? 'monthly')] ?? 'mo'}</span>
            </span>
          )}
          {Number(u.commission_rate) > 0 && (
            <span className="px-2 py-0.5 font-display text-[0.6875rem] font-black uppercase tracking-[0.1em] text-brand-textMuted">
              {pct(u.commission_rate)} commission
            </span>
          )}
          {Number(u.override_rate) > 0 && kind === 'staff' && (
            <span className="px-2 py-0.5 font-display text-[0.6875rem] font-black uppercase tracking-[0.1em] text-brand-textMuted">
              +{pct(u.override_rate)} on recruits
            </span>
          )}
          {kind === 'staff' && !u.is_superadmin && (
            <span className="px-2 py-0.5 font-display text-[0.6875rem] font-black uppercase tracking-[0.1em] text-brand-textMuted">
              {u.permissions.length} section{u.permissions.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {isOwner && (
          <div className="mt-auto flex flex-wrap items-center gap-1 border-t border-brand-border p-2.5">
            <button
              onClick={() => { setForm({ mode: 'edit', user: u }); setFormError(''); setFieldErrors({}); }}
              className="inline-flex items-center gap-1 border border-brand-borderLight px-2 py-1 font-display text-[0.6875rem] font-black uppercase tracking-[0.1em] text-brand-body transition-colors hover:border-brand-accent hover:text-brand-accentGlow"
            >
              <Pencil className="h-2.5 w-2.5" /> Edit
            </button>

            {(u as any).role === 'sales_agent' && (
              <button onClick={() => setCustomerAgentId(u.id)}
                className="inline-flex items-center gap-1 border border-brand-borderLight px-2 py-1 font-display text-[0.6875rem] font-black uppercase tracking-[0.1em] text-brand-body transition-colors hover:border-brand-accent hover:text-brand-accentGlow">
                <UsersIcon className="h-2.5 w-2.5" /> Customers
              </button>
            )}

            {u.status === 'pending' ? (
              <button
                onClick={() => { setSecret({ kind: 'approve', user: u }); setFormError(''); }}
                className="inline-flex items-center gap-1 bg-whatsapp px-2 py-1 font-display text-[0.6875rem] font-black uppercase tracking-[0.1em] text-whatsapp-ink transition-colors hover:bg-whatsapp-hover"
              >
                <ShieldCheck className="h-2.5 w-2.5" /> Approve
              </button>
            ) : u.status === 'active' ? (
              <button
                onClick={() => patch(u.id, { status: 'suspended' })}
                disabled={isYou}
                title={isYou ? 'You cannot suspend your own account' : 'Suspend'}
                className="inline-flex items-center gap-1 border border-brand-borderLight px-2 py-1 font-display text-[0.6875rem] font-black uppercase tracking-[0.1em] text-brand-textMuted transition-colors hover:border-brand-accent hover:text-brand-accentGlow disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ShieldOff className="h-2.5 w-2.5" /> Suspend
              </button>
            ) : (
              <button
                onClick={() => patch(u.id, { status: 'active' })}
                className="inline-flex items-center gap-1 border border-brand-borderLight px-2 py-1 font-display text-[0.6875rem] font-black uppercase tracking-[0.1em] text-brand-body transition-colors hover:border-brand-accent hover:text-brand-accentGlow"
              >
                <ShieldCheck className="h-2.5 w-2.5" /> Reinstate
              </button>
            )}

            <button
              onClick={() => { setSecret({ kind: 'password', user: u }); setFormError(''); }}
              title="Set a new password"
              className="inline-flex items-center gap-1 border border-brand-borderLight px-2 py-1 font-display text-[0.6875rem] font-black uppercase tracking-[0.1em] text-brand-textMuted transition-colors hover:border-brand-accent hover:text-brand-accentGlow"
            >
              <KeyRound className="h-2.5 w-2.5" /> Password
            </button>

            <button
              onClick={() => remove(u)}
              disabled={isYou}
              title={isYou ? 'You cannot remove your own access' : 'Remove access'}
              className="ml-auto p-1 text-brand-textMuted hover:text-brand-accentGlow disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* ------------------------------------------------------------ tabs */}
      <div className="mb-5 flex flex-wrap items-center gap-1 border-b border-brand-border">
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = t.id === tab;
          const count = t.id === 'team' ? data?.counts.staff : t.id === 'sub' ? data?.counts.subUsers : undefined;
          return (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setError(''); setNotice(''); }}
              className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 font-display text-[0.8125rem] font-extrabold uppercase tracking-[0.1em] transition-colors ${
                on
                  ? 'border-brand-accent text-brand-heading'
                  : 'border-transparent text-brand-textMuted hover:text-brand-body'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
              {count !== undefined && <span className="text-[0.6875rem] opacity-70">{count}</span>}
            </button>
          );
        })}

        <button
          onClick={() => void load()}
          title="Refresh"
          className="ml-auto mb-1.5 border border-brand-borderLight p-1.5 text-brand-body hover:border-brand-accent hover:text-brand-accentGlow"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="mb-4 border border-brand-accent/50 bg-brand-card p-4 text-xs leading-relaxed text-brand-body">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-4 border border-brand-border bg-brand-card p-3 text-[0.8125rem] leading-relaxed text-whatsapp">
          {notice}
        </div>
      )}

      {/* --------------------------------------------------------- content */}
      {tab === 'affiliates' ? (
        <AffiliatesTab authedFetch={authedFetch} />
      ) : tab === 'customers' ? (
        <CustomersPanel authedFetch={authedFetch} upload={upload} isAgent={false} />
      ) : tab === 'qr' ? (
        <QrCodesTab authedFetch={authedFetch} users={data?.users ?? []} />
      ) : loading && !data ? (
        <p className="text-xs text-brand-textMuted">Loading...</p>
      ) : tab === 'team' ? (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3 border border-brand-border bg-brand-card p-3">
            <p className="text-[0.8125rem] leading-relaxed text-brand-textMuted">
              <span className="font-display font-extrabold uppercase tracking-[0.1em] text-brand-heading">
                {data?.counts.staff ?? 0} staff
              </span>
              {' · '}{data?.counts.owners ?? 0} super admin{(data?.counts.owners ?? 0) === 1 ? '' : 's'}
              {(data?.counts.pending ?? 0) > 0 && ` · ${data?.counts.pending} awaiting approval`}
            </p>
            {isOwner && (
              <button
                onClick={() => { setForm({ mode: 'create', tier: 'staff' }); setFormError(''); setFieldErrors({}); }}
                className="ml-auto inline-flex items-center gap-1.5 bg-brand-accent px-3 py-1.5 font-display text-[0.75rem] font-extrabold uppercase tracking-[0.1em] text-brand-onAccent transition-colors hover:bg-brand-accentHover"
              >
                <Plus className="h-3 w-3" /> Add team member
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {staff.map((u) => card(u, 'staff'))}
          </div>
        </>
      ) : (
        <>
          <div className="mb-4 border border-brand-border bg-brand-card p-3">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[0.8125rem] leading-relaxed text-brand-textMuted">
                <span className="font-display font-extrabold uppercase tracking-[0.1em] text-brand-heading">
                  {data?.counts.subUsers ?? 0} sub-users
                </span>
              </p>
              {isOwner && (
                <button
                  onClick={() => { setForm({ mode: 'create', tier: 'sub_user' }); setFormError(''); setFieldErrors({}); }}
                  className="ml-auto inline-flex items-center gap-1.5 bg-brand-accent px-3 py-1.5 font-display text-[0.75rem] font-extrabold uppercase tracking-[0.1em] text-brand-onAccent transition-colors hover:bg-brand-accentHover"
                >
                  <Plus className="h-3 w-3" /> Invite a sub-user
                </button>
              )}
            </div>
            <p className="mt-2 text-[0.75rem] leading-relaxed text-brand-textMuted">
              A sub-user sits beneath a staff member and earns on what they refer. They see only
              their own earnings and referral link — not orders, customers or anything else. The
              tree stops at two levels: a sub-user cannot have sub-users of their own.
            </p>
          </div>

          {subUsers.length === 0 ? (
            <div className="border border-brand-border bg-brand-card p-10 text-center">
              <GitBranch className="mx-auto h-6 w-6 text-brand-textMuted" strokeWidth={1.5} />
              <p className="mt-3 font-display text-sm font-extrabold text-brand-heading">No sub-users yet</p>
              <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-brand-textMuted">
                Staff with the “Invite sub-users” permission can invite their own. Those arrive here
                awaiting your approval, and cannot sign in until you approve them.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {subUsers.map((u) => card(u, 'sub'))}
            </div>
          )}
        </>
      )}

      {form && data && (
        <UserFormModal
          mode={form.mode}
          user={form.user}
          lockTier={form.mode === 'create' ? form.tier : undefined}
          grantable={data.grantable}
          supervisors={supervisors}
          minPassword={data.minPassword}
          hasPay={data.hasPay !== false}
          hasRoles={data.hasRoles === true}
          salesAgentModules={data.salesAgentModules ?? []}
          isSelf={form.user?.id === data.you}
          busy={busy}
          error={formError}
          fieldErrors={fieldErrors}
          onCancel={() => setForm(null)}
          onSubmit={save}
        />
      )}

      {secret && data && (
        <PasswordModal
          title={secret.kind === 'approve' ? 'Approve and create their login' : 'Set a new password'}
          subtitle={secret.user.full_name || secret.user.email}
          note={
            secret.kind === 'approve'
              ? 'Approving creates their sign-in account. Until now the invite could not sign in at all.'
              : 'This replaces their current password immediately. Anybody signed in as them stays signed in until their session expires.'
          }
          confirmLabel={secret.kind === 'approve' ? 'Approve' : 'Set password'}
          minPassword={data.minPassword}
          busy={busy}
          error={formError}
          onCancel={() => setSecret(null)}
          onSubmit={submitSecret}
        />
      )}
      {customerAgentId && <AgentCustomersModal agentId={customerAgentId} authedFetch={authedFetch} onClose={() => setCustomerAgentId(null)} />}
    </div>
  );
}
