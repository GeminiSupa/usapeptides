'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import RecordEditor, { type FieldDef } from '@/components/admin/RecordEditor';
import ProductsPanel from '@/components/admin/ProductsPanel';
import StorefrontPanel from '@/components/admin/StorefrontPanel';
import UsersPanel from '@/components/admin/UsersPanel';
import AuditPanel from '@/components/admin/AuditPanel';
import SubUserHome from '@/components/admin/SubUserHome';
import ProfileModal from '@/components/admin/ProfileModal';
import type { UploadKind } from '@/components/admin/UploadField';
import { MODULES, type ModuleDef } from '@/lib/permissions';
import {
  LayoutDashboard, ShoppingBag, PackageCheck, Users, MessageSquare, ShoppingCart,
  Star, Boxes, Mail, Target, Building2, Tag, Handshake, Receipt, Megaphone,
  Bell, UserCog, History, LogOut, RefreshCw, Trash2, Search, Plus, Inbox,
  Pencil, Monitor, ScrollText, GitBranch, Wallet, Link2,
} from 'lucide-react';

/**
 * The dashboard shell.
 *
 * The sidebar is built from the module list in `@/lib/permissions` filtered by
 * what the server says this person may open, so there is no second copy of the
 * permission rules living in the UI. Hiding a section is a courtesy — every
 * route checks the same rules again, so typing a URL gets you nowhere.
 */

const ICONS: Record<string, typeof LayoutDashboard> = {
  home: LayoutDashboard,
  storefront: Monitor,
  orders: ShoppingBag,
  fulfillment: PackageCheck,
  products: Boxes,
  deals: Tag,
  customers: Users,
  inquiries: MessageSquare,
  reviews: Star,
  carts: ShoppingCart,
  leads: Target,
  prospects: Building2,
  affiliates: Handshake,
  commissions: Receipt,
  campaigns: Megaphone,
  subscribers: Mail,
  notifications: Bell,
  activity: History,
  my_team: GitBranch,
  users: UserCog,
  audit: ScrollText,
  my_earnings: Wallet,
  my_link: Link2,
};

/**
 * Modules that are a permission rather than a place.
 *
 * `affiliates` and `my_team` unlock tabs inside Users, and `my_link` is folded
 * into the sub-user's own screen. Listing them in the sidebar as well would
 * give two doors to one room.
 */
const NOT_A_SECTION = new Set(['affiliates', 'my_team', 'my_link']);

/** Sections with a purpose-built screen; everything else is the generic table. */
const CUSTOM = new Set(['home', 'storefront', 'products', 'users', 'audit', 'my_earnings']);

const STATUS_OPTIONS: Record<string, string[]> = {
  status_orders: ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
  status_inquiries: ['new', 'open', 'answered', 'closed'],
  status_leads: ['new', 'working', 'qualified', 'lost', 'converted'],
  status_commissions: ['pending', 'approved', 'paid', 'void'],
  status_campaigns: ['draft', 'scheduled', 'sending', 'sent', 'paused'],
  stage_fulfillment: ['queued', 'picking', 'packed', 'dispatched'],
  stage_prospects: ['identified', 'contacted', 'meeting', 'proposal', 'won', 'lost'],
};

interface RowsResponse {
  rows: Record<string, any>[];
  total: number;
  title: string;
  blurb: string;
  editable: string[];
  deletable: boolean;
  createFields: FieldDef[];
  columns: string[] | null;
}

interface Me {
  id: string;
  email: string;
  fullName: string | null;
  tier: 'staff' | 'sub_user';
  isOwner: boolean;
  permissions: string[];
  allowed: string[];
  defaultModule: string;
}

