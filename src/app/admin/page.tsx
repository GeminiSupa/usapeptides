'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  LayoutDashboard, ShoppingBag, PackageCheck, Users, MessageSquare, ShoppingCart,
  Star, Boxes, Mail, Target, Building2, Tag, Handshake, Receipt, Megaphone,
  Bell, UserCog, History, LogOut, RefreshCw, Trash2, Search,
} from 'lucide-react';

/** Sidebar definition. `resource` maps to /api/admin/<resource>. */
const SECTIONS = [
  { id: 'home',          label: 'Dashboard',     icon: LayoutDashboard, resource: null },
  { id: 'orders',        label: 'Orders',        icon: ShoppingBag,     resource: 'orders' },
  { id: 'fulfillment',   label: 'Fulfillment',   icon: PackageCheck,    resource: 'fulfillment' },
  { id: 'customers',     label: 'Customers',     icon: Users,           resource: 'customers' },
  { id: 'inquiries',     label: 'Enquiries',     icon: MessageSquare,   resource: 'inquiries' },
  { id: 'carts',         label: 'Abandoned carts', icon: ShoppingCart,  resource: 'carts' },
  { id: 'reviews',       label: 'Reviews',       icon: Star,            resource: 'reviews' },
  { id: 'products',      label: 'Products',      icon: Boxes,           resource: 'products' },
  { id: 'subscribers',   label: 'Subscribers',   icon: Mail,            resource: 'subscribers' },
  { id: 'leads',         label: 'Leads',         icon: Target,          resource: 'leads' },
  { id: 'prospects',     label: 'Prospects',     icon: Building2,       resource: 'prospects' },
  { id: 'deals',         label: 'Deals',         icon: Tag,             resource: 'deals' },
  { id: 'affiliates',    label: 'Affiliates',    icon: Handshake,       resource: 'affiliates' },
  { id: 'commissions',   label: 'Commissions',   icon: Receipt,         resource: 'commissions' },
  { id: 'campaigns',     label: 'Campaigns',     icon: Megaphone,       resource: 'campaigns' },
  { id: 'notifications', label: 'Notifications', icon: Bell,            resource: 'notifications' },
  { id: 'team',          label: 'Team',          icon: UserCog,         resource: 'team' },
  { id: 'activity',      label: 'Activity log',  icon: History,         resource: 'activity' },
] as const;

/** Dropdown options for the status-style columns. */
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
  editable: string[];
  deletable: boolean;
}

const money = (n: unknown) => `$${Number(n ?? 0).toFixed(2)}`;

