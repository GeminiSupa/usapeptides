'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import NotificationsPanel from './NotificationsPanel';

type Fetcher = (path: string, init?: RequestInit) => Promise<Response>;

/**
 * The bell at the top of the dashboard: unread count, and the list itself in a
 * drop-down. Replaces the separate Notifications tab.
 */
export default function NotificationBell({ authedFetch, onNavigate }: { authedFetch: Fetcher; onNavigate: (section: string) => void }) {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await authedFetch('/api/admin/notifications');
      const p = await res.json();
      if (res.ok) setCount(p.data.unreadCount ?? 0);
    } catch { /* the bell is best-effort */ }
  }, [authedFetch]);

  useEffect(() => {
    if (open) return; // the open panel refreshes itself
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(timer);
  }, [refresh, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
        aria-label={`Notifications${count ? `, ${count} unread` : ''}`}
        aria-expanded={open}
        className={`relative border p-2 transition-colors ${open ? 'border-brand-accent text-brand-heading' : 'border-brand-borderLight text-brand-body hover:border-brand-accent hover:text-brand-accentGlow'}`}
      >
        <Bell className="h-3.5 w-3.5" />
        {count > 0 && (
          <span className="absolute -right-2 -top-2 min-w-5 bg-action px-1 text-center text-[0.625rem] font-black leading-5 text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
      {open && (
        <>
          {/* A drop-down this tall could only ever smear itself across the
              table behind it. It is a drawer instead: dimmed backdrop, docked
              to the right edge, full height, so nothing is half-covered. */}
          <button
            aria-label="Close notifications"
            className="fixed inset-0 z-40 cursor-default bg-black/50"
            onClick={() => setOpen(false)}
          />
          <aside className="fixed inset-y-0 right-0 z-50 flex w-full flex-col sm:max-w-[26rem] border-l border-brand-border bg-brand-card">
            <div className="flex items-center justify-between gap-2 border-b border-brand-border px-4 py-3">
              <h2 className="font-display text-sm font-extrabold uppercase tracking-[0.1em] text-brand-heading">
                Notifications
              </h2>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-brand-textMuted hover:text-brand-heading">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <NotificationsPanel
                compact
                authedFetch={authedFetch}
                onUnreadChange={setCount}
                onNavigate={(section) => { setOpen(false); onNavigate(section); }}
              />
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
