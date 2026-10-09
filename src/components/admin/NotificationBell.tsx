'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
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
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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
          <button aria-label="Close notifications" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          {/* The bell sits at the left of the toolbar, so the panel hangs from its
              left edge. Anchored right it ran off the screen and under the
              sidebar. The width is clamped so it cannot overflow either side. */}
          <div className="fixed inset-x-3 top-16 z-50 max-h-[80vh] overflow-hidden border border-brand-border bg-brand-card sm:absolute sm:inset-x-auto sm:left-0 sm:right-auto sm:top-full sm:mt-2 sm:w-[min(26rem,calc(100vw-3rem))]">
            <NotificationsPanel
              compact
              authedFetch={authedFetch}
              onUnreadChange={setCount}
              onNavigate={(section) => { setOpen(false); onNavigate(section); }}
            />
          </div>
        </>
      )}
    </div>
  );
}