const prettify = (key: string) =>
  key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

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

  const active = SECTIONS.find((s) => s.id === section)!;

  /* ----------------------------------------------------------- session --- */
  useEffect(() => {
    if (!supabase) {
      setChecking(false);
      setDenied('Supabase is not configured for this deployment.');
      return;
    }
    supabase.auth.getSession().then(({ data: sessionData }) => {
      const access = sessionData.session?.access_token ?? null;
      if (!access) {
        router.replace('/admin/login');
        return;
      }
      setToken(access);
      setChecking(false);
    });
  }, [router]);

  const authedFetch = useCallback(
    async (path: string, init?: RequestInit) => {
      const res = await fetch(path, {
        ...init,
        headers: {
          ...(init?.headers ?? {}),
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.status === 401 || res.status === 403) {
        const payload = await res.json().catch(() => null);
        setDenied(payload?.message ?? 'Access denied.');
        throw new Error('denied');
      }
      return res;
    },
    [token]
  );

  /* -------------------------------------------------------------- load --- */
  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');

    try {
      if (active.resource === null) {
        const res = await authedFetch('/api/admin/summary');
        const payload = await res.json();
        if (!res.ok) throw new Error(payload?.message ?? 'Could not load the dashboard.');
        setSummary(payload.data);
      } else {
        const params = new URLSearchParams({ limit: '100' });
        if (query.trim()) params.set('q', query.trim());
        const res = await authedFetch(`/api/admin/${active.resource}?${params}`);
        const payload = await res.json();
        if (!res.ok) throw new Error(payload?.message ?? 'Could not load that section.');
        setData(payload.data);
      }
    } catch (err) {
      if ((err as Error).message !== 'denied') {
        setError((err as Error).message);
      }
    } finally {
      setLoading(false);
    }
  }, [token, active, query, authedFetch]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, section]);

  /* ------------------------------------------------------------ mutate --- */
  const patch = async (id: string, changes: Record<string, unknown>) => {
    if (!active.resource) return;
    try {
      const res = await authedFetch(`/api/admin/${active.resource}`, {
        method: 'PATCH',
        body: JSON.stringify({ id, changes }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        setError(payload?.message ?? 'Update failed.');
        return;
      }
      void load();
    } catch {
      /* denied already surfaced */
    }
  };

  const remove = async (id: string) => {
    if (!active.resource) return;
    if (!window.confirm('Delete this row? This cannot be undone.')) return;
    try {
      const res = await authedFetch(`/api/admin/${active.resource}?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        setError(payload?.message ?? 'Delete failed.');
        return;
      }
      void load();
    } catch {
      /* denied already surfaced */
    }
  };

  const signOut = async () => {
    await supabase?.auth.signOut();
    router.replace('/admin/login');
  };

  /* ------------------------------------------------------------- gates --- */
  if (checking) {
    return <div className="shell py-24 text-center text-xs text-brand-textMuted">Checking access...</div>;
  }

  if (denied) {
    return (
      <div className="shell max-w-md py-24 text-center">
        <h1 className="page-title">Access denied</h1>
        <p className="mt-3 text-xs leading-relaxed text-brand-textMuted">{denied}</p>
        <button onClick={signOut} className="btn-ghost mt-6">Sign out</button>
      </div>
    );
  }

  /* -------------------------------------------------------------- cell --- */
  const renderCell = (row: Record<string, any>, key: string, editable: string[]) => {
    const value = row[key];
    const canEdit = editable.includes(key);

    if (canEdit && typeof value === 'boolean') {
      return (
        <button
          onClick={() => patch(row.id, { [key]: !value })}
          className={`px-2 py-0.5 font-display text-[0.625rem] font-black uppercase tracking-[0.1em] transition-colors ${
            value ? 'bg-brand-accent text-white' : 'border border-brand-borderLight text-brand-textMuted'
          }`}
        >
          {value ? 'Yes' : 'No'}
        </button>
      );
    }

    const options = STATUS_OPTIONS[`${key}_${section}`];
    if (canEdit && options) {
      return (
        <select
          value={String(value ?? '')}
          onChange={(e) => patch(row.id, { [key]: e.target.value })}
          className="border border-brand-border bg-brand-dark px-2 py-1 text-[0.6875rem] text-brand-heading focus:border-brand-accent focus:outline-none"
        >
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }

    if (canEdit && (typeof value === 'string' || value === null) && !options) {
      return (
        <button
          onClick={() => {
            const next = window.prompt(prettify(key), value == null ? '' : String(value));
            if (next !== null) patch(row.id, { [key]: next || null });
          }}
          className="max-w-[16rem] truncate text-left text-brand-body underline decoration-brand-border underline-offset-2 hover:text-brand-accentGlow"
        >
          {value == null || value === '' ? <span className="text-brand-textMuted">set</span> : String(value)}
        </button>
      );
    }

    if (canEdit && typeof value === 'number') {
      return (
        <button
          onClick={() => {
            const next = window.prompt(prettify(key), String(value));
            if (next !== null && next.trim() !== '' && !Number.isNaN(Number(next))) {
              patch(row.id, { [key]: Number(next) });
            }
          }}
          className="text-brand-body underline decoration-brand-border underline-offset-2 hover:text-brand-accentGlow"
        >
          {key.includes('total') || key.includes('price') || key === 'amount' ? money(value) : value}
        </button>
      );
    }

    if (value === null || value === undefined) return <span className="text-brand-textMuted">—</span>;
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return <span className="text-brand-textMuted">{Array.isArray(value) ? `${value.length} items` : 'data'}</span>;

    if (key.endsWith('_at') || key === 'created_at') {
      return <span className="font-mono text-[0.6875rem]">{new Date(value).toLocaleDateString()}</span>;
    }
    if (key.includes('total') || key.includes('price') || key === 'amount') return money(value);
    if (key === 'id') return <span className="font-mono text-[0.625rem] text-brand-textMuted">{String(value).slice(0, 8)}</span>;

    return <span className="max-w-[18rem] truncate">{String(value)}</span>;
  };

  /* -------------------------------------------------------------- view --- */
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="border-b border-brand-border bg-brand-card lg:w-60 lg:flex-shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between border-b border-brand-border px-4 py-4">
          <span className="font-display text-xs font-extrabold uppercase tracking-[0.12em] text-brand-heading">
            Dashboard
          </span>
          <button onClick={signOut} title="Sign out" className="text-brand-textMuted hover:text-brand-accentGlow">
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex overflow-x-auto lg:block lg:overflow-visible">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const on = s.id === section;
            return (
              <button
                key={s.id}
                onClick={() => { setSection(s.id); setQuery(''); setError(''); }}
                className={`flex flex-shrink-0 items-center gap-2.5 px-4 py-3 text-left font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.1em] transition-colors lg:w-full ${
                  on ? 'bg-brand-accent text-white' : 'text-brand-body hover:text-brand-accentGlow'
                }`}
              >
                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{s.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main */}
      <main className="min-w-0 flex-1 p-5 lg:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="page-title">{active.label}</h1>
          <div className="flex items-center gap-2">
            {active.resource && (
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-textMuted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && load()}
                  placeholder="Search..."
                  className="border border-brand-border bg-brand-card py-2 pl-8 pr-3 text-xs text-brand-heading placeholder-brand-textMuted focus:border-brand-accent focus:outline-none"
                />
              </div>
            )}
            <button onClick={() => load()} className="border border-brand-borderLight p-2 text-brand-body hover:border-brand-accent hover:text-brand-accentGlow" title="Refresh">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-5 border border-brand-accent/50 bg-brand-card p-4 text-xs text-brand-body">{error}</div>
        )}

        {/* Dashboard home */}
        {active.resource === null ? (
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
                <h2 className="mb-3 font-display text-[0.9375rem] font-extrabold uppercase tracking-[0.08em] text-brand-heading">
                  Latest orders
                </h2>
                {summary.recentOrders.length === 0 ? (
                  <p className="border border-brand-border bg-brand-card p-8 text-center text-xs text-brand-textMuted">
                    No orders yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto border border-brand-border">
                    <table className="w-full min-w-[36rem] text-left text-xs">
                      <thead className="border-b border-brand-border bg-brand-card">
                        <tr>{['Order', 'Email', 'Status', 'Total', 'Placed'].map((h) => (
                          <th key={h} className="px-4 py-2.5 font-display text-[0.625rem] font-extrabold uppercase tracking-[0.12em] text-brand-textMuted">{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {summary.recentOrders.map((o: any) => (
                          <tr key={o.order_number} className="border-b border-brand-border/60 last:border-b-0">
                            <td className="px-4 py-2.5 font-mono text-[0.6875rem] text-brand-heading">{o.order_number}</td>
                            <td className="px-4 py-2.5 text-brand-body">{o.email}</td>
                            <td className="px-4 py-2.5"><span className="bg-brand-accent px-2 py-0.5 font-display text-[0.625rem] font-black uppercase text-white">{o.status}</span></td>
                            <td className="px-4 py-2.5 font-mono text-brand-body">{money(o.grand_total)}</td>
                            <td className="px-4 py-2.5 font-mono text-[0.6875rem] text-brand-textMuted">{new Date(o.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-brand-textMuted">{loading ? 'Loading...' : 'No data.'}</p>
          )
        ) : /* Resource tables */ data && data.rows.length > 0 ? (
          <>
            <p className="mb-3 text-[0.6875rem] uppercase tracking-[0.12em] text-brand-textMuted">
              {data.rows.length} of {data.total}
            </p>
            <div className="overflow-x-auto border border-brand-border">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-brand-border bg-brand-card">
                  <tr>
                    {Object.keys(data.rows[0]).map((k) => (
                      <th key={k} className="whitespace-nowrap px-3 py-2.5 font-display text-[0.625rem] font-extrabold uppercase tracking-[0.12em] text-brand-textMuted">
                        {prettify(k)}
                      </th>
                    ))}
                    {data.deletable && <th className="px-3 py-2.5" />}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.id} className="border-b border-brand-border/60 last:border-b-0 hover:bg-brand-card">
                      {Object.keys(data.rows[0]).map((k) => (
                        <td key={k} className="whitespace-nowrap px-3 py-2.5 text-brand-body">
                          {renderCell(row, k, data.editable)}
                        </td>
                      ))}
                      {data.deletable && (
                        <td className="px-3 py-2.5 text-right">
                          <button onClick={() => remove(row.id)} className="text-brand-textMuted hover:text-brand-accentGlow" title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[0.625rem] leading-relaxed text-brand-textMuted">
              Underlined values are editable — click to change. Toggles and dropdowns save immediately.
            </p>
          </>
        ) : (
          <p className="border border-brand-border bg-brand-card p-10 text-center text-xs text-brand-textMuted">
            {loading ? 'Loading...' : 'Nothing here yet.'}
          </p>
        )}
      </main>
    </div>
  );
}
