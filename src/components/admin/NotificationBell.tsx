'use client';
import { useCallback, useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
type Fetcher = (path: string, init?: RequestInit) => Promise<Response>;
export default function NotificationBell({ authedFetch, onOpen }: { authedFetch: Fetcher; onOpen: () => void }) {
  const [count, setCount] = useState(0);
  const refresh = useCallback(async () => { try { const res = await authedFetch('/api/admin/notifications'); const p = await res.json(); if (res.ok) setCount(p.data.unreadCount ?? 0); } catch {} }, [authedFetch]);
  useEffect(() => { void refresh(); const timer = window.setInterval(() => void refresh(), 60_000); return () => window.clearInterval(timer); }, [refresh]);
  return <button onClick={onOpen} title="Open notifications" className="relative border border-brand-borderLight p-2 text-brand-body hover:border-brand-accent hover:text-brand-accentGlow"><Bell className="h-3.5 w-3.5" />{count > 0 && <span className="absolute -right-2 -top-2 min-w-5 bg-action px-1 text-center text-[0.625rem] font-black leading-5 text-white">{count > 99 ? '99+' : count}</span>}</button>;
}
