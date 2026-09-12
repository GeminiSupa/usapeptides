'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import RecordEditor, { type FieldDef } from '@/components/admin/RecordEditor';
import ProductsPanel from '@/components/admin/ProductsPanel';
import TeamPanel from '@/components/admin/TeamPanel';
import StorefrontPanel from '@/components/admin/StorefrontPanel';
import {
  LayoutDashboard, ShoppingBag, PackageCheck, Users, MessageSquare, ShoppingCart,
  Star, Boxes, Mail, Target, Building2, Tag, Handshake, Receipt, Megaphone,
  Bell, UserCog, History, LogOut, RefreshCw, Trash2, Search, Plus, Inbox,
  Pencil, Monitor,
} from 'lucide-react';

const SECTIONS = [
  { id: 'home',          label: 'Dashboard',       icon: LayoutDashboard, resource: null },
  { id: 'storefront',    label: 'Storefront',      icon: Monitor,         resource: null },
  { id: 'orders',        label: 'Orders',          icon: ShoppingBag,     resource: 'orders' },
  { id: 'fulfillment',   label: 'Fulfillment',     icon: PackageCheck,    resource: 'fulfillment' },
  { id: 'products',      label: 'Products',        icon: Boxes,           resource: 'products' },
  { id: 'customers',     label: 'Customers',       icon: Users,           resource: 'customers' },
  { id: 'inquiries',     label: 'Enquiries',       icon: MessageSquare,   resource: 'inquiries' },
  { id: 'carts',         label: 'Abandoned carts', icon: ShoppingCart,    resource: 'carts' },
  { id: 'reviews',       label: 'Reviews',         icon: Star,            resource: 'reviews' },
  { id: 'subscribers',   label: 'Subscribers',     icon: Mail,            resource: 'subscribers' },
  { id: 'leads',         label: 'Leads',           icon: Target,          resource: 'leads' },
  { id: 'prospects',     label: 'Prospects',       icon: Building2,       resource: 'prospects' },
  { id: 'deals',         label: 'Deals',           icon: Tag,             resource: 'deals' },
  { id: 'affiliates',    label: 'Affiliates',      icon: Handshake,       resource: 'affiliates' },
  { id: 'commissions',   label: 'Commissions',     icon: Receipt,         resource: 'commissions' },
  { id: 'campaigns',     label: 'Campaigns',       icon: Megaphone,       resource: 'campaigns' },
  { id: 'notifications', label: 'Notifications',   icon: Bell,            resource: 'notifications' },
  { id: 'team',          label: 'Team',            icon: UserCog,         resource: 'team' },
  { id: 'activity',      label: 'Activity log',    icon: History,         resource: 'activity' },
] as const;

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

