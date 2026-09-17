'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, CheckCheck, CircleAlert, Inbox, PackageCheck, RefreshCw, ShoppingBag, Star } from 'lucide-react';

type Fetcher = (path: string, init?: RequestInit) => Promise<Response>;
type Notification = { id: string; kind: string; title: string; body: string | null; link: string | null; is_read: boolean; created_at: string };

const ICONS: Record<string, typeof Bell> = { order: ShoppingBag, inquiry: Inbox, review: Star, stock: CircleAlert, fulfillment: PackageCheck, system: Bell };

/**
 * The notification list. Shown inside the bell's drop-down (`compact`), which
 * is the only place it lives now — there is no separate Notifications tab.
 */
export default function NotificationsPanel({ authedFetch, onNavigate, compact = false, onUnreadChange }: {
  authedFetch: Fetcher;
  onNavigate: (section: string) => void;
  compact?: boolean;
  onUnreadChange?: (count: number) => void;
}) {
  const [items, setItems] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'unread' | 'all'>('unread');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [perUserReads, setPerUserReads] = useState(true);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const res = await authedFetch('/api/admin/notifications');
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message ?? 'Could not load notifications.');
      setItems(payload.data.notifications ?? []);
      setPerUserReads(payload.data.perUserReads !== false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load notifications.');
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const unread = items.filter((item) => !item.is_read).length;
  useEffect(() => { if (!loading) onUnreadChange?.(unread); }, [unread, loading, onUnreadChange]);
  const visible = useMemo(() => filter === 'unread' ? items.filter((item) => !item.is_read) : items, [filter, items]);

  const mark = async (id?: string, unreadValue = false) => {
    const key = id ?? 'all'; setBusy(key); setError('');
    try {
      const res = await authedFetch('/api/admin/notifications', {
        method: 'PATCH',
        body: JSON.stringify(id ? { id, unread: unreadValue } : { markAllRead: true }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.message ?? 'Could not update the notification.');
      setItems((current) => current.map((item) => id && item.id !== id ? item : { ...item, is_read: !unreadValue }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update the notification.');
    } finally { setBusy(''); }
  };

  const open = async (item: Notification) => {
    if (!item.is_read) await mark(item.id);
    const match = item.link?.match(/[?&]section=([^&]+)/);
    if (match) onNavigate(decodeURIComponent(match[1]));
  };

  if (compact) {
    return <div className="flex max-h-[min(34rem,75vh)] flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-brand-border px-3 py-2.5">
        <div className="flex gap-1">
          {(['unread', 'all'] as const).map((value) => <button key={value} onClick={() => setFilter(value)} className={`chip ${filter === value ? 'bg-brand-accent text-brand-onAccent' : 'text-brand-textMuted hover:text-brand-heading'}`}>{value === 'unread' ? `Unread ${unread}` : `All ${items.length}`}</button>)}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => void load()} title="Refresh" className="p-1.5 text-brand-textMuted hover:text-brand-heading"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /></button>
          <button onClick={() => void mark()} disabled={!unread || Boolean(busy)} className="chip border border-brand-borderLight text-brand-heading disabled:opacity-40"><CheckCheck className="h-3 w-3" /> All read</button>
        </div>
      </div>
      {error && <p className="border-b border-brand-border p-3 text-xs text-action">{error}</p>}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && !items.length ? <p className="p-6 text-center text-xs text-brand-textMuted">Loading…</p>
          : visible.length === 0 ? <p className="p-8 text-center text-xs text-brand-textMuted"><CheckCheck className="mx-auto mb-2 h-5 w-5" />All caught up.</p>
          : visible.map((item) => { const Icon = ICONS[item.kind] ?? Bell; return (
            <div key={item.id} className={`flex gap-2.5 border-b border-brand-border/60 px-3 py-2.5 last:border-b-0 ${item.is_read ? 'opacity-60' : ''}`}>
              <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-accentGlow" />
              <button onClick={() => void open(item)} className="min-w-0 flex-1 text-left">
                <p className="text-[0.8125rem] font-semibold leading-snug text-brand-heading">{item.title}</p>
                {item.body && <p className="mt-0.5 line-clamp-2 text-[0.75rem] text-brand-body">{item.body}</p>}
                <p className="mt-1 text-[0.6875rem] text-brand-textMuted">{new Date(item.created_at).toLocaleString()}</p>
              </button>
              <button disabled={busy === item.id} onClick={() => void mark(item.id, item.is_read)} title={item.is_read ? 'Mark unread' : 'Mark read'}
                className="self-start text-[0.625rem] font-bold uppercase text-brand-textMuted hover:text-brand-heading">{item.is_read ? 'Unread' : 'Read'}</button>
            </div>); })}
      </div>
      {!perUserReads && <p className="border-t border-brand-border p-2 text-[0.6875rem] text-brand-textMuted">Run migration 0012 for private read status.</p>}
    </div>;
  }

  return <div className="space-y-4">
    <div className="border border-brand-border bg-brand-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-sm font-extrabold uppercase tracking-[0.08em] text-brand-heading">Operational inbox</p>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-brand-textMuted">Automatic dashboard alerts for new orders, enquiries, reviews, stock and fulfilment. It checks for new alerts every minute.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void load()} className="btn-secondary" disabled={loading}><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
          <button onClick={() => void mark()} className="btn-primary" disabled={!unread || Boolean(busy)}><CheckCheck className="h-3.5 w-3.5" /> Mark all read</button>
        </div>
      </div>
      {!perUserReads && <p className="mt-3 border border-action/40 p-2 text-[0.75rem] text-brand-body">Run migration 0012 for private read/unread status per administrator. Until then, marking an alert read affects the shared inbox.</p>}
    </div>

    <div className="flex gap-1 border-b border-brand-border">
      {(['unread', 'all'] as const).map((value) => <button key={value} onClick={() => setFilter(value)} className={`px-4 py-2 font-display text-[0.75rem] font-extrabold uppercase tracking-[0.1em] ${filter === value ? 'border-b-2 border-brand-accent text-brand-heading' : 'text-brand-textMuted'}`}>{value === 'unread' ? `Unread (${unread})` : `All (${items.length})`}</button>)}
    </div>
    {error && <p className="border border-action/40 bg-brand-card p-3 text-sm text-brand-body">{error}</p>}
    {loading && !items.length ? <p className="p-8 text-center text-brand-textMuted">Loading notifications…</p> : visible.length === 0 ? <div className="border border-brand-border bg-brand-card p-12 text-center"><CheckCheck className="mx-auto h-6 w-6 text-brand-textMuted" /><p className="mt-3 font-display text-sm font-extrabold text-brand-heading">All caught up</p><p className="mt-1 text-xs text-brand-textMuted">New operational alerts will appear here automatically.</p></div> : <div className="divide-y divide-brand-border border border-brand-border bg-brand-card">{visible.map((item) => { const Icon = ICONS[item.kind] ?? Bell; return <div key={item.id} className={`flex gap-3 p-4 ${item.is_read ? 'opacity-70' : ''}`}><div className="mt-0.5 border border-brand-border p-2"><Icon className="h-4 w-4 text-brand-accentGlow" /></div><button onClick={() => void open(item)} className="min-w-0 flex-1 text-left"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-brand-heading">{item.title}</span>{!item.is_read && <span className="bg-action px-1.5 py-0.5 text-[0.625rem] font-bold uppercase text-white">New</span>}</div>{item.body && <p className="mt-1 text-[0.8125rem] text-brand-body">{item.body}</p>}<p className="mt-1.5 text-[0.6875rem] text-brand-textMuted">{new Date(item.created_at).toLocaleString()}{item.link ? ' · Open related record' : ''}</p></button><button disabled={busy === item.id} onClick={() => void mark(item.id, item.is_read)} className="self-start border border-brand-border px-2 py-1 text-[0.6875rem] font-bold uppercase text-brand-body hover:border-brand-accent">{item.is_read ? 'Unread' : 'Read'}</button></div>;})}</div>}
    <p className="text-[0.75rem] leading-relaxed text-brand-textMuted">This inbox is separate from email, WhatsApp and Vercel logs. External delivery appears only after those providers are connected.</p>
  </div>;
}