const money = (n: unknown) => `$${Number(n ?? 0).toFixed(2)}`;
const prettify = (k: string) => k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function AdminPage() {
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [denied, setDenied] = useState('');
  const [me, setMe] = useState<Me | null>(null);

  const [section, setSection] = useState<string>('home');
  const [summary, setSummary] = useState<any>(null);
  const [data, setData] = useState<RowsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  const [editorRow, setEditorRow] = useState<Record<string, any> | null | undefined>(undefined);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveFieldErrors, setSaveFieldErrors] = useState<Record<string, string>>({});

  const [profileOpen, setProfileOpen] = useState(false);

  const editorOpen = editorRow !== undefined;

  useEffect(() => {
    if (!supabase) {
      setChecking(false);
      setDenied('Supabase is not configured for this deployment.');
      return;
    }
    supabase.auth.getSession().then(({ data: s }) => {
      const access = s.session?.access_token ?? null;
      if (!access) { router.replace('/admin/login'); return; }
      setToken(access);
    });
  }, [router]);

  const authedFetch = useCallback(
    async (path: string, init?: RequestInit) => {
      const res = await fetch(path, {
        ...init,
        headers: { ...(init?.headers ?? {}), 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      if (res.status === 401 || res.status === 403) {
        const p = await res.json().catch(() => null);
        // A 403 on one section must not throw the person out of the whole
        // dashboard, so only an expired session or a missing account does.
        if (res.status === 401 || /does not have dashboard access|waiting for (an owner|a super admin)/i.test(p?.message ?? '')) {
          setDenied(p?.message ?? 'Access denied.');
        }
        throw new Error(p?.message ?? 'denied');
      }
      return res;
    },
    [token]
  );

  /** Who am I, and what may I open? Answered once, server-side. */
  useEffect(() => {
    if (!token) return;
    fetch('/api/admin/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        const p = await res.json().catch(() => null);
        if (!res.ok) { setDenied(p?.message ?? 'Access denied.'); return; }
        setMe(p.data);
        setSection(p.data.defaultModule);
      })
      .catch(() => setDenied('Could not reach the dashboard.'))
      .finally(() => setChecking(false));
  }, [token]);

  const upload = useCallback(
    async (file: File, kind: UploadKind): Promise<string> => {
      const body = new FormData();
      body.append('file', file);
      body.append('kind', kind);
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const p = await res.json().catch(() => null);
      if (!res.ok) throw new Error(p?.message ?? 'Upload failed.');
      return p.data.url as string;
    },
    [token]
  );

  /** The sidebar: the module list, in order, minus what this person cannot open. */
  const sections: ModuleDef[] = useMemo(() => {
    if (!me) return [];
    return MODULES.filter((m) => me.allowed.includes(m.id) && !NOT_A_SECTION.has(m.id));
  }, [me]);

  const active = sections.find((s) => s.id === section) ?? sections[0];
  const resource = active && !CUSTOM.has(active.id) ? active.id : null;

  const load = useCallback(async () => {
    if (!token || !active) return;
    setLoading(true); setError('');
    try {
      if (active.id === 'home') {
        const res = await authedFetch('/api/admin/summary');
        const p = await res.json();
        if (!res.ok) throw new Error(p?.message ?? 'Could not load the dashboard.');
        setSummary(p.data);
      } else if (resource) {
        const params = new URLSearchParams({ limit: '200' });
        if (query.trim()) params.set('q', query.trim());
        const res = await authedFetch(`/api/admin/${resource}?${params}`);
        const p = await res.json();
        if (!res.ok) throw new Error(p?.message ?? 'Could not load that section.');
        setData(p.data);
      }
    } catch (err) {
      const message = (err as Error).message;
      if (message !== 'denied') setError(message);
    } finally { setLoading(false); }
  }, [token, active, resource, query, authedFetch]);

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [token, section, me]);

  const patch = async (id: string, changes: Record<string, unknown>) => {
    if (!resource) return;
    try {
      const res = await authedFetch(`/api/admin/${resource}`, {
        method: 'PATCH', body: JSON.stringify({ id, changes }),
      });
      if (!res.ok) { const p = await res.json().catch(() => null); setError(p?.message ?? 'Update failed.'); return; }
      void load();
    } catch { /* surfaced */ }
  };

  const remove = async (id: string) => {
    if (!resource) return;
    if (!window.confirm('Delete this record? This cannot be undone.')) return;
    try {
      const res = await authedFetch(`/api/admin/${resource}?id=${id}`, { method: 'DELETE' });
      if (!res.ok) { const p = await res.json().catch(() => null); setError(p?.message ?? 'Delete failed.'); return; }
      void load();
    } catch { /* surfaced */ }
  };

  const openEditor = (row: Record<string, any> | null) => {
    setEditorRow(row); setSaveError(''); setSaveFieldErrors({});
  };

  const save = async (values: Record<string, unknown>) => {
    if (!resource) return;
    const editing = Boolean(editorRow);
    if (editing && Object.keys(values).length === 0) { setEditorRow(undefined); return; }

    setSaveBusy(true); setSaveError(''); setSaveFieldErrors({});
    try {
      const res = await authedFetch(`/api/admin/${resource}`, {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(editing ? { id: editorRow!.id, changes: values } : values),
      });
      const p = await res.json().catch(() => null);
      if (!res.ok) {
        setSaveError(p?.message ?? 'Could not save.');
        setSaveFieldErrors(p?.fields ?? {});
        return;
      }
      setEditorRow(undefined);
      void load();
    } catch { /* surfaced */ }
    finally { setSaveBusy(false); }
  };

  const signOut = async () => { await supabase?.auth.signOut(); router.replace('/admin/login'); };

  if (checking) return <div className="p-24 text-center text-xs text-brand-textMuted">Checking access...</div>;

  if (denied) {
    return (
      <div className="mx-auto max-w-md p-24 text-center">
        <h1 className="page-title">Access denied</h1>
        <p className="mt-3 text-xs leading-relaxed text-brand-textMuted">{denied}</p>
        <button onClick={signOut} className="btn-ghost mt-6">Sign out</button>
      </div>
    );
  }

  if (!me || !active) {
    return (
      <div className="mx-auto max-w-md p-24 text-center">
        <h1 className="page-title">Nothing to show</h1>
        <p className="mt-3 text-xs leading-relaxed text-brand-textMuted">
          Your account has no sections enabled yet. Ask a super admin to give you access.
        </p>
        <button onClick={signOut} className="btn-ghost mt-6">Sign out</button>
      </div>
    );
  }

  /* ------------------------------------------------------------- cells --- */
  const cell = (row: Record<string, any>, key: string, editable: string[]) => {
    const value = row[key];
    const canEdit = editable.includes(key);

    if (canEdit && typeof value === 'boolean') {
      return (
        <button onClick={() => patch(row.id, { [key]: !value })}
          className={`px-2 py-0.5 font-display text-[0.75rem] font-black uppercase tracking-[0.1em] transition-colors ${
            value ? 'bg-brand-accent text-white' : 'border border-brand-borderLight text-brand-textMuted'}`}>
          {value ? 'Yes' : 'No'}
        </button>
      );
    }

    const options = STATUS_OPTIONS[`${key}_${active.id}`];
    if (canEdit && options) {
      return (
        <select value={String(value ?? '')} onChange={(e) => patch(row.id, { [key]: e.target.value })}
          className="border border-brand-border bg-brand-dark px-2 py-1 text-[0.8125rem] text-brand-heading focus:border-brand-accent focus:outline-none">
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }

    if (value === null || value === undefined || value === '') return <span className="text-brand-textMuted">—</span>;
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return <span className="text-brand-textMuted">data</span>;
    if (key.endsWith('_at') || key.endsWith('_on')) {
      return <span className="font-mono text-[0.8125rem]">{new Date(value).toLocaleDateString()}</span>;
    }
    if (key.includes('total') || key.includes('price') || key === 'amount') return money(value);
    if (key === 'id' || key.endsWith('_id')) {
      return <span className="font-mono text-[0.75rem] text-brand-textMuted">{String(value).slice(0, 8)}</span>;
    }
    return <span className="block max-w-[18rem] truncate">{String(value)}</span>;
  };

  const visibleColumns = (d: RowsResponse) =>
    d.columns?.filter((c) => c in (d.rows[0] ?? {})) ?? Object.keys(d.rows[0] ?? {}).filter((k) => k !== 'id');

  const canCreate = Boolean(data && data.createFields.length > 0);

  /* -------------------------------------------------------------- view --- */
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="border-b border-brand-border bg-brand-card lg:w-56 lg:flex-shrink-0 lg:border-b-0 lg:border-r">
        <div className="border-b border-brand-border px-4 py-4">
          <div className="flex items-center justify-between">
            <span className="font-display text-xs font-extrabold uppercase tracking-[0.12em] text-brand-heading">
              Dashboard
            </span>
            <button onClick={signOut} title="Sign out" className="text-brand-textMuted hover:text-brand-accentGlow">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={() => setProfileOpen(true)}
            title={`${me.email} — edit my profile`}
            className="mt-1.5 block w-full truncate text-left text-[0.75rem] text-brand-textMuted hover:text-brand-accentGlow"
          >
            {me.fullName || me.email}
            {me.isOwner && <span className="ml-1 text-action">· super admin</span>}
            {me.tier === 'sub_user' && <span className="ml-1">· sub-user</span>}
            <span className="mt-0.5 block text-[0.6875rem] uppercase tracking-[0.12em] underline underline-offset-2">
              My profile
            </span>
          </button>
        </div>

        <nav className="flex overflow-x-auto lg:block lg:overflow-visible">
          {sections.map((s) => {
            const Icon = ICONS[s.id] ?? Inbox;
            const on = s.id === section;
            return (
              <button key={s.id} onClick={() => { setSection(s.id); setQuery(''); setError(''); }}
                className={`flex flex-shrink-0 items-center gap-2.5 px-4 py-2.5 text-left font-display text-[0.8125rem] font-extrabold uppercase tracking-[0.1em] transition-colors lg:w-full ${
                  on ? 'bg-brand-accent text-white' : 'text-brand-body hover:text-brand-accentGlow'}`}>
                <Icon className="h-3.5 w-3.5 flex-shrink-0" /><span>{s.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 p-5 lg:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="page-title">{active.label}</h1>
            {data && resource && (
              <p className="mt-1.5 max-w-2xl text-[0.8125rem] leading-relaxed text-brand-textMuted">{data.blurb}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {resource && (
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-textMuted" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()}
                  placeholder="Search..."
                  className="border border-brand-border bg-brand-card py-2 pl-8 pr-3 text-xs text-brand-heading placeholder-brand-textMuted focus:border-brand-accent focus:outline-none" />
              </div>
            )}
            {(resource || active.id === 'home') && (
              <button onClick={() => load()} title="Refresh"
                className="border border-brand-borderLight p-2 text-brand-body hover:border-brand-accent hover:text-brand-accentGlow">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            )}
            {canCreate && resource && active.id !== 'products' && (
              <button onClick={() => openEditor(null)}
                className="flex items-center gap-1.5 bg-brand-accent px-3 py-2 font-display text-[0.75rem] font-extrabold uppercase tracking-[0.1em] text-white transition-colors hover:bg-flag-red">
                <Plus className="h-3.5 w-3.5" /> New
              </button>
            )}
          </div>
        </div>

        {error && <div className="mb-5 border border-brand-accent/50 bg-brand-card p-4 text-xs leading-relaxed text-brand-body">{error}</div>}

        {/* -------------------------------------------------------- custom */}
        {active.id === 'users' ? (
          <UsersPanel authedFetch={authedFetch} isOwner={me.isOwner} />

        ) : active.id === 'audit' ? (
          <AuditPanel authedFetch={authedFetch} />

        ) : active.id === 'my_earnings' ? (
          <SubUserHome authedFetch={authedFetch} me={me} />

        ) : active.id === 'storefront' ? (
          <StorefrontPanel authedFetch={authedFetch} />

        ) : active.id === 'home' ? (
          summary ? (
            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-px border border-brand-border bg-brand-border md:grid-cols-3 xl:grid-cols-5">
                {/* The API sends only the figures this person may see. */}
                {([
                  ['Revenue (30d)', 'revenue30', true],
                  ['Orders (30d)', 'orders30'],
                  ['Awaiting payment', 'pendingOrders'],
                  ['Open enquiries', 'openInquiries'],
                  ['Reviews to approve', 'pendingReviews'],
                  ['Subscribers', 'subscribers'],
                  ['Live carts', 'activeCarts'],
                  ['Active products', 'products'],
                  ['Low stock (<5)', 'lowStock'],
                  ['Open leads', 'leadsOpen'],
                ] as [string, string, boolean?][])
                  .filter(([, key]) => summary.metrics[key] !== undefined)
                  .map(([label, key, isMoney]) => (
                    <div key={key} className="bg-brand-card p-4">
                      <div className="eyebrow">{label}</div>
                      <div className="mt-2 font-display text-xl font-black text-brand-heading">
                        {isMoney ? money(summary.metrics[key]) : summary.metrics[key]}
                      </div>
                    </div>
                  ))}
              </div>

              {Array.isArray(summary.recentOrders) && <div>
                <h2 className="mb-3 font-display text-[0.9375rem] font-extrabold uppercase tracking-[0.08em] text-brand-heading">Latest orders</h2>
                {summary.recentOrders.length === 0 ? (
                  <p className="border border-brand-border bg-brand-card p-8 text-center text-xs text-brand-textMuted">No orders yet.</p>
                ) : (
                  <div className="overflow-x-auto border border-brand-border">
                    <table className="w-full min-w-[36rem] text-left text-xs">
                      <thead className="border-b border-brand-border bg-brand-card"><tr>
                        {['Order', 'Email', 'Status', 'Total', 'Placed'].map((h) => (
                          <th key={h} className="px-4 py-2.5 font-display text-[0.75rem] font-extrabold uppercase tracking-[0.12em] text-brand-textMuted">{h}</th>))}
                      </tr></thead>
                      <tbody>
                        {summary.recentOrders.map((o: any) => (
                          <tr key={o.order_number} className="border-b border-brand-border/60 last:border-b-0">
                            <td className="px-4 py-2.5 font-mono text-[0.8125rem] text-brand-heading">{o.order_number}</td>
                            <td className="px-4 py-2.5 text-brand-body">{o.email}</td>
                            <td className="px-4 py-2.5"><span className="bg-brand-accent px-2 py-0.5 font-display text-[0.75rem] font-black uppercase text-white">{o.status}</span></td>
                            <td className="px-4 py-2.5 font-mono text-brand-body">{money(o.grand_total)}</td>
                            <td className="px-4 py-2.5 font-mono text-[0.8125rem] text-brand-textMuted">{new Date(o.created_at).toLocaleDateString()}</td>
                          </tr>))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>}
            </div>
          ) : <p className="text-xs text-brand-textMuted">{loading ? 'Loading...' : 'No data.'}</p>

        ) : active.id === 'products' && data ? (
          data.rows.length > 0 ? (
            <ProductsPanel
              rows={data.rows}
              total={data.total}
              onEdit={(row) => openEditor(row)}
              onPatch={patch}
              onDelete={remove}
              onNew={() => openEditor(null)}
            />
          ) : (
            <div className="border border-brand-border bg-brand-card p-12 text-center">
              <Boxes className="mx-auto h-6 w-6 text-brand-textMuted" strokeWidth={1.5} />
              <p className="mt-4 font-display text-sm font-extrabold text-brand-heading">
                {loading ? 'Loading...' : 'No products yet'}
              </p>
              <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-brand-textMuted">{data.blurb}</p>
              <button onClick={() => openEditor(null)} className="btn-primary mt-5">
                <Plus className="h-3.5 w-3.5" /> Add the first product
              </button>
            </div>
          )

        /* --------------------------------------------------- generic table */
        ) : data && data.rows.length > 0 ? (
          <>
            <p className="mb-3 text-[0.8125rem] uppercase tracking-[0.12em] text-brand-textMuted">
              {data.rows.length} of {data.total}
            </p>
            <div className="overflow-x-auto border border-brand-border">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-brand-border bg-brand-card"><tr>
                  {visibleColumns(data).map((k) => (
                    <th key={k} className="whitespace-nowrap px-3 py-2.5 font-display text-[0.75rem] font-extrabold uppercase tracking-[0.12em] text-brand-textMuted">{prettify(k)}</th>))}
                  <th className="px-3 py-2.5" />
                </tr></thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.id} className="border-b border-brand-border/60 last:border-b-0 hover:bg-brand-card">
                      {visibleColumns(data).map((k) => (
                        <td key={k} className="whitespace-nowrap px-3 py-2.5 text-brand-body">{cell(row, k, data.editable)}</td>))}
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {data.editable.length > 0 && (
                            <button onClick={() => openEditor(row)} title="Edit"
                              className="inline-flex items-center gap-1 border border-brand-borderLight px-2 py-1 font-display text-[0.6875rem] font-black uppercase tracking-[0.1em] text-brand-body transition-colors hover:border-brand-accent hover:text-brand-accentGlow">
                              <Pencil className="h-2.5 w-2.5" /> Edit
                            </button>
                          )}
                          {data.deletable && (
                            <button onClick={() => remove(row.id)} title="Delete" className="p-1 text-brand-textMuted hover:text-brand-accentGlow">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[0.75rem] leading-relaxed text-brand-textMuted">
              Toggles and dropdowns save immediately. Edit opens the full record.
            </p>
          </>

        ) : (
          <div className="border border-brand-border bg-brand-card p-12 text-center">
            <Inbox className="mx-auto h-6 w-6 text-brand-textMuted" strokeWidth={1.5} />
            <p className="mt-4 font-display text-sm font-extrabold text-brand-heading">
              {loading ? 'Loading...' : `No ${(data?.title ?? active.label).toLowerCase()} yet`}
            </p>
            {!loading && data && (
              <>
                <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-brand-textMuted">{data.blurb}</p>
                {canCreate ? (
                  <button onClick={() => openEditor(null)} className="btn-primary mt-6">
                    <Plus className="h-3.5 w-3.5" /> Add the first one
                  </button>
                ) : (
                  <p className="mt-4 text-[0.75rem] text-brand-textMuted">
                    These records are created automatically — there is nothing to add by hand.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </main>

      {profileOpen && (
        <ProfileModal
          authedFetch={authedFetch}
          upload={upload}
          onCancel={() => setProfileOpen(false)}
          onSaved={(p) => setMe((prev) => (prev ? { ...prev, fullName: p.full_name } : prev))}
        />
      )}

      {editorOpen && data && (
        <RecordEditor
          title={data.title.replace(/s$/, '')}
          fields={data.createFields}
          initial={editorRow}
          editable={data.editable}
          busy={saveBusy}
          error={saveError}
          fieldErrors={saveFieldErrors}
          upload={upload}
          onCancel={() => setEditorRow(undefined)}
          onSubmit={save}
        />
      )}
    </div>
  );
}