const money = (n: unknown) => `$${Number(n ?? 0).toFixed(2)}`;
const prettify = (k: string) => k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function AdminPage() {
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [denied, setDenied] = useState('');

  const [section, setSection] = useState<string>('home');
  const [summary, setSummary] = useState<any>(null);
  const [data, setData] = useState<RowsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  /** undefined = closed, null = adding, a row = editing that row. */
  const [editorRow, setEditorRow] = useState<Record<string, any> | null | undefined>(undefined);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveFieldErrors, setSaveFieldErrors] = useState<Record<string, string>>({});

  const active = SECTIONS.find((s) => s.id === section)!;
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
      setChecking(false);
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
        setDenied(p?.message ?? 'Access denied.');
        throw new Error('denied');
      }
      return res;
    },
    [token]
  );

  /**
   * Files go up separately from the record, as multipart. Content-Type is left
   * unset on purpose so the browser can add its own boundary - setting it by
   * hand here is what makes a multipart upload arrive unparseable.
   */
  const upload = useCallback(
    async (file: File, kind: 'image' | 'coa'): Promise<string> => {
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

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError('');
    try {
      if (section === 'home') {
        const res = await authedFetch('/api/admin/summary');
        const p = await res.json();
        if (!res.ok) throw new Error(p?.message ?? 'Could not load the dashboard.');
        setSummary(p.data);
      } else if (active.resource) {
        const params = new URLSearchParams({ limit: '200' });
        if (query.trim()) params.set('q', query.trim());
        const res = await authedFetch(`/api/admin/${active.resource}?${params}`);
        const p = await res.json();
        if (!res.ok) throw new Error(p?.message ?? 'Could not load that section.');
        setData(p.data);
      }
    } catch (err) {
      if ((err as Error).message !== 'denied') setError((err as Error).message);
    } finally { setLoading(false); }
  }, [token, active, section, query, authedFetch]);

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [token, section]);

  const patch = async (id: string, changes: Record<string, unknown>) => {
    if (!active.resource) return;
    try {
      const res = await authedFetch(`/api/admin/${active.resource}`, {
        method: 'PATCH', body: JSON.stringify({ id, changes }),
      });
      if (!res.ok) { const p = await res.json().catch(() => null); setError(p?.message ?? 'Update failed.'); return; }
      void load();
    } catch { /* denied surfaced */ }
  };

  const remove = async (id: string) => {
    if (!active.resource) return;
    if (!window.confirm('Delete this record? This cannot be undone.')) return;
    try {
      const res = await authedFetch(`/api/admin/${active.resource}?id=${id}`, { method: 'DELETE' });
      if (!res.ok) { const p = await res.json().catch(() => null); setError(p?.message ?? 'Delete failed.'); return; }
      void load();
    } catch { /* denied surfaced */ }
  };

  const openEditor = (row: Record<string, any> | null) => {
    setEditorRow(row);
    setSaveError('');
    setSaveFieldErrors({});
  };

  const save = async (values: Record<string, unknown>) => {
    if (!active.resource) return;

    const editing = Boolean(editorRow);
    if (editing && Object.keys(values).length === 0) { setEditorRow(undefined); return; }

    setSaveBusy(true); setSaveError(''); setSaveFieldErrors({});
    try {
      const res = await authedFetch(`/api/admin/${active.resource}`, {
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
    } catch { /* denied surfaced */ }
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

  /* ------------------------------------------------------------- cells --- */
  const cell = (row: Record<string, any>, key: string, editable: string[]) => {
    const value = row[key];
    const canEdit = editable.includes(key);

    if (canEdit && typeof value === 'boolean') {
      return (
        <button onClick={() => patch(row.id, { [key]: !value })}
          className={`px-2 py-0.5 font-display text-[0.625rem] font-black uppercase tracking-[0.1em] transition-colors ${
            value ? 'bg-brand-accent text-white' : 'border border-brand-borderLight text-brand-textMuted'}`}>
          {value ? 'Yes' : 'No'}
        </button>
      );
    }

    const options = STATUS_OPTIONS[`${key}_${section}`];
    if (canEdit && options) {
      return (
        <select value={String(value ?? '')} onChange={(e) => patch(row.id, { [key]: e.target.value })}
          className="border border-brand-border bg-brand-dark px-2 py-1 text-[0.6875rem] text-brand-heading focus:border-brand-accent focus:outline-none">
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }

    if (value === null || value === undefined || value === '') return <span className="text-brand-textMuted">—</span>;
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return <span className="text-brand-textMuted">data</span>;
    if (key.endsWith('_at') || key.endsWith('_on')) {
      return <span className="font-mono text-[0.6875rem]">{new Date(value).toLocaleDateString()}</span>;
    }
    if (key.includes('total') || key.includes('price') || key === 'amount') return money(value);
    if (key === 'id' || key.endsWith('_id')) {
      return <span className="font-mono text-[0.625rem] text-brand-textMuted">{String(value).slice(0, 8)}</span>;
    }
    return <span className="block max-w-[18rem] truncate">{String(value)}</span>;
  };

  const visibleColumns = (d: RowsResponse) =>
    d.columns?.filter((c) => c in (d.rows[0] ?? {})) ?? Object.keys(d.rows[0] ?? {}).filter((k) => k !== 'id');

  const canCreate = Boolean(data && data.createFields.length > 0);
  /* Products, team and storefront bring their own headers and add buttons. */
  const hasCustomPanel = section === 'products' || section === 'team' || section === 'storefront';

  /* -------------------------------------------------------------- view --- */
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="border-b border-brand-border bg-brand-card lg:w-56 lg:flex-shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between border-b border-brand-border px-4 py-4">
          <span className="font-display text-xs font-extrabold uppercase tracking-[0.12em] text-brand-heading">Dashboard</span>
          <button onClick={signOut} title="Sign out" className="text-brand-textMuted hover:text-brand-accentGlow">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        <nav className="flex overflow-x-auto lg:block lg:overflow-visible">
          {SECTIONS.map((s) => {
            const Icon = s.icon; const on = s.id === section;
            return (
              <button key={s.id} onClick={() => { setSection(s.id); setQuery(''); setError(''); }}
                className={`flex flex-shrink-0 items-center gap-2.5 px-4 py-2.5 text-left font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.1em] transition-colors lg:w-full ${
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
            {data && active.resource && (
              <p className="mt-1.5 max-w-2xl text-[0.6875rem] leading-relaxed text-brand-textMuted">{data.blurb}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {active.resource && (
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-textMuted" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()}
                  placeholder="Search..."
                  className="border border-brand-border bg-brand-card py-2 pl-8 pr-3 text-xs text-brand-heading placeholder-brand-textMuted focus:border-brand-accent focus:outline-none" />
              </div>
            )}
            {section !== 'storefront' && (
              <button onClick={() => load()} title="Refresh"
                className="border border-brand-borderLight p-2 text-brand-body hover:border-brand-accent hover:text-brand-accentGlow">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            )}
            {canCreate && !hasCustomPanel && (
              <button onClick={() => openEditor(null)}
                className="flex items-center gap-1.5 bg-brand-accent px-3 py-2 font-display text-[0.625rem] font-extrabold uppercase tracking-[0.1em] text-white transition-colors hover:bg-flag-red">
                <Plus className="h-3.5 w-3.5" /> New
              </button>
            )}
          </div>
        </div>

        {error && <div className="mb-5 border border-brand-accent/50 bg-brand-card p-4 text-xs text-brand-body">{error}</div>}

        {/* ----------------------------------------------------- storefront */}
        {section === 'storefront' ? (
          <StorefrontPanel authedFetch={authedFetch} />

        /* ---------------------------------------------------------- home */
        ) : section === 'home' ? (
          summary ? (
            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-px border border-brand-border bg-brand-border md:grid-cols-3 xl:grid-cols-5">
                {[
                  ['Revenue (30d)', money(summary.metrics.revenue30)],
                  ['Orders (30d)', summary.metrics.orders30],
                  ['Awaiting payment', summary.metrics.pendingOrders],
                  ['Open enquiries', summary.metrics.openInquiries],
                  ['Reviews to approve', summary.metrics.pendingReviews],
                  ['Subscribers', summary.metrics.subscribers],
                  ['Live carts', summary.metrics.activeCarts],
                  ['Active products', summary.metrics.products],
                  ['Low stock (<5)', summary.metrics.lowStock],
                  ['Open leads', summary.metrics.leadsOpen],
                ].map(([label, value]) => (
                  <div key={String(label)} className="bg-brand-card p-4">
                    <div className="eyebrow">{label}</div>
                    <div className="mt-2 font-display text-xl font-black text-brand-heading">{value}</div>
                  </div>
                ))}
              </div>

              <div>
                <h2 className="mb-3 font-display text-[0.9375rem] font-extrabold uppercase tracking-[0.08em] text-brand-heading">Latest orders</h2>
                {summary.recentOrders.length === 0 ? (
                  <p className="border border-brand-border bg-brand-card p-8 text-center text-xs text-brand-textMuted">No orders yet.</p>
                ) : (
                  <div className="overflow-x-auto border border-brand-border">
                    <table className="w-full min-w-[36rem] text-left text-xs">
                      <thead className="border-b border-brand-border bg-brand-card"><tr>
                        {['Order', 'Email', 'Status', 'Total', 'Placed'].map((h) => (
                          <th key={h} className="px-4 py-2.5 font-display text-[0.625rem] font-extrabold uppercase tracking-[0.12em] text-brand-textMuted">{h}</th>))}
                      </tr></thead>
                      <tbody>
                        {summary.recentOrders.map((o: any) => (
                          <tr key={o.order_number} className="border-b border-brand-border/60 last:border-b-0">
                            <td className="px-4 py-2.5 font-mono text-[0.6875rem] text-brand-heading">{o.order_number}</td>
                            <td className="px-4 py-2.5 text-brand-body">{o.email}</td>
                            <td className="px-4 py-2.5"><span className="bg-brand-accent px-2 py-0.5 font-display text-[0.625rem] font-black uppercase text-white">{o.status}</span></td>
                            <td className="px-4 py-2.5 font-mono text-brand-body">{money(o.grand_total)}</td>
                            <td className="px-4 py-2.5 font-mono text-[0.6875rem] text-brand-textMuted">{new Date(o.created_at).toLocaleDateString()}</td>
                          </tr>))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : <p className="text-xs text-brand-textMuted">{loading ? 'Loading...' : 'No data.'}</p>

        /* ------------------------------------------------------ products */
        ) : section === 'products' && data ? (
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

        /* ---------------------------------------------------------- team */
        ) : section === 'team' && data ? (
          <TeamPanel
            rows={data.rows}
            onEdit={(row) => openEditor(row)}
            onDelete={remove}
            onNew={() => openEditor(null)}
            authedFetch={authedFetch}
            onChanged={() => void load()}
          />

        /* --------------------------------------------------- generic table */
        ) : data && data.rows.length > 0 ? (
          <>
            <p className="mb-3 text-[0.6875rem] uppercase tracking-[0.12em] text-brand-textMuted">
              {data.rows.length} of {data.total}
            </p>
            <div className="overflow-x-auto border border-brand-border">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-brand-border bg-brand-card"><tr>
                  {visibleColumns(data).map((k) => (
                    <th key={k} className="whitespace-nowrap px-3 py-2.5 font-display text-[0.625rem] font-extrabold uppercase tracking-[0.12em] text-brand-textMuted">{prettify(k)}</th>))}
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
                              className="inline-flex items-center gap-1 border border-brand-borderLight px-2 py-1 font-display text-[0.5625rem] font-black uppercase tracking-[0.1em] text-brand-body transition-colors hover:border-brand-accent hover:text-brand-accentGlow">
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
            <p className="mt-3 text-[0.625rem] leading-relaxed text-brand-textMuted">
              Toggles and dropdowns save immediately. Edit opens the full record.
            </p>
          </>

        /* ------------------------------------------------------ empty state */
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
                  <p className="mt-4 text-[0.625rem] text-brand-textMuted">
                    These records are created automatically — there is nothing to add by hand.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </main>

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
