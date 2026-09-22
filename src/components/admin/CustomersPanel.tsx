'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Copy, Download, History, KeyRound, Loader2, Mail, MessageCircle, Pencil, Phone, Plus, QrCode,
  RefreshCw, Search, Trash2, UserCheck, X,
} from 'lucide-react';
import RecordEditor, { type FieldDef } from './RecordEditor';
import QrCodeModal, { type QrTarget } from './QrCodeModal';
import type { UploadKind } from './UploadField';
import { BUSINESS } from '@/lib/env';
import { cleanWhatsAppNumber, isValidWhatsAppNumber } from '@/lib/whatsapp';
import { exportSheet, stamp, type SheetFormat } from '@/lib/sheetFiles';
import CustomerDetailModal from './CustomerDetailModal';

/**
 * Customers: everyone who has ordered or been added by hand.
 *
 * Each row carries the ways to reach the person — WhatsApp, email, call — and
 * one-click delete. "Sign-in" gives a client a password for the shop's My
 * account page, so they can see their orders.
 *
 * Loads its own data, so the same screen also sits under Users > Customers.
 */

type Fetcher = (path: string, init?: RequestInit) => Promise<Response>;

interface Props {
  authedFetch: Fetcher;
  upload: (file: File, kind: UploadKind) => Promise<string>;
  /** Sales agents: only their own customers, no delete, no sign-ins. */
  isAgent: boolean;
}

interface Stats { orders: number; spent: number; lastOrderAt: string | null }

const money = (n: number) => `$${n.toFixed(2)}`;
const firstName = (row: Record<string, any>) => String(row.full_name ?? '').trim().split(/\s+/)[0] || 'there';

function randomPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = new Uint32Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export default function CustomersPanel({ authedFetch, upload, isAgent }: Props) {
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [total, setTotal] = useState(0);
  const [meta, setMeta] = useState<{ createFields: FieldDef[]; editable: string[]; deletable: boolean }>({ createFields: [], editable: [], deletable: false });
  const [stats, setStats] = useState<Record<string, Stats>>({});
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [editor, setEditor] = useState<Record<string, any> | null | undefined>(undefined);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [login, setLogin] = useState<Record<string, any> | null>(null);
  const [qr, setQr] = useState<QrTarget | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(async (q = '') => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (q.trim()) params.set('q', q.trim());
      const [res, statRes] = await Promise.all([
        authedFetch(`/api/admin/customers?${params}`),
        authedFetch('/api/admin/customers/stats'),
      ]);
      const p = await res.json();
      if (!res.ok) throw new Error(p?.message ?? 'Could not load customers.');
      setRows(p.data.rows);
      setTotal(p.data.total);
      setMeta({ createFields: p.data.createFields, editable: p.data.editable, deletable: p.data.deletable });
      const s = await statRes.json().catch(() => null);
      if (statRes.ok) setStats(s.data.stats);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load customers.';
      if (message !== 'denied') setError(message);
    } finally { setLoading(false); }
  }, [authedFetch]);

  useEffect(() => { void load(); }, [load]);

  const statFor = (row: Record<string, any>): Stats =>
    stats[String(row.email ?? '').toLowerCase()] ?? { orders: 0, spent: 0, lastOrderAt: null };

  const totals = useMemo(() => ({
    withLogin: rows.filter((r) => r.user_id).length,
    buyers: rows.filter((r) => statFor(r).orders > 0).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [rows, stats]);

  /* ----------------------------------------------------------- actions --- */

  const whatsappLink = (row: Record<string, any>) => {
    const digits = cleanWhatsAppNumber(row.phone);
    if (!isValidWhatsAppNumber(digits)) return null;
    const text = `Hi ${firstName(row)}, this is ${BUSINESS.name}. `;
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  };

  const mailLink = (row: Record<string, any>) =>
    `mailto:${encodeURIComponent(row.email)}?subject=${encodeURIComponent(`${BUSINESS.name} — your order`)}&body=${encodeURIComponent(`Hi ${firstName(row)},\n\n`)}`;

  const remove = async (row: Record<string, any>) => {
    const label = row.full_name || row.email;
    const extra = row.user_id ? ' Their shop sign-in is removed too.' : '';
    if (!window.confirm(`Delete ${label}? Their past orders stay.${extra}`)) return;
    setError(''); setNotice('');
    try {
      const res = await authedFetch(`/api/admin/customers?id=${encodeURIComponent(row.id)}`, { method: 'DELETE' });
      const p = await res.json().catch(() => null);
      if (!res.ok) throw new Error(p?.message ?? 'Delete failed.');
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      setTotal((t) => Math.max(0, t - 1));
      setNotice(`${label} deleted.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Delete failed.';
      if (message !== 'denied') setError(message);
    }
  };

  const save = async (values: Record<string, unknown>) => {
    const editing = Boolean(editor);
    if (editing && Object.keys(values).length === 0) { setEditor(undefined); return; }
    setSaveBusy(true); setSaveError(''); setFieldErrors({});
    try {
      const res = await authedFetch('/api/admin/customers', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(editing ? { id: editor!.id, changes: values } : values),
      });
      const p = await res.json().catch(() => null);
      if (!res.ok) { setSaveError(p?.message ?? 'Could not save.'); setFieldErrors(p?.fields ?? {}); return; }
      setEditor(undefined);
      void load(query);
    } catch { setSaveError('Could not save.'); }
    finally { setSaveBusy(false); }
  };

  const doExport = async (format: SheetFormat) => {
    setExportOpen(false);
    const headers = ['Name', 'Email', 'Phone', 'Institution', 'Orders', 'Spent', 'Last order', 'Sign-in', 'Marketing', 'Added'];
    await exportSheet(format, {
      filename: `customers-${stamp()}`,
      title: 'Customers',
      headers,
      rows: rows.map((r) => {
        const s = statFor(r);
        return [
          r.full_name ?? '', r.email ?? '', r.phone ?? '', r.institution ?? '', s.orders, Number(s.spent.toFixed(2)),
          s.lastOrderAt ? s.lastOrderAt.slice(0, 10) : '', r.user_id ? 'Yes' : 'No', r.marketing_opt_in ? 'Yes' : 'No',
          String(r.created_at ?? '').slice(0, 10),
        ];
      }),
    });
  };

  /* -------------------------------------------------------------- view --- */

  const iconButton = 'inline-flex h-10 w-10 items-center justify-center border transition-colors md:h-8 md:w-8';

  /** Contact and record actions; shared by the phone cards and the desktop table. */
  const rowActions = (row: Record<string, any>, className = 'justify-end') => {
    const wa = whatsappLink(row);
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        {wa ? (
          <a href={wa} target="_blank" rel="noopener noreferrer" title={`WhatsApp ${row.phone}`}
            className={`${iconButton} border-whatsapp bg-whatsapp text-whatsapp-ink hover:bg-whatsapp-hover`}>
            <MessageCircle className="h-3.5 w-3.5" />
          </a>
        ) : (
          <span title="No usable phone number" className={`${iconButton} cursor-not-allowed border-brand-border text-brand-border`}>
            <MessageCircle className="h-3.5 w-3.5" />
          </span>
        )}
        <a href={mailLink(row)} title={`Email ${row.email}`}
          className={`${iconButton} border-brand-borderLight text-brand-heading hover:border-brand-accent`}>
          <Mail className="h-3.5 w-3.5" />
        </a>
        {row.phone && (
          <a href={`tel:${String(row.phone).replace(/[^\d+]/g, '')}`} title={`Call ${row.phone}`}
            className={`${iconButton} border-brand-borderLight text-brand-heading hover:border-brand-accent`}>
            <Phone className="h-3.5 w-3.5" />
          </a>
        )}
        {!isAgent && (
          <button onClick={() => setLogin(row)} title={row.user_id ? 'Reset sign-in password' : 'Give a sign-in'}
            className={`${iconButton} border-brand-borderLight text-brand-heading hover:border-brand-accent`}>
            <KeyRound className="h-3.5 w-3.5" />
          </button>
        )}
        {meta.editable.length > 0 && (
          <button onClick={() => { setEditor(row); setSaveError(''); setFieldErrors({}); }} title="Edit"
            className={`${iconButton} border-brand-borderLight text-brand-heading hover:border-brand-accent`}>
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        <button onClick={() => setDetailId(row.id)} title="Customer profile and history"
          className={`${iconButton} border-brand-borderLight text-brand-heading hover:border-brand-accent`}>
          <History className="h-3.5 w-3.5" />
        </button>
        {meta.deletable && (
          <button onClick={() => void remove(row)} title="Delete customer"
            className={`${iconButton} border-brand-borderLight text-brand-textMuted hover:border-action hover:text-action`}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.75rem] text-brand-textMuted">
          <span><strong className="text-brand-heading">{total}</strong> customers</span>
          <span>{totals.buyers} have ordered</span>
          <span>{totals.withLogin} can sign in</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <button className="btn-secondary" onClick={() => setExportOpen((o) => !o)} disabled={rows.length === 0}>
              <Download className="h-3.5 w-3.5" /> Export
            </button>
            {exportOpen && (
              <>
                <button aria-label="Close menu" className="fixed inset-0 z-30 cursor-default" onClick={() => setExportOpen(false)} />
                <div className="absolute right-0 z-40 mt-1 w-40 border border-brand-border bg-brand-card py-1">
                  {([['xlsx', 'Excel (.xlsx)'], ['csv', 'CSV (.csv)'], ['pdf', 'PDF']] as const).map(([id, label]) => (
                    <button key={id} onClick={() => void doExport(id)} className="block w-full px-3 py-2 text-left text-xs text-brand-body hover:bg-brand-dark">{label}</button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button className="btn-secondary" onClick={() => void load(query)}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          {meta.createFields.length > 0 && (
            <button className="btn-primary px-3 py-2" onClick={() => { setEditor(null); setSaveError(''); setFieldErrors({}); }}>
              <Plus className="h-3.5 w-3.5" /> New customer
            </button>
          )}
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-textMuted" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void load(query)}
          placeholder="Search name, email, phone or institution — press Enter" className="field-input pl-8" />
      </div>

      {error && <p className="border border-action/50 bg-brand-card p-3 text-xs text-brand-body">{error}</p>}
      {notice && <p className="border border-brand-border bg-brand-card p-3 text-xs text-brand-body">{notice}</p>}

      {rows.length === 0 ? (
        <p className="border border-brand-border bg-brand-card p-10 text-center text-xs text-brand-textMuted">
          {loading ? 'Loading…' : query ? 'No customers match.' : 'No customers yet. They appear here when someone orders, or add one yourself.'}
        </p>
      ) : (
        <>
        {/* Phones: one card per customer instead of a table wider than the screen. */}
        <ul className="space-y-2 md:hidden">
          {rows.map((row) => {
            const s = statFor(row);
            return (
              <li key={row.id} className="border border-brand-border bg-brand-card p-3">
                <button onClick={() => setDetailId(row.id)} className="block w-full min-w-0 text-left">
                  <p className="truncate font-semibold text-brand-heading">{row.full_name || '—'}</p>
                  {row.institution && <p className="truncate text-[0.6875rem] text-brand-textMuted">{row.institution}</p>}
                  <p className="mt-1 truncate text-xs text-brand-body">{row.email}</p>
                  <p className="font-mono text-[0.6875rem] text-brand-textMuted">{row.phone || 'no phone'}</p>
                </button>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-brand-border/60 pt-2 text-[0.75rem] text-brand-textMuted">
                  <span><strong className="font-mono text-brand-heading">{s.orders}</strong> orders</span>
                  <span><strong className="font-mono text-brand-heading">{money(s.spent)}</strong> spent</span>
                  <span>Last: {s.lastOrderAt ? new Date(s.lastOrderAt).toLocaleDateString() : '—'}</span>
                  <span>Sign-in: {row.user_id ? 'Yes' : 'No'}</span>
                </div>
                {rowActions(row, 'mt-2 flex-wrap justify-start')}
              </li>
            );
          })}
        </ul>
        <div className="hidden overflow-x-auto border border-brand-border bg-brand-card md:block">
          <table className="w-full min-w-[64rem] text-left text-xs">
            <thead className="border-b border-brand-border">
              <tr>
                {['Customer', 'Contact', 'Orders', 'Spent', 'Last order', 'Sign-in', ''].map((h) => (
                  <th key={h} className="px-3 py-2.5 font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.12em] text-brand-textMuted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const s = statFor(row);
                return (
                  <tr key={row.id} className="border-b border-brand-border/60 align-middle last:border-b-0 hover:bg-brand-dark">
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-brand-heading">{row.full_name || '—'}</p>
                      {row.institution && <p className="text-[0.6875rem] text-brand-textMuted">{row.institution}</p>}
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="text-brand-body">{row.email}</p>
                      <p className="font-mono text-[0.6875rem] text-brand-textMuted">{row.phone || 'no phone'}</p>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-brand-body">{s.orders}</td>
                    <td className="px-3 py-2.5 font-mono text-brand-heading">{money(s.spent)}</td>
                    <td className="px-3 py-2.5 font-mono text-[0.75rem] text-brand-textMuted">
                      {s.lastOrderAt ? new Date(s.lastOrderAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      {row.user_id
                        ? <span className="chip bg-brand-accent text-brand-onAccent"><UserCheck className="h-3 w-3" /> Yes</span>
                        : <span className="chip border border-brand-borderLight text-brand-textMuted">No</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {rowActions(row)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

      {editor !== undefined && (
        <RecordEditor
          title="Customer"
          fields={meta.createFields}
          initial={editor}
          editable={meta.editable}
          busy={saveBusy}
          error={saveError}
          fieldErrors={fieldErrors}
          upload={upload}
          onCancel={() => setEditor(undefined)}
          onSubmit={save}
        />
      )}

      {login && (
        <LoginModal
          customer={login}
          authedFetch={authedFetch}
          onQr={(target) => setQr(target)}
          onClose={() => setLogin(null)}
          onChanged={(hasLogin) => {
            setRows((prev) => prev.map((r) => (r.id === login.id ? { ...r, user_id: hasLogin ? r.user_id ?? 'linked' : null } : r)));
          }}
        />
      )}

      {qr && <QrCodeModal target={qr} onClose={() => setQr(null)} />}
      {detailId && <CustomerDetailModal customerId={detailId} authedFetch={authedFetch} isAgent={isAgent} onClose={() => setDetailId(null)} onChanged={() => void load(query)} />}
    </div>
  );
}

function LoginModal({ customer, authedFetch, onClose, onChanged, onQr }: {
  customer: Record<string, any>;
  authedFetch: Fetcher;
  onClose: () => void;
  onChanged: (hasLogin: boolean) => void;
  onQr: (target: QrTarget) => void;
}) {
  const [password, setPassword] = useState(randomPassword);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const hasLogin = Boolean(customer.user_id);
  const signInUrl = typeof window !== 'undefined' ? `${window.location.origin}/my-account` : '/my-account';

  const details = `Your ${BUSINESS.name} account\nSign in: ${signInUrl}\nEmail: ${customer.email}\nPassword: ${password}\nYou can change the password after signing in.`;

  const submit = async () => {
    setBusy(true); setError('');
    try {
      const res = await authedFetch('/api/admin/customers/account', {
        method: 'POST', body: JSON.stringify({ customerId: customer.id, password }),
      });
      const p = await res.json().catch(() => null);
      if (!res.ok) throw new Error(p?.message ?? 'Could not save the sign-in.');
      setDone(true);
      onChanged(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the sign-in.');
    } finally { setBusy(false); }
  };

  const revoke = async () => {
    if (!window.confirm('Remove this customer’s sign-in? They keep their orders but can no longer open My account.')) return;
    setBusy(true); setError('');
    try {
      const res = await authedFetch(`/api/admin/customers/account?customerId=${encodeURIComponent(customer.id)}`, { method: 'DELETE' });
      const p = await res.json().catch(() => null);
      if (!res.ok) throw new Error(p?.message ?? 'Could not remove the sign-in.');
      onChanged(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the sign-in.');
    } finally { setBusy(false); }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(details); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  const digits = cleanWhatsAppNumber(customer.phone);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Customer sign-in">
      <div className="w-full max-w-md border border-brand-border bg-brand-card">
        <div className="flex items-center justify-between border-b border-brand-border px-4 py-3">
          <div>
            <p className="font-display text-xs font-extrabold uppercase tracking-[0.08em] text-brand-heading">
              {hasLogin ? 'Reset sign-in' : 'Give a sign-in'}
            </p>
            <p className="text-[0.75rem] text-brand-textMuted">{customer.full_name || customer.email}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 text-brand-textMuted hover:text-brand-heading"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-4 p-4 text-xs text-brand-body">
          {!done ? (
            <>
              <p className="leading-relaxed">
                {hasLogin
                  ? 'Set a new password. Their old one stops working straight away.'
                  : 'This lets them sign in to My account on the shop and see their orders. It does not open the dashboard.'}
              </p>
              <label className="block">
                <span className="field-label">Email (their username)</span>
                <input className="field-input" value={customer.email} readOnly />
              </label>
              <label className="block">
                <span className="field-label">Password — at least 12 characters</span>
                <div className="flex gap-2">
                  <input className="field-input font-mono" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
                  <button className="btn-secondary" type="button" onClick={() => setPassword(randomPassword())}>New</button>
                </div>
              </label>
            </>
          ) : (
            <>
              <p className="leading-relaxed">Saved. Send these details to the customer:</p>
              <pre className="whitespace-pre-wrap border border-brand-border bg-brand-dark p-3 font-mono text-[0.75rem] text-brand-heading">{details}</pre>
              <div className="flex flex-wrap gap-2">
                <button className="btn-secondary" onClick={() => void copy()}><Copy className="h-3.5 w-3.5" /> {copied ? 'Copied' : 'Copy'}</button>
                {isValidWhatsAppNumber(digits) && (
                  <a className="btn-whatsapp px-3 py-2" target="_blank" rel="noopener noreferrer"
                    href={`https://wa.me/${digits}?text=${encodeURIComponent(details)}`}>
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </a>
                )}
                <a className="btn-secondary" href={`mailto:${encodeURIComponent(customer.email)}?subject=${encodeURIComponent(`Your ${BUSINESS.name} account`)}&body=${encodeURIComponent(details)}`}>
                  <Mail className="h-3.5 w-3.5" /> Email
                </a>
                <button className="btn-secondary" onClick={() => onQr({ title: 'Sign in to My account', subtitle: customer.email, url: signInUrl, filename: 'qr-my-account' })}>
                  <QrCode className="h-3.5 w-3.5" /> QR
                </button>
              </div>
            </>
          )}
          {error && <p className="border border-action/50 p-2">{error}</p>}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-brand-border px-4 py-3">
          {hasLogin && !done ? (
            <button className="text-[0.75rem] text-action underline" onClick={() => void revoke()} disabled={busy}>Remove sign-in</button>
          ) : <span />}
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={onClose}>{done ? 'Done' : 'Cancel'}</button>
            {!done && (
              <button className="btn-primary px-4 py-2" disabled={busy || password.length < 12} onClick={() => void submit()}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Save
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
