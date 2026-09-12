'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { X, ShieldAlert } from 'lucide-react';
import type { AdminProfile, ModuleDef } from '@/lib/permissions';

/**
 * Add or edit somebody who can sign in to the dashboard.
 *
 * The permission grid is built from the list the API returns, not from a copy
 * held here, so what the form can offer and what the server will accept cannot
 * drift apart. Anything the server would strip is never rendered as a choice.
 */

export interface Supervisor {
  id: string;
  full_name?: string | null;
  email: string;
  used: number;
  cap: number;
}

interface Props {
  mode: 'create' | 'edit';
  /** The row being edited; absent when adding. */
  user?: AdminProfile | null;
  /** Fixed tier when the tab decides it (the Sub Users tab always invites one). */
  lockTier?: 'staff' | 'sub_user';
  grantable: ModuleDef[];
  supervisors: Supervisor[];
  minPassword: number;
  /** True when the person using this form is the same row. */
  isSelf: boolean;
  busy: boolean;
  error: string;
  fieldErrors: Record<string, string>;
  onCancel: () => void;
  onSubmit: (values: Record<string, unknown>) => void;
}

const input =
  'w-full border border-brand-border bg-brand-dark px-3 py-2 text-xs text-brand-heading placeholder-brand-textMuted focus:border-brand-accent focus:outline-none disabled:opacity-50';

