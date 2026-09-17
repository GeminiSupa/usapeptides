'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Copy, RotateCw, Handshake, Check } from 'lucide-react';

/**
 * Affiliates: outside partners with a referral code and no login.
 *
 * The code is generated, never typed, and never edited in place — a half-typed
 * code is a dead link, and a predictable one lets somebody attribute their own
 * orders to a partner. Regenerating is offered as an explicit action with a
 * warning, because the old link stops working the moment it happens.
 */

interface Affiliate {
  id: string;
  email: string;
  full_name: string | null;
  company: string | null;
  phone: string | null;
  referral_code: string;
  commission_rate: number;
  payout_method: string | null;
  payout_detail: string | null;
  notes: string | null;
  is_active: boolean;
}

interface Totals { pending: number; approved: number; paid: number }

interface Props {
  authedFetch: (path: string, init?: RequestInit) => Promise<Response>;
}

const money = (n: unknown) => `$${Number(n ?? 0).toFixed(2)}`;

const input =
  'w-full border border-brand-border bg-brand-dark px-3 py-2 text-xs text-brand-heading placeholder-brand-textMuted focus:border-brand-accent focus:outline-none';

export default function AffiliatesTab({ authedFetch }: Props) {
  const [rows, setRows] = useState<Affiliate[]>([]);
  const [totals, setTotals] = useState<Record<string, Totals>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Affiliate | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authedFetch('/api/admin/affiliates');
      const p = await res.json();
      if (!res.ok) { setError(p?.message ?? 'Could not load affiliates.'); return; }
      setRows(p.data.affiliates ?? []);
      setTotals(p.data.totals ?? {});
    } catch (err) {
      if ((err as Error).message !== 'denied') setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => { void load(); }, [load]);

  const save = async (values: Record<string, unknown>) => {
    setBusy(true); setFormError(''); setFieldErrors({});
    try {
      const isEdit = Boolean(editing);
      const res = await authedFetch('/api/admin/affiliates', {
        method: isEdit ? 'PATCH' : 'POST',
        body: JSON.stringify(isEdit ? { id: editing!.id, changes: values } : values),
      });
      const p = await res.json().catch(() => null);
      if (!res.ok) {
        setFormError(p?.message ?? 'Could not save.');
        setFieldErrors(p?.fields ?? {});
        return;
      }
      setEditing(undefined);
      void load();
    } catch { /* denied surfaced upstream */ }
    finally { setBusy(false); }
  };

  const toggleActive = async (a: Affiliate) => {
    const res = await authedFetch('/api/admin/affiliates', {
      method: 'PATCH',
      body: JSON.stringify({ id: a.id, changes: { is_active: !a.is_active } }),
    });
    if (!res.ok) {
      const p = await res.json().catch(() => null);
      setError(p?.message ?? 'Could not save.');
      return;
    }
    void load();
  };

  const regenerate = async (a: Affiliate) => {
    if (!window.confirm(
      `Give ${a.full_name || a.email} a new referral code?\n\n` +
      `Their current link (${a.referral_code}) stops working immediately, including ` +
      'anywhere they have already shared or printed it.'
    )) return;

    const res = await authedFetch('/api/admin/affiliates', {
      method: 'PATCH',
      body: JSON.stringify({ id: a.id, regenerateCode: true }),
    });
    if (!res.ok) {
      const p = await res.json().catch(() => null);
      setError(p?.message ?? 'Could not generate a new code.');
      return;
    }
    void load();
  };

  const remove = async (a: Affiliate) => {
    if (!window.confirm(`Delete ${a.full_name || a.email}? This cannot be undone.`)) return;
    const res = await authedFetch(`/api/admin/affiliates?id=${a.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const p = await res.json().catch(() => null);
      setError(p?.message ?? 'Could not delete.');
      return;
    }
    void load();
  };

  const copyLink = async (code: string) => {
    const link = `${window.location.origin}/?ref=${code}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(code);
      window.setTimeout(() => setCopied(''), 1800);
    } catch {
      // Clipboard can be blocked. The code is on screen to copy by hand.
      setError(`Could not copy. Their link is ${link}`);
    }
  };

  const owed = Object.values(totals).reduce((sum, t) => sum + t.pending + t.approved, 0);

  return (
    <div>
      <div className="mb-4 border border-brand-border bg-brand-card p-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[0.8125rem] text-brand-textMuted">
            <span className="font-display font-extrabold uppercase tracking-[0.1em] text-brand-heading">
              {rows.length} affiliate{rows.length === 1 ? '' : 's'}
            </span>
            {owed > 0 && ` · ${money(owed)} owed`}
          </p>
          <button
            onClick={() => { setEditing(null); setFormError(''); setFieldErrors({}); }}
            className="ml-auto inline-flex items-center gap-1.5 bg-brand-accent px-3 py-1.5 font-display text-[0.75rem] font-extrabold uppercase tracking-[0.1em] text-brand-onAccent transition-colors hover:bg-brand-accentHover"
          >
            <Plus className="h-3 w-3" /> Add affiliate
          </button>
        </div>
        <p className="mt-2 text-[0.75rem] leading-relaxed text-brand-textMuted">
          Outside partners. They have no dashboard login — only a referral code, and commission on
          orders that arrive through it.
        </p>
      </div>

      {error && (
        <div className="mb-4 border border-brand-accent/50 bg-brand-card p-4 text-xs leading-relaxed text-brand-body">
          {error}
        </div>
      )}

      {loading && rows.length === 0 ? (
        <p className="text-xs text-brand-textMuted">Loading...</p>
      ) : rows.length === 0 ? (
        <div className="border border-brand-border bg-brand-card p-10 text-center">
          <Handshake className="mx-auto h-6 w-6 text-brand-textMuted" strokeWidth={1.5} />
          <p className="mt-3 font-display text-sm font-extrabold text-brand-heading">No affiliates yet</p>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-brand-textMuted">
            Add a partner and they get a referral code you can hand them. Commission on orders
            through that code appears under Commissions.
          </p>
          <button onClick={() => { setEditing(null); setFormError(''); }} className="btn-primary mt-5">
            <Plus className="h-3.5 w-3.5" /> Add the first one
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((a) => {
            const t = totals[a.id] ?? { pending: 0, approved: 0, paid: 0 };
            return (
              <div key={a.id} className="flex flex-col border border-brand-border bg-brand-card">
                <div className="p-3.5">
                  <p className="truncate font-display text-xs font-extrabold text-brand-heading">
                    {a.full_name || a.email}
                  </p>
                  {a.company && <p className="truncate text-[0.8125rem] text-brand-body">{a.company}</p>}
                  <p className="truncate font-mono text-[0.6875rem] text-brand-textMuted">{a.email}</p>

                  <div className="mt-3 flex items-center gap-2">
                    <code className="border border-brand-border bg-brand-dark px-2 py-1 font-mono text-[0.8125rem] tracking-wider text-brand-heading">
                      {a.referral_code}
                    </code>
                    <button
                      onClick={() => void copyLink(a.referral_code)}
                      title="Copy their referral link"
                      className="p-1 text-brand-textMuted hover:text-brand-accentGlow"
                    >
                      {copied === a.referral_code
                        ? <Check className="h-3 w-3 text-whatsapp" />
                        : <Copy className="h-3 w-3" />}
                    </button>
                    <button
                      onClick={() => void regenerate(a)}
                      title="Replace this code"
                      className="p-1 text-brand-textMuted hover:text-brand-accentGlow"
                    >
                      <RotateCw className="h-3 w-3" />
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-brand-border pt-3 text-[0.75rem]">
                    <div>
                      <div className="eyebrow">Rate</div>
                      <div className="mt-0.5 font-display font-black text-brand-heading">{Number(a.commission_rate)}%</div>
                    </div>
                    <div>
                      <div className="eyebrow">Owed</div>
                      <div className="mt-0.5 font-display font-black text-brand-heading">{money(t.pending + t.approved)}</div>
                    </div>
                    <div>
                      <div className="eyebrow">Paid</div>
                      <div className="mt-0.5 font-display font-black text-brand-textMuted">{money(t.paid)}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-auto flex items-center gap-1 border-t border-brand-border p-2.5">
                  <button
                    onClick={() => toggleActive(a)}
                    className={`px-2 py-1 font-display text-[0.6875rem] font-black uppercase tracking-[0.1em] transition-colors ${
                      a.is_active ? 'bg-whatsapp text-whatsapp-ink' : 'border border-brand-borderLight text-brand-textMuted'
                    }`}
                  >
                    {a.is_active ? 'Active' : 'Switched off'}
                  </button>
                  <button
                    onClick={() => { setEditing(a); setFormError(''); setFieldErrors({}); }}
                    className="inline-flex items-center gap-1 border border-brand-borderLight px-2 py-1 font-display text-[0.6875rem] font-black uppercase tracking-[0.1em] text-brand-body transition-colors hover:border-brand-accent hover:text-brand-accentGlow"
                  >
                    <Pencil className="h-2.5 w-2.5" /> Edit
                  </button>
                  <button
                    onClick={() => void remove(a)}
                    title="Delete"
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

      {editing !== undefined && (
        <AffiliateForm
          affiliate={editing}
          busy={busy}
          error={formError}
          fieldErrors={fieldErrors}
          onCancel={() => setEditing(undefined)}
          onSubmit={save}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function AffiliateForm({
  affiliate, busy, error, fieldErrors, onCancel, onSubmit,
}: {
  affiliate: Affiliate | null;
  busy: boolean;
  error: string;
  fieldErrors: Record<string, string>;
  onCancel: () => void;
  onSubmit: (values: Record<string, unknown>) => void;
}) {
  const editing = Boolean(affiliate);
  const [values, setValues] = useState<Record<string, string>>({
    full_name: affiliate?.full_name ?? '',
    email: affiliate?.email ?? '',
    company: affiliate?.company ?? '',
    phone: affiliate?.phone ?? '',
    commission_rate: String(affiliate?.commission_rate ?? 10),
    payout_method: affiliate?.payout_method ?? '',
    payout_detail: affiliate?.payout_detail ?? '',
    notes: affiliate?.notes ?? '',
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const set = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }));

  const submit = () => {
    const out: Record<string, unknown> = { ...values };
    // The address is the identity here, so it is not editable afterwards.
    if (editing) delete out.email;
    onSubmit(out);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 p-4 py-10">
      <div className="mx-auto max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto border border-brand-border bg-brand-card [scrollbar-color:theme(colors.brand.borderLight)_transparent] [scrollbar-width:thin]">
        <div className="border-b border-brand-border px-5 py-4">
          <h2 className="font-display text-sm font-extrabold uppercase tracking-[0.1em] text-brand-heading">
            {editing ? 'Edit affiliate' : 'Add an affiliate'}
          </h2>
          {!editing && (
            <p className="mt-0.5 text-[0.75rem] text-brand-textMuted">
              A referral code is generated for them automatically.
            </p>
          )}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="eyebrow mb-1.5 block">Name<span className="ml-1 text-brand-accent">*</span></span>
              <input value={values.full_name} onChange={(e) => set('full_name', e.target.value)} className={input} />
              {fieldErrors.full_name && <span className="mt-1 block text-[0.75rem] text-brand-accentGlow">{fieldErrors.full_name}</span>}
            </label>

            <label className="block">
              <span className="eyebrow mb-1.5 block">Email<span className="ml-1 text-brand-accent">*</span></span>
              <input type="email" disabled={editing} value={values.email}
                onChange={(e) => set('email', e.target.value)} className={`${input} disabled:opacity-50`} />
              {fieldErrors.email && <span className="mt-1 block text-[0.75rem] text-brand-accentGlow">{fieldErrors.email}</span>}
            </label>

            <label className="block">
              <span className="eyebrow mb-1.5 block">Company</span>
              <input value={values.company} onChange={(e) => set('company', e.target.value)} className={input} />
            </label>

            <label className="block">
              <span className="eyebrow mb-1.5 block">Phone</span>
              <input value={values.phone} onChange={(e) => set('phone', e.target.value)} className={input} />
            </label>

            <label className="block">
              <span className="eyebrow mb-1.5 block">Commission %</span>
              <input type="number" step="0.01" min="0" max="100" value={values.commission_rate}
                onChange={(e) => set('commission_rate', e.target.value)} className={input} />
              {fieldErrors.commission_rate && <span className="mt-1 block text-[0.75rem] text-brand-accentGlow">{fieldErrors.commission_rate}</span>}
            </label>

            <label className="block">
              <span className="eyebrow mb-1.5 block">How they are paid</span>
              <select value={values.payout_method} onChange={(e) => set('payout_method', e.target.value)} className={input}>
                <option value="">— not set —</option>
                <option value="paypal">PayPal</option>
                <option value="bank">Bank transfer</option>
                <option value="crypto">Crypto</option>
                <option value="store_credit">Store credit</option>
              </select>
            </label>

            <label className="block sm:col-span-2">
              <span className="eyebrow mb-1.5 block">Payment details</span>
              <input value={values.payout_detail} onChange={(e) => set('payout_detail', e.target.value)} className={input} />
              <span className="mt-1 block text-[0.75rem] text-brand-textMuted">
                Whatever you need to pay them — an account reference, not card numbers.
              </span>
            </label>

            <label className="block sm:col-span-2">
              <span className="eyebrow mb-1.5 block">Notes</span>
              <textarea rows={3} value={values.notes} onChange={(e) => set('notes', e.target.value)} className={input} />
            </label>
          </div>

          {error && <p className="text-[0.8125rem] text-brand-accentGlow">{error}</p>}

          <div className="flex gap-2 border-t border-brand-border pt-4">
            <button type="submit" disabled={busy} className="btn-primary flex-1 disabled:opacity-60">
              {busy ? 'Saving...' : editing ? 'Save changes' : 'Add affiliate'}
            </button>
            <button type="button" onClick={onCancel} className="btn-ghost">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
