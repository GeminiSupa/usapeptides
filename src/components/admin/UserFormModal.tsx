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
  /**
   * False when the database has not had the pay migration yet. The wage fields
   * are hidden rather than shown and silently dropped on save.
   */
  hasPay?: boolean;
  /** False until 0007 has been run; the Sales agent choice is hidden without it. */
  hasRoles?: boolean;
  /** The sections an agent may be given, from the API. */
  salesAgentModules?: string[];
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
  mode, user, lockTier, grantable, supervisors, minPassword, hasPay = true,
  hasRoles = false, salesAgentModules = [], isSelf,
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
  const [role, setRole] = useState<'staff' | 'sales_agent'>(
    (user as any)?.role === 'sales_agent' ? 'sales_agent' : 'staff'
  );
  const [cap, setCap] = useState(String(user?.sub_user_cap ?? 5));
  const [commission, setCommission] = useState(String(user?.commission_rate ?? 0));
  const [override, setOverride] = useState(String(user?.override_rate ?? 0));
  const [salary, setSalary] = useState(
    (user as any)?.base_salary == null ? '' : String((user as any).base_salary)
  );
  const [salaryPeriod, setSalaryPeriod] = useState((user as any)?.salary_period ?? 'monthly');
  const [salaryCurrency, setSalaryCurrency] = useState((user as any)?.salary_currency ?? 'USD');
  const [parentId, setParentId] = useState(user?.parent_user_id ?? '');
  const [permissions, setPermissions] = useState<string[]>(user?.permissions ?? []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const isAgent = hasRoles && tier === 'staff' && role === 'sales_agent';

  const groups = useMemo(() => {
    const out: { name: string; modules: ModuleDef[] }[] = [];
    const offered = isAgent ? grantable.filter((m) => salesAgentModules.includes(m.id)) : grantable;
    for (const m of offered) {
      let group = out.find((g) => g.name === m.group);
      if (!group) { group = { name: m.group, modules: [] }; out.push(group); }
      group.modules.push(m);
    }
    return out;
  }, [grantable, isAgent, salesAgentModules]);

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
      // Blank means "no wage recorded", which is null rather than zero — zero
      // would claim they are paid nothing.
      if (hasPay) {
        values.base_salary = salary === '' ? null : salary;
        values.salary_period = salaryPeriod;
        values.salary_currency = salaryCurrency;
      }
      values.permissions = permissions;
      values.sub_user_cap = cap === '' ? 0 : Number(cap);
      values.is_superadmin = isOwner;
      if (hasRoles) values.role = role;
    }

    // Editing sends only what the server allows on that account. Role, status
    // and permissions are refused on your own row, so they are not offered.
    if (editing && isSelf) {
      delete values.permissions;
      delete values.is_superadmin;
      delete values.role;
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
            <p className="mt-0.5 text-[0.75rem] text-brand-textMuted">
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
                {fieldErrors.full_name && <span className="mt-1 block text-[0.75rem] text-brand-accentGlow">{fieldErrors.full_name}</span>}
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
                  <span className="mt-1 block text-[0.75rem] text-brand-textMuted">
                    The address is what they sign in with, so it cannot be changed here.
                  </span>
                )}
                {fieldErrors.email && <span className="mt-1 block text-[0.75rem] text-brand-accentGlow">{fieldErrors.email}</span>}
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
                    className={`px-3 py-1.5 font-display text-[0.75rem] font-black uppercase tracking-[0.1em] transition-colors ${
                      tier === value ? 'bg-brand-accent text-white' : 'border border-brand-borderLight text-brand-textMuted'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[0.75rem] leading-relaxed text-brand-textMuted">
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
              <p className="mt-1 text-[0.75rem] leading-relaxed text-brand-textMuted">
                Shown as you type so you can copy it. It is stored only as a hash, so nobody —
                including you — can read it back afterwards. Pass it to them directly and have
                them change it.
              </p>
              {fieldErrors.password && <span className="mt-1 block text-[0.75rem] text-brand-accentGlow">{fieldErrors.password}</span>}
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
                  {fieldErrors.parent_user_id && <span className="mt-1 block text-[0.75rem] text-brand-accentGlow">{fieldErrors.parent_user_id}</span>}
                </label>

                <label className="block">
                  <span className="eyebrow mb-1.5 block">What they earn %</span>
                  <input type="number" step="0.01" min="0" max="100" value={commission}
                    onChange={(e) => setCommission(e.target.value)} className={input} />
                  {fieldErrors.commission_rate && <span className="mt-1 block text-[0.75rem] text-brand-accentGlow">{fieldErrors.commission_rate}</span>}
                </label>

                <label className="block">
                  <span className="eyebrow mb-1.5 block">What their recruiter earns %</span>
                  <input type="number" step="0.01" min="0" max="100" value={override}
                    onChange={(e) => setOverride(e.target.value)} className={input} />
                  {fieldErrors.override_rate && <span className="mt-1 block text-[0.75rem] text-brand-accentGlow">{fieldErrors.override_rate}</span>}
                </label>
              </div>
              <p className="mt-2 text-[0.75rem] leading-relaxed text-brand-textMuted">
                Both are paid out of the same order. Add them together to see what an order actually
                costs you — 8% to the seller and 2% to whoever recruited them means 10% in total.
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
                    <p className="text-[0.75rem] leading-relaxed text-brand-textMuted">
                      This is your own account, so your role and permissions are not editable here.
                      It is what stops one click leaving the business with no super admin.
                      Another super admin can change them.
                    </p>
                  </div>
                ) : (
                  <>
                    {hasRoles && (
                      <div className="mb-4">
                        <div className="flex gap-2">
                          {([['staff', 'Team member'], ['sales_agent', 'Sales agent']] as const).map(([value, label]) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => {
                                setRole(value);
                                if (value === 'sales_agent') {
                                  setIsOwner(false);
                                  setPermissions((prev) => prev.filter((id) => salesAgentModules.includes(id)));
                                }
                              }}
                              className={`px-3 py-1.5 font-display text-[0.75rem] font-black uppercase tracking-[0.1em] transition-colors ${
                                role === value ? 'bg-brand-accent text-white' : 'border border-brand-borderLight text-brand-textMuted'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <p className="mt-2 text-[0.75rem] leading-relaxed text-brand-textMuted">
                          {role === 'sales_agent'
                            ? 'A sales agent sees only their own orders, customers and leads, plus orders nobody has claimed yet. They get their own referral link, and can have sub-users under them.'
                            : 'A team member sees everything in the sections you tick below.'}
                        </p>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => { if (!isOwner) setRole('staff'); setIsOwner(!isOwner); }}
                      className={`px-3 py-1.5 font-display text-[0.75rem] font-black uppercase tracking-[0.1em] transition-colors ${
                        isOwner ? 'bg-brand-accent text-white' : 'border border-brand-borderLight text-brand-textMuted'
                      }`}
                    >
                      {isOwner ? 'Super admin' : 'Not a super admin'}
                    </button>
                    <p className="mt-2 text-[0.75rem] leading-relaxed text-brand-textMuted">
                      A super admin sees everything and is the only role that can add people, change
                      what they can see, approve invites and read the audit trail. Everyone else gets
                      only the sections ticked below.
                    </p>
                  </>
                )}

                <label className="mt-4 block max-w-[16rem]">
                  <span className="eyebrow mb-1.5 block">How many people can they recruit?</span>
                  <input type="number" min="0" max="200" value={cap}
                    onChange={(e) => setCap(e.target.value)} className={input} />
                  <span className="mt-1 block text-[0.75rem] leading-relaxed text-brand-textMuted">
                    Staff can bring in their own sellers — sub-users — who get a referral link and
                    earn a cut of what they sell. This is the most they are allowed to bring in.
                    Set it to 0 to stop them recruiting anyone.
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
                    <p className="border border-brand-border bg-brand-dark p-3 text-[0.75rem] leading-relaxed text-brand-textMuted">
                      A super admin sees every section, so there is nothing to tick. Switch off
                      Super admin above to choose individual sections.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {isAgent && (
                        <p className="border border-brand-border bg-brand-dark p-3 text-[0.75rem] leading-relaxed text-brand-textMuted">
                          Only these sections can be given to a sales agent. In each one they see only
                          what is theirs.
                        </p>
                      )}
                      {groups.map((group) => (
                        <div key={group.name}>
                          <p className="mb-1.5 text-[0.75rem] uppercase tracking-[0.14em] text-brand-textMuted">
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
                                  className={`px-2.5 py-1 font-display text-[0.6875rem] font-black uppercase tracking-[0.1em] transition-colors ${
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
                      <p className="text-[0.75rem] leading-relaxed text-brand-textMuted">
                        The dashboard home page opens once at least one section is ticked, and shows
                        figures only from those sections. With nothing ticked they can sign in but see
                        nothing. Managing users and the audit trail are super-admin only and cannot be
                        granted to anybody else.
                      </p>
                    </div>
                  )}
                </section>
              )}

              {/* ------------------------------------------------ staff rates */}
              <section className="mb-6">
                <h3 className="eyebrow mb-3 border-b border-brand-border pb-2">Pay</h3>

                {!hasPay && (
                  <p className="mb-4 border border-brand-border bg-brand-dark p-3 text-[0.75rem] leading-relaxed text-brand-textMuted">
                    Wage fields are hidden because the database has not had
                    <span className="font-mono"> 0006_users_fixes.sql </span>
                    run yet. Commission below works either way.
                  </p>
                )}

                <div className={`grid grid-cols-1 gap-4 sm:grid-cols-3 ${hasPay ? '' : 'hidden'}`}>
                  <label className="block">
                    <span className="eyebrow mb-1.5 block">Base pay</span>
                    <input type="number" step="0.01" min="0" value={salary}
                      onChange={(e) => setSalary(e.target.value)} placeholder="0.00" className={input} />
                    {fieldErrors.base_salary && <span className="mt-1 block text-[0.75rem] text-brand-accentGlow">{fieldErrors.base_salary}</span>}
                  </label>

                  <label className="block">
                    <span className="eyebrow mb-1.5 block">Paid</span>
                    <select value={salaryPeriod} onChange={(e) => setSalaryPeriod(e.target.value)} className={input}>
                      <option value="hourly">per hour</option>
                      <option value="weekly">per week</option>
                      <option value="fortnightly">per fortnight</option>
                      <option value="monthly">per month</option>
                      <option value="annual">per year</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="eyebrow mb-1.5 block">Currency</span>
                    <input value={salaryCurrency} maxLength={3}
                      onChange={(e) => setSalaryCurrency(e.target.value.toUpperCase())}
                      className={`${input} font-mono`} />
                  </label>
                </div>

                {hasPay && (
                  <p className="mt-2 text-[0.75rem] leading-relaxed text-brand-textMuted">
                    Their wage, recorded here for your reference. Nothing pays it out — this
                    dashboard does not run payroll.
                  </p>
                )}

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="eyebrow mb-1.5 block">Commission on their own sales %</span>
                    <input type="number" step="0.01" min="0" max="100" value={commission}
                      onChange={(e) => setCommission(e.target.value)} className={input} />
                    <span className="mt-1 block text-[0.75rem] leading-relaxed text-brand-textMuted">
                      What they earn on an order they bring in themselves.
                    </span>
                    {fieldErrors.commission_rate && <span className="mt-1 block text-[0.75rem] text-brand-accentGlow">{fieldErrors.commission_rate}</span>}
                  </label>
                  <label className="block">
                    <span className="eyebrow mb-1.5 block">Cut of what their recruits sell %</span>
                    <input type="number" step="0.01" min="0" max="100" value={override}
                      onChange={(e) => setOverride(e.target.value)} className={input} />
                    <span className="mt-1 block text-[0.75rem] leading-relaxed text-brand-textMuted">
                      When somebody they recruited makes a sale, this is the slice that comes back to
                      them for having brought that person in. Leave it at 0 if you do not want that.
                    </span>
                    {fieldErrors.override_rate && <span className="mt-1 block text-[0.75rem] text-brand-accentGlow">{fieldErrors.override_rate}</span>}
                  </label>
                </div>
              </section>
            </>
          )}

          {error && (
            <p className="mb-4 border border-brand-accent/50 bg-brand-dark p-3 text-[0.8125rem] text-brand-body">
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