export default function UserFormModal({
  mode, user, lockTier, grantable, supervisors, minPassword, isSelf,
  busy, error, fieldErrors, onCancel, onSubmit,
}: Props) {
  const editing = mode === 'edit';

  const [tier, setTier] = useState<'staff' | 'sub_user'>(
    lockTier ?? (user?.tier === 'sub_user' ? 'sub_user' : 'staff')
  );
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [jobTitle, setJobTitle] = useState((user as any)?.job_title ?? '');
  const [phone, setPhone] = useState((user as any)?.phone ?? '');
  const [password, setPassword] = useState('');
  const [isOwner, setIsOwner] = useState(Boolean(user?.is_superadmin));
  const [cap, setCap] = useState(String(user?.sub_user_cap ?? 5));
  const [commission, setCommission] = useState(String(user?.commission_rate ?? 0));
  const [override, setOverride] = useState(String(user?.override_rate ?? 0));
  const [parentId, setParentId] = useState(user?.parent_user_id ?? '');
  const [permissions, setPermissions] = useState<string[]>(user?.permissions ?? []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const groups = useMemo(() => {
    const out: { name: string; modules: ModuleDef[] }[] = [];
    for (const m of grantable) {
      let group = out.find((g) => g.name === m.group);
      if (!group) { group = { name: m.group, modules: [] }; out.push(group); }
      group.modules.push(m);
    }
    return out;
  }, [grantable]);

  const toggle = (id: string) =>
    setPermissions((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  const isSubUser = tier === 'sub_user';

  const submit = () => {
    const values: Record<string, unknown> = {
      full_name: fullName,
      job_title: jobTitle,
      phone,
      commission_rate: commission === '' ? 0 : commission,
      override_rate: override === '' ? 0 : override,
    };

    if (!editing) {
      values.email = email;
      values.password = password;
      values.tier = tier;
    }

    if (isSubUser) {
      values.parent_user_id = parentId;
    } else {
      values.permissions = permissions;
      values.sub_user_cap = cap === '' ? 0 : Number(cap);
      values.is_superadmin = isOwner;
    }

    // Editing sends only what the server allows on that account. Role, status
    // and permissions are refused on your own row, so they are not offered.
    if (editing && isSelf) {
      delete values.permissions;
      delete values.is_superadmin;
    }

    onSubmit(values);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 p-4 py-8">
      <div className="mx-auto w-full max-w-2xl border border-brand-border bg-brand-card">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-brand-border bg-brand-card px-5 py-4">
          <div>
            <h2 className="font-display text-sm font-extrabold uppercase tracking-[0.1em] text-brand-heading">
              {editing ? `Edit ${user?.full_name || user?.email}` : isSubUser ? 'Invite a sub-user' : 'Add a team member'}
            </h2>
            <p className="mt-0.5 text-[0.625rem] text-brand-textMuted">
              {editing
                ? 'Only what you change is saved.'
                : isSubUser
                  ? 'They sit beneath a staff member and earn on what they refer.'
                  : 'Staff sign in to this dashboard. Tick only what they need.'}
            </p>
          </div>
          <button onClick={onCancel} className="text-brand-textMuted hover:text-brand-heading">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="p-5">
          {/* ------------------------------------------------------- person */}
          <section className="mb-6">
            <h3 className="eyebrow mb-3 border-b border-brand-border pb-2">Person</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="eyebrow mb-1.5 block">Full name{!editing && <span className="ml-1 text-brand-accent">*</span>}</span>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={input} />
                {fieldErrors.full_name && <span className="mt-1 block text-[0.625rem] text-brand-accentGlow">{fieldErrors.full_name}</span>}
              </label>

              <label className="block">
                <span className="eyebrow mb-1.5 block">Email{!editing && <span className="ml-1 text-brand-accent">*</span>}</span>
                <input
                  type="email"
                  value={email}
                  disabled={editing}
                  onChange={(e) => setEmail(e.target.value)}
                  className={input}
                />
                {editing && (
                  <span className="mt-1 block text-[0.625rem] text-brand-textMuted">
                    The address is what they sign in with, so it cannot be changed here.
                  </span>
                )}
                {fieldErrors.email && <span className="mt-1 block text-[0.625rem] text-brand-accentGlow">{fieldErrors.email}</span>}
              </label>

              <label className="block">
                <span className="eyebrow mb-1.5 block">Job title</span>
                <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className={input} />
              </label>

              <label className="block">
                <span className="eyebrow mb-1.5 block">Phone</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className={input} />
              </label>
            </div>
          </section>

          {/* --------------------------------------------------------- role */}
          {!editing && !lockTier && (
            <section className="mb-6">
              <h3 className="eyebrow mb-3 border-b border-brand-border pb-2">Level</h3>
              <div className="flex gap-2">
                {([['staff', 'Staff'], ['sub_user', 'Sub-user']] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTier(value)}
                    className={`px-3 py-1.5 font-display text-[0.625rem] font-black uppercase tracking-[0.1em] transition-colors ${
                      tier === value ? 'bg-brand-accent text-white' : 'border border-brand-borderLight text-brand-textMuted'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[0.625rem] leading-relaxed text-brand-textMuted">
                {isSubUser
                  ? 'A sub-user sees only their own earnings and referral link. They cannot reach orders, customers or anything else.'
                  : 'Staff get the sections you tick below.'}
              </p>
            </section>
          )}

          {/* ----------------------------------------------------- password */}
          {!editing && (
            <section className="mb-6">
              <h3 className="eyebrow mb-3 border-b border-brand-border pb-2">Starting password</h3>
              <input
                type="text"
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={`At least ${minPassword} characters`}
                className={`${input} font-mono`}
              />
              <p className="mt-1 text-[0.625rem] leading-relaxed text-brand-textMuted">
                Shown as you type so you can copy it. It is stored only as a hash, so nobody —
                including you — can read it back afterwards. Pass it to them directly and have
                them change it.
              </p>
              {fieldErrors.password && <span className="mt-1 block text-[0.625rem] text-brand-accentGlow">{fieldErrors.password}</span>}
            </section>
          )}

          {/* -------------------------------------------------- sub-user bits */}
          {isSubUser ? (
            <section className="mb-6">
              <h3 className="eyebrow mb-3 border-b border-brand-border pb-2">Supervisor and rates</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <label className="block sm:col-span-3">
                  <span className="eyebrow mb-1.5 block">Supervisor<span className="ml-1 text-brand-accent">*</span></span>
                  <select value={parentId} onChange={(e) => setParentId(e.target.value)} className={input}>
                    <option value="">— choose a staff member —</option>
                    {supervisors.map((s) => (
                      <option key={s.id} value={s.id} disabled={s.used >= s.cap}>
                        {s.full_name || s.email} ({s.used}/{s.cap} places used)
                      </option>
                    ))}
                  </select>
                  {fieldErrors.parent_user_id && <span className="mt-1 block text-[0.625rem] text-brand-accentGlow">{fieldErrors.parent_user_id}</span>}
                </label>

                <label className="block">
                  <span className="eyebrow mb-1.5 block">Their commission %</span>
                  <input type="number" step="0.01" min="0" max="100" value={commission}
                    onChange={(e) => setCommission(e.target.value)} className={input} />
                  {fieldErrors.commission_rate && <span className="mt-1 block text-[0.625rem] text-brand-accentGlow">{fieldErrors.commission_rate}</span>}
                </label>

                <label className="block">
                  <span className="eyebrow mb-1.5 block">Supervisor override %</span>
                  <input type="number" step="0.01" min="0" max="100" value={override}
                    onChange={(e) => setOverride(e.target.value)} className={input} />
                  {fieldErrors.override_rate && <span className="mt-1 block text-[0.625rem] text-brand-accentGlow">{fieldErrors.override_rate}</span>}
                </label>
              </div>
              <p className="mt-2 text-[0.625rem] leading-relaxed text-brand-textMuted">
                Both come out of the same order. Set them so the total is what you intend to pay —
                8% and 2% means the order costs you 10% in commission.
              </p>
            </section>
          ) : (
            <>
              {/* ------------------------------------------------ staff role */}
              <section className="mb-6">
                <h3 className="eyebrow mb-3 border-b border-brand-border pb-2">Role</h3>

                {isSelf ? (
                  <div className="flex items-start gap-2 border border-brand-border bg-brand-dark p-3">
                    <ShieldAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-brand-accentGlow" />
                    <p className="text-[0.625rem] leading-relaxed text-brand-textMuted">
                      This is your own account, so your role and permissions are not editable here.
                      It is what stops one click leaving the business with no owner. Another owner
                      can change them.
                    </p>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsOwner((v) => !v)}
                      className={`px-3 py-1.5 font-display text-[0.625rem] font-black uppercase tracking-[0.1em] transition-colors ${
                        isOwner ? 'bg-brand-accent text-white' : 'border border-brand-borderLight text-brand-textMuted'
                      }`}
                    >
                      {isOwner ? 'Owner' : 'Not an owner'}
                    </button>
                    <p className="mt-2 text-[0.625rem] leading-relaxed text-brand-textMuted">
                      An owner sees everything and can add, approve and remove people. Everyone else
                      gets only the sections ticked below.
                    </p>
                  </>
                )}

                <label className="mt-4 block max-w-[12rem]">
                  <span className="eyebrow mb-1.5 block">Sub-user places</span>
                  <input type="number" min="0" max="200" value={cap}
                    onChange={(e) => setCap(e.target.value)} className={input} />
                  <span className="mt-1 block text-[0.625rem] text-brand-textMuted">
                    How many sub-users they may have.
                  </span>
                </label>
              </section>

              {/* ----------------------------------------------- permissions */}
              {!isSelf && (
                <section className="mb-6">
                  <h3 className="eyebrow mb-3 border-b border-brand-border pb-2">
                    Sections they can open
                  </h3>

                  {isOwner ? (
                    <p className="border border-brand-border bg-brand-dark p-3 text-[0.625rem] leading-relaxed text-brand-textMuted">
                      Owners see every section, so there is nothing to tick. Turn off Owner above to
                      choose individual sections.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {groups.map((group) => (
                        <div key={group.name}>
                          <p className="mb-1.5 text-[0.625rem] uppercase tracking-[0.14em] text-brand-textMuted">
                            {group.name}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {group.modules.map((m) => {
                              const on = permissions.includes(m.id);
                              return (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => toggle(m.id)}
                                  className={`px-2.5 py-1 font-display text-[0.5625rem] font-black uppercase tracking-[0.1em] transition-colors ${
                                    on ? 'bg-brand-accent text-white' : 'border border-brand-borderLight text-brand-textMuted hover:text-brand-body'
                                  }`}
                                >
                                  {m.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      <p className="text-[0.625rem] leading-relaxed text-brand-textMuted">
                        The dashboard home page is always visible. Managing users and the audit trail
                        are owner-only and cannot be granted.
                      </p>
                    </div>
                  )}
                </section>
              )}

              {/* ------------------------------------------------ staff rates */}
              <section className="mb-6">
                <h3 className="eyebrow mb-3 border-b border-brand-border pb-2">Commission</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="eyebrow mb-1.5 block">Their commission %</span>
                    <input type="number" step="0.01" min="0" max="100" value={commission}
                      onChange={(e) => setCommission(e.target.value)} className={input} />
                    {fieldErrors.commission_rate && <span className="mt-1 block text-[0.625rem] text-brand-accentGlow">{fieldErrors.commission_rate}</span>}
                  </label>
                  <label className="block">
                    <span className="eyebrow mb-1.5 block">Override on sub-users %</span>
                    <input type="number" step="0.01" min="0" max="100" value={override}
                      onChange={(e) => setOverride(e.target.value)} className={input} />
                    {fieldErrors.override_rate && <span className="mt-1 block text-[0.625rem] text-brand-accentGlow">{fieldErrors.override_rate}</span>}
                  </label>
                </div>
              </section>
            </>
          )}

          {error && (
            <p className="mb-4 border border-brand-accent/50 bg-brand-dark p-3 text-[0.6875rem] text-brand-body">
              {error}
            </p>
          )}

          <div className="sticky bottom-0 flex gap-2 border-t border-brand-border bg-brand-card pt-4">
            <button type="submit" disabled={busy} className="btn-primary flex-1 disabled:opacity-60">
              {busy ? 'Saving...' : editing ? 'Save changes' : isSubUser ? 'Send invite' : 'Add them'}
            </button>
            <button type="button" onClick={onCancel} className="btn-ghost">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
