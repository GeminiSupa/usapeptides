'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import RecordEditor, { type FieldDef } from '@/components/admin/RecordEditor';
import ProductsPanel from '@/components/admin/ProductsPanel';
import StorefrontHub from '@/components/admin/StorefrontHub';
import UsersPanel from '@/components/admin/UsersPanel';
import AuditPanel from '@/components/admin/AuditPanel';
import SubUserHome from '@/components/admin/SubUserHome';
import ProfileModal from '@/components/admin/ProfileModal';
import ManualOrderModal from '@/components/admin/ManualOrderModal';
import CommissionsPanel from '@/components/admin/CommissionsPanel';
import AnalyticsPanel from '@/components/admin/AnalyticsPanel';
import SystemHealthPanel from '@/components/admin/SystemHealthPanel';
import OrderDetailModal from '@/components/admin/OrderDetailModal';
import CategoriesPanel from '@/components/admin/CategoriesPanel';
import CustomersPanel from '@/components/admin/CustomersPanel';
import ProspectorPanel from '@/components/admin/ProspectorPanel';
import CampaignsPanel from '@/components/admin/CampaignsPanel';
import NotificationBell from '@/components/admin/NotificationBell';
import DealsPanel from '@/components/admin/DealsPanel';
import DashboardHome from '@/components/admin/insights/DashboardHome';
import type { UploadKind } from '@/components/admin/UploadField';
import { MODULES, type ModuleDef } from '@/lib/permissions';
import {
  LayoutDashboard, ShoppingBag, PackageCheck, Users, MessageSquare, ShoppingCart,
  Star, Boxes, Mail, Target, Building2, Tag, Handshake, Receipt, Megaphone,
  Bell, UserCog, History, LogOut, RefreshCw, Trash2, Search, Plus, Inbox,
  Pencil, Monitor, ScrollText, MapPin, GitBranch, Wallet, Link2, ChevronDown, FileText, BarChart3, Menu, X,
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
  prospects: MapPin,
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
  articles: FileText,
  analytics: BarChart3,
  system: History,
  categories: Tag,
};

/**
 * Modules that are a permission rather than a place.
 *
 * `affiliates` and `my_team` unlock tabs inside Users, and `my_link` is folded
 * into the sub-user's own screen. Listing them in the sidebar as well would
 * give two doors to one room. `notifications` lives in the bell at the top.
 */
const NOT_A_SECTION = new Set(['affiliates', 'my_team', 'my_link', 'notifications']);

/**
 * Sections with a purpose-built screen that load their own data. Products is
 * not one: it has its own view but reads and writes through the generic
 * resource API, so it must keep a `resource`.
 */
const CUSTOM = new Set(['home', 'articles', 'analytics', 'storefront', 'users', 'audit', 'system', 'categories', 'deals', 'notifications', 'my_earnings', 'commissions', 'customers', 'prospects', 'campaigns']);

/** Resource screens that draw their own search and refresh controls. */
const SELF_TOOLBAR = new Set(['products']);

const STATUS_OPTIONS: Record<string, string[]> = {
  status_orders: ['pending', 'paid', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded'],
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
  editFields: FieldDef[];
  columns: string[] | null;
  /** Present on orders and leads: who owns each row, and what the viewer may do about it. */
  ownership: {
    column: string;
    you: string;
    canClaim: boolean;
    canAssign: boolean;
    people: { id: string; name: string }[];
  } | null;
}

/** Ownership bookkeeping; shown as the Agent column, never as raw ids. */
const OWNERSHIP_COLUMNS = new Set(['referred_by', 'agent_source', 'agent_claimed_at', 'owner_id']);

interface Me {
  id: string;
  email: string;
  fullName: string | null;
  tier: 'staff' | 'sub_user';
  role: 'staff' | 'sales_agent';
  referralCode: string | null;
  isOwner: boolean;
  permissions: string[];
  allowed: string[];
  defaultModule: string;
}

/** True at the `lg` breakpoint and up, where the sidebar is always shown. */
function useIsDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return desktop;
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
  const [data, setData] = useState<RowsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  const [editorRow, setEditorRow] = useState<Record<string, any> | null | undefined>(undefined);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveFieldErrors, setSaveFieldErrors] = useState<Record<string, string>>({});

  const [profileOpen, setProfileOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const isDesktop = useIsDesktop();
  const [manualOrderOpen, setManualOrderOpen] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [orderDetails, setOrderDetails] = useState<Record<string, any>>({});
  const [orderDetailError, setOrderDetailError] = useState('');

  const editorOpen = editorRow !== undefined;

  // The menu drawer: Escape closes it, and the page behind must not scroll.
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setNavOpen(false); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [navOpen]);
  useEffect(() => { if (isDesktop) setNavOpen(false); }, [isDesktop]);

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
    return MODULES.filter((m) => me.allowed.includes(m.id) && !NOT_A_SECTION.has(m.id))
      // The blog is a tab inside Storefront; list it on its own only for
      // somebody who can open the blog but not the rest of the storefront.
      .filter((m) => !(m.id === 'articles' && me.allowed.includes('storefront')));
  }, [me]);

  const active = sections.find((s) => s.id === section) ?? sections[0];
  const resource = active && !CUSTOM.has(active.id) ? active.id : null;

  const load = useCallback(async () => {
    if (!token || !active) return;
    setLoading(true); setError('');
    try {
      if (resource) {
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
    if (!resource) return false;
    try {
      const res = await authedFetch(`/api/admin/${resource}`, {
        method: 'PATCH', body: JSON.stringify({ id, changes }),
      });
      if (!res.ok) { const p = await res.json().catch(() => null); setError(p?.message ?? 'Update failed.'); return false; }
      void load();
      return true;
    } catch { return false; }
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

  /** Claim for yourself, or (super admin) assign to someone / clear with null. */
  const claim = async (id: string, agentId?: string | null) => {
    if (!resource) return false;
    setError('');
    try {
      const res = await authedFetch('/api/admin/claim', {
        method: 'POST',
        body: JSON.stringify({ resource, id, ...(agentId !== undefined ? { agent_id: agentId } : {}) }),
      });
      if (!res.ok) {
        const p = await res.json().catch(() => null);
        setError(p?.message ?? 'Could not claim that.');
        return false;
      }
      void load();
      return true;
    } catch { return false; }
  };

  const saveOrderDetail = async (id: string, changes: Record<string, unknown>, ownerId?: string | null) => {
    setError('');
    try {
      const res = await authedFetch(`/api/admin/orders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ changes, confirmed: true, ...(ownerId !== undefined ? { owner_id: ownerId } : {}) }),
      });
      const p = await res.json().catch(() => null);
      if (!res.ok) { setError(p?.message ?? 'Could not save the order.'); return false; }
      setOrderDetails((prev) => { const next = { ...prev }; delete next[id]; return next; });
      setExpandedOrderId(null);
      void load();
      return true;
    } catch {
      setError('Could not save the order.');
      return false;
    }
  };

  const toggleOrderDetails = async (row: Record<string, any>) => {
    if (expandedOrderId === row.id) {
      setExpandedOrderId(null);
      return;
    }

    setExpandedOrderId(row.id);
    setOrderDetailError('');
    if (orderDetails[row.id]) return;

    try {
      const res = await authedFetch(`/api/admin/orders/${row.id}`);
      const p = await res.json().catch(() => null);
      if (!res.ok) {
        setOrderDetailError(p?.message ?? 'Could not load order detail.');
        return;
      }
      setOrderDetails((prev) => ({ ...prev, [row.id]: p.data }));
    } catch {
      setOrderDetailError('Could not load order detail.');
    }
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
            value ? 'bg-brand-accent text-brand-onAccent' : 'border border-brand-borderLight text-brand-textMuted'}`}>
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
    (d.columns?.filter((c) => c in (d.rows[0] ?? {})) ?? Object.keys(d.rows[0] ?? {}).filter((k) => k !== 'id'))
      .filter((k) => !OWNERSHIP_COLUMNS.has(k));

  const ownerCell = (row: Record<string, any>, own: NonNullable<RowsResponse['ownership']>) => {
    const owner = (row[own.column] as string | null) ?? null;

    if (own.canAssign) {
      return owner
        ? <span>{own.people.find((p) => p.id === owner)?.name ?? 'Former agent'}</span>
        : <span className="text-brand-textMuted">Unassigned</span>;
    }
    if (!owner) {
      return own.canClaim && row.status !== 'completed' ? (
        <button onClick={() => claim(row.id)}
          className="bg-brand-accent px-2.5 py-1 font-display text-[0.6875rem] font-black uppercase tracking-[0.1em] text-brand-onAccent transition-colors hover:bg-brand-accentHover">
          Claim
        </button>
      ) : <span className="text-brand-textMuted">Unclaimed</span>;
    }
    if (owner === own.you) {
      return <span className="font-display text-[0.6875rem] font-black uppercase tracking-[0.1em] text-whatsapp">Yours</span>;
    }
    return <span>{own.people.find((p) => p.id === owner)?.name ?? 'Another agent'}</span>;
  };

  const canCreate = Boolean(data && data.createFields.length > 0);

  const orderDetail = (row: Record<string, any>) => {
    const detail = orderDetails[row.id];
    if (orderDetailError && expandedOrderId === row.id) {
      return <p className="border border-brand-accent/50 bg-brand-dark p-3 text-brand-body">{orderDetailError}</p>;
    }
    if (!detail) return <p className="text-brand-textMuted">Loading order detail...</p>;

    const items = Array.isArray(detail.items) ? detail.items : [];
    const order = detail.order ?? row;

    return (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="border border-brand-border bg-brand-dark">
          <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-brand-border px-3 py-2 font-display text-[0.6875rem] font-black uppercase tracking-[0.1em] text-brand-textMuted">
            <span>Item</span>
            <span>Qty</span>
            <span>Total</span>
          </div>
          {items.length === 0 ? (
            <p className="p-3 text-brand-textMuted">No line items found for this order.</p>
          ) : items.map((item: any) => (
            <div key={item.id} className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-brand-border/60 px-3 py-2 last:border-b-0">
              <div className="min-w-0">
                <p className="truncate font-semibold text-brand-heading">{item.product_name}</p>
                <p className="font-mono text-[0.6875rem] text-brand-textMuted">
                  {item.sku || item.product_slug} · {money(item.unit_price)} each
                </p>
              </div>
              <span className="font-mono text-brand-body">{item.quantity}</span>
              <span className="font-mono text-brand-heading">{money(item.line_total)}</span>
            </div>
          ))}
        </div>

        <div className="space-y-2 border border-brand-border bg-brand-dark p-3">
          {[
            ['Subtotal', order.subtotal],
            ['Discount', order.discount_total],
            ['Shipping', order.shipping_total],
            ['Grand total', order.grand_total],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3 text-[0.8125rem]">
              <span className="text-brand-textMuted">{label}</span>
              <span className="font-mono text-brand-heading">{money(value)}</span>
            </div>
          ))}
          {order.payment_provider && (
            <p className="border-t border-brand-border pt-2 text-[0.75rem] text-brand-textMuted">
              Payment method: <span className="text-brand-body">{order.payment_provider}</span>
            </p>
          )}
          {order.shipping_address && (
            <p className="border-t border-brand-border pt-2 text-[0.75rem] leading-relaxed text-brand-textMuted">
              Ship to: <span className="text-brand-body">{Object.values(order.shipping_address).filter(Boolean).join(', ')}</span>
            </p>
          )}
        </div>
      </div>
    );
  };

  const goTo = (next: string) => { setSection(next); setQuery(''); setError(''); setNavOpen(false); };

  /* -------------------------------------------------------------- view --- */
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Phone and tablet: one slim bar with a menu button. The full section
          list opens as a drawer instead of a sideways-scrolling strip that
          hid most sections off-screen. */}
      <div className="sticky top-0 z-40 flex items-center gap-2 border-b border-brand-border bg-brand-card px-3 py-2 lg:hidden">
        <button onClick={() => setNavOpen(true)} aria-label="Open menu" aria-expanded={navOpen}
          className="flex min-h-11 min-w-11 items-center justify-center border border-brand-borderLight text-brand-heading">
          <Menu className="h-5 w-5" />
        </button>
        <span className="min-w-0 flex-1 truncate font-display text-[0.8125rem] font-extrabold uppercase tracking-[0.1em] text-brand-heading">
          {active.label}
        </span>
        {!isDesktop && me.allowed.includes('notifications') && <NotificationBell authedFetch={authedFetch} onNavigate={(next) => { if (me.allowed.includes(next) && !NOT_A_SECTION.has(next)) goTo(next); }} />}
      </div>

      {navOpen && (
        <button aria-label="Close menu" onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-40 cursor-default bg-black/50 lg:hidden" />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-[min(18rem,85vw)] overflow-y-auto border-r border-brand-border bg-brand-card transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-56 lg:flex-shrink-0 lg:translate-x-0 lg:transition-none ${navOpen ? 'translate-x-0' : '-translate-x-full'} [scrollbar-color:theme(colors.brand.borderLight)_transparent] [scrollbar-width:thin]`}
        aria-label="Dashboard sections">
        <div className="border-b border-brand-border px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <span className="font-display text-xs font-extrabold uppercase tracking-[0.12em] text-brand-heading">
              Dashboard
            </span>
            <div className="flex items-center gap-1">
              <button onClick={signOut} title="Sign out" aria-label="Sign out"
                className="flex min-h-10 min-w-10 items-center justify-center text-brand-textMuted hover:text-brand-accentGlow lg:min-h-0 lg:min-w-0">
                <LogOut className="h-4 w-4" />
              </button>
              <button onClick={() => setNavOpen(false)} aria-label="Close menu"
                className="flex min-h-10 min-w-10 items-center justify-center text-brand-textMuted hover:text-brand-accentGlow lg:hidden">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <button
            onClick={() => { setProfileOpen(true); setNavOpen(false); }}
            title={`${me.email} — edit my profile`}
            className="mt-1.5 block w-full truncate text-left text-[0.75rem] text-brand-textMuted hover:text-brand-accentGlow"
          >
            {me.fullName || me.email}
            {me.isOwner && <span className="ml-1 text-action">· super admin</span>}
            {me.tier === 'sub_user' && <span className="ml-1">· sub-user</span>}
            {me.role === 'sales_agent' && <span className="ml-1">· sales agent</span>}
            <span className="mt-0.5 block text-[0.6875rem] uppercase tracking-[0.12em] underline underline-offset-2">
              My profile
            </span>
          </button>
        </div>

        <nav className="pb-6 lg:pb-0">
          {sections.map((s) => {
            const Icon = ICONS[s.id] ?? Inbox;
            const on = s.id === section;
            return (
              <button key={s.id} onClick={() => goTo(s.id)} aria-current={on ? 'page' : undefined}
                className={`flex min-h-11 w-full items-center gap-2.5 px-4 py-2.5 text-left font-display text-[0.8125rem] font-extrabold uppercase tracking-[0.1em] transition-colors lg:min-h-0 ${
                  on ? 'bg-brand-accent text-brand-onAccent' : 'text-brand-body hover:text-brand-accentGlow'}`}>
                <Icon className="h-3.5 w-3.5 flex-shrink-0" /><span>{s.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 p-3 sm:p-5 lg:p-8">
        {(() => {
          const showSearch = Boolean(resource && !SELF_TOOLBAR.has(active.id));
          const showNew = canCreate && Boolean(resource) && active.id !== 'products';
          const showManual = active.id === 'orders';
          const showBell = isDesktop && me.allowed.includes('notifications');
          const blurb = data && resource ? data.blurb : '';
          // On a phone the slim top bar already names the section, so only a
          // blurb or a toolbar earns this header any space.
          if (!isDesktop && !blurb && !showSearch && !showNew && !showManual) return null;
          return (
            <div className="mb-5 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:mb-6">
              <div className="min-w-0">
                <h1 className="page-title hidden lg:block">{active.label}</h1>
                {blurb && (
                  <p className="max-w-2xl text-[0.8125rem] leading-relaxed text-brand-textMuted lg:mt-1.5">{blurb}</p>
                )}
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                {showBell && <NotificationBell authedFetch={authedFetch} onNavigate={(next) => { if (me.allowed.includes(next) && !NOT_A_SECTION.has(next)) goTo(next); }} />}
                {showSearch && (
                  <div className="relative min-w-0 flex-1 sm:flex-none">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-textMuted" />
                    <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()}
                      placeholder="Search..." enterKeyHint="search" type="search"
                      className="min-h-11 w-full border border-brand-border bg-brand-card py-2 pl-8 pr-3 text-base text-brand-heading placeholder-brand-textMuted focus:border-brand-accent focus:outline-none sm:w-auto sm:text-xs" />
                  </div>
                )}
                {showSearch && (
                  <button onClick={() => load()} title="Refresh" aria-label="Refresh"
                    className="flex min-h-11 min-w-11 items-center justify-center border border-brand-borderLight text-brand-body hover:border-brand-accent hover:text-brand-accentGlow">
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                )}
                {showNew && (
                  <button onClick={() => openEditor(null)}
                    className="flex min-h-11 items-center gap-1.5 bg-brand-accent px-3 py-2 font-display text-[0.75rem] font-extrabold uppercase tracking-[0.1em] text-brand-onAccent transition-colors hover:bg-brand-accentHover">
                    <Plus className="h-3.5 w-3.5" /> New
                  </button>
                )}
                {showManual && (
                  <button onClick={() => setManualOrderOpen(true)}
                    className="flex min-h-11 items-center gap-1.5 bg-brand-accent px-3 py-2 font-display text-[0.75rem] font-extrabold uppercase tracking-[0.1em] text-brand-onAccent transition-colors hover:bg-brand-accentHover">
                    <Plus className="h-3.5 w-3.5" /> Manual order
                  </button>
                )}
              </div>
            </div>
          );
        })()}

        {error && <div className="mb-5 border border-brand-accent/50 bg-brand-card p-4 text-xs leading-relaxed text-brand-body">{error}</div>}

        {/* -------------------------------------------------------- custom */}
        {active.id === 'users' ? (
          <UsersPanel authedFetch={authedFetch} isOwner={me.isOwner} upload={upload} />

        ) : active.id === 'audit' ? (
          <AuditPanel authedFetch={authedFetch} />

        ) : active.id === 'my_earnings' ? (
          <SubUserHome authedFetch={authedFetch} me={me} />

        ) : active.id === 'commissions' ? (
          <CommissionsPanel authedFetch={authedFetch} />

        ) : active.id === 'analytics' ? (
          <AnalyticsPanel authedFetch={authedFetch} />

        ) : active.id === 'system' ? (
          <SystemHealthPanel authedFetch={authedFetch} />

        ) : active.id === 'categories' ? (
          <CategoriesPanel authedFetch={authedFetch} />

        ) : active.id === 'deals' ? (
          <DealsPanel authedFetch={authedFetch} />

        ) : active.id === 'campaigns' ? (
          <CampaignsPanel authedFetch={authedFetch} upload={upload} />
        ) : active.id === 'prospects' ? (
          <ProspectorPanel authedFetch={authedFetch} me={me} />
        ) : active.id === 'customers' ? (
          <CustomersPanel authedFetch={authedFetch} upload={upload} isAgent={me.role === 'sales_agent'} />

        ) : active.id === 'storefront' ? (
          <StorefrontHub authedFetch={authedFetch} upload={upload} />
        ) : active.id === 'articles' ? (
          <StorefrontHub authedFetch={authedFetch} upload={upload} initialTab="blog" />

        ) : active.id === 'home' ? (
          <DashboardHome
            authedFetch={authedFetch}
            allowed={me.allowed}
            onNavigate={(next) => { if (me.allowed.includes(next) && !NOT_A_SECTION.has(next)) { setSection(next); setQuery(''); setError(''); } }}
            agentLink={me.role === 'sales_agent' ? (
              <div className="border border-brand-border bg-brand-card p-4">
                <div className="eyebrow">Your referral link</div>
                <p className="mt-2 break-all font-mono text-[0.8125rem] text-brand-heading">
                  {me.referralCode && typeof window !== 'undefined'
                    ? `${window.location.origin}/?ref=${me.referralCode}`
                    : 'Being set up. Reload the page in a moment.'}
                </p>
                <p className="mt-1.5 text-[0.75rem] leading-relaxed text-brand-textMuted">
                  A customer who buys through this link is yours, and so are all their later orders.
                  Orders with no agent wait under Orders for somebody to claim them.
                </p>
              </div>
            ) : undefined}
          />

        ) : active.id === 'products' && data ? (
          <ProductsPanel
            rows={data.rows}
            total={data.total}
            authedFetch={authedFetch}
            onEdit={(row) => openEditor(row)}
            onPatch={(id, changes) => { void patch(id, changes); }}
            onDelete={remove}
            onNew={() => openEditor(null)}
            onRefresh={() => void load()}
          />

        /* --------------------------------------------------- generic table */
        ) : data && data.rows.length > 0 ? (
          <>
            <p className="mb-3 text-[0.8125rem] uppercase tracking-[0.12em] text-brand-textMuted">
              {data.rows.length} of {data.total}
            </p>
            {/* Phones: one card per record, label beside value, instead of a
                table that needs sideways scrolling. */}
            <ul className="space-y-2 md:hidden">
              {data.rows.map((row) => {
                const cols = visibleColumns(data);
                const editable = active.id === 'orders' ? [] : data.editable;
                return (
                  <li key={row.id} className="border border-brand-border bg-brand-card">
                    <dl className="divide-y divide-brand-border/60">
                      {cols.map((k) => (
                        <div key={k} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                          <dt className="flex-shrink-0 font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.1em] text-brand-textMuted">{prettify(k)}</dt>
                          <dd className="min-w-0 text-right text-brand-body">{cell(row, k, editable)}</dd>
                        </div>
                      ))}
                      {data.ownership && (
                        <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                          <dt className="font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.1em] text-brand-textMuted">Agent</dt>
                          <dd className="text-right text-brand-body">{ownerCell(row, data.ownership)}</dd>
                        </div>
                      )}
                    </dl>
                    {(active.id === 'orders' || data.editable.length > 0 || data.deletable) && (
                      <div className="flex items-center gap-2 border-t border-brand-border px-3 py-2">
                        {active.id === 'orders' && (
                          <button onClick={() => toggleOrderDetails(row)}
                            className="inline-flex min-h-10 flex-1 items-center justify-center gap-1 border border-brand-borderLight px-3 font-display text-[0.6875rem] font-black uppercase tracking-[0.1em] text-brand-body">
                            <ChevronDown className="h-3 w-3 -rotate-90" /> Details
                          </button>
                        )}
                        {active.id !== 'orders' && data.editable.length > 0 && (
                          <button onClick={() => openEditor(row)}
                            className="inline-flex min-h-10 flex-1 items-center justify-center gap-1 border border-brand-borderLight px-3 font-display text-[0.6875rem] font-black uppercase tracking-[0.1em] text-brand-body">
                            <Pencil className="h-3 w-3" /> Edit
                          </button>
                        )}
                        {data.deletable && (
                          <button onClick={() => remove(row.id)} aria-label="Delete"
                            className="flex min-h-10 min-w-10 items-center justify-center border border-brand-borderLight text-brand-textMuted">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="hidden overflow-x-auto border border-brand-border md:block">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-brand-border bg-brand-card"><tr>
                  {visibleColumns(data).map((k) => (
                    <th key={k} className="whitespace-nowrap px-3 py-2.5 font-display text-[0.75rem] font-extrabold uppercase tracking-[0.12em] text-brand-textMuted">{prettify(k)}</th>))}
                  {data.ownership && (
                    <th className="whitespace-nowrap px-3 py-2.5 font-display text-[0.75rem] font-extrabold uppercase tracking-[0.12em] text-brand-textMuted">Agent</th>
                  )}
                  <th className="px-3 py-2.5" />
                </tr></thead>
                <tbody>
                  {data.rows.map((row) => (
                    <React.Fragment key={row.id}>
                      <tr className="border-b border-brand-border/60 last:border-b-0 hover:bg-brand-card">
                        {visibleColumns(data).map((k) => (
                          <td key={k} className="whitespace-nowrap px-3 py-2.5 text-brand-body">{cell(row, k, active.id === 'orders' ? [] : data.editable)}</td>))}
                        {data.ownership && (
                          <td className="whitespace-nowrap px-3 py-2.5 text-brand-body">{ownerCell(row, data.ownership)}</td>
                        )}
                        <td className="whitespace-nowrap px-3 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {active.id === 'orders' && (
                              <button onClick={() => toggleOrderDetails(row)} title="Order detail"
                                className="inline-flex items-center gap-1 border border-brand-borderLight px-2 py-1 font-display text-[0.6875rem] font-black uppercase tracking-[0.1em] text-brand-body transition-colors hover:border-brand-accent hover:text-brand-accentGlow">
                                <ChevronDown className="h-2.5 w-2.5 -rotate-90" /> Detail
                              </button>
                            )}
                            {active.id !== 'orders' && data.editable.length > 0 && (
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
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            {active.id !== 'orders' && <p className="mt-3 text-[0.75rem] leading-relaxed text-brand-textMuted">Use Edit to review and save changes.</p>}
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

      {manualOrderOpen && (
        <ManualOrderModal
          authedFetch={authedFetch}
          onCancel={() => setManualOrderOpen(false)}
          onSaved={() => {
            setManualOrderOpen(false);
            void load();
          }}
        />
      )}

      {editorOpen && data && (
        <RecordEditor
          title={data.title.replace(/s$/, '')}
          fields={editorRow ? data.editFields : data.createFields}
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

      {expandedOrderId && data && (
        <OrderDetailModal
          row={data.rows.find((row) => row.id === expandedOrderId) ?? { id: expandedOrderId }}
          detail={orderDetails[expandedOrderId]}
          error={orderDetailError}
          ownership={data.ownership}
          onClose={() => setExpandedOrderId(null)}
          onSave={saveOrderDetail}
        />
      )}
    </div>
  );
}
