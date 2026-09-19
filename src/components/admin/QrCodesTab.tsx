'use client';

import React, { useEffect, useState } from 'react';
import { Copy, Download, Maximize2, QrCode } from 'lucide-react';
import type { AdminProfile } from '@/lib/permissions';
import QrCodeModal, { qrDataUrl, type QrTarget } from './QrCodeModal';

/**
 * Users > QR codes.
 *
 * One printable code per person who has a referral link — team members, sales
 * agents, sub-users and outside affiliates — so a card or flyer credits the
 * right person. Plus a box that turns any page of the site into a code.
 * Product codes live on each product in Products.
 */

type Fetcher = (path: string, init?: RequestInit) => Promise<Response>;

interface Person { key: string; name: string; kind: string; code: string }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function Thumb({ url, onOpen }: { url: string; onOpen: () => void }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let live = true;
    qrDataUrl(url, 240).then((d) => { if (live) setSrc(d); }).catch(() => undefined);
    return () => { live = false; };
  }, [url]);
  return (
    <button onClick={onOpen} title="Open larger" className="group relative h-24 w-24 flex-shrink-0 border border-brand-border bg-white p-1">
      {src && <img src={src} alt="" className="h-full w-full" />}
      <span className="absolute inset-0 hidden items-center justify-center bg-black/40 text-white group-hover:flex"><Maximize2 className="h-4 w-4" /></span>
    </button>
  );
}

export default function QrCodesTab({ authedFetch, users }: { authedFetch: Fetcher; users: AdminProfile[] }) {
  const [affiliates, setAffiliates] = useState<Person[]>([]);
  const [open, setOpen] = useState<QrTarget | null>(null);
  const [custom, setCustom] = useState('/shop');
  const [notice, setNotice] = useState('');
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => {
    authedFetch('/api/admin/affiliates')
      .then((r) => r.json().then((p) => ({ ok: r.ok, p })))
      .then(({ ok, p }) => {
        if (!ok) return;
        const list = (p.data?.affiliates ?? p.data?.rows ?? []) as Record<string, any>[];
        setAffiliates(list.filter((a) => a.referral_code && a.is_active !== false).map((a) => ({
          key: `a-${a.id}`, name: a.full_name || a.email, kind: 'Affiliate', code: a.referral_code,
        })));
      })
      .catch(() => undefined);
  }, [authedFetch]);

  const team: Person[] = users
    .filter((u) => u.referral_code && u.status === 'active')
    .map((u) => ({
      key: `u-${u.id}`,
      name: u.full_name || u.email,
      kind: u.tier === 'sub_user' ? 'Sub-user' : u.role === 'sales_agent' ? 'Sales agent' : 'Team',
      code: String(u.referral_code),
    }));

  const people = [...team, ...affiliates];
  const linkFor = (p: Person) => `${origin}/?ref=${encodeURIComponent(p.code)}`;
  const targetFor = (p: Person): QrTarget => ({
    title: p.name, subtitle: `${p.kind} · code ${p.code}`, url: linkFor(p),
    filename: `qr-${p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${p.code}`,
  });

  const download = async (p: Person) => {
    const data = await qrDataUrl(linkFor(p));
    const a = document.createElement('a');
    a.href = data;
    a.download = `${targetFor(p).filename}.png`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  const downloadAll = async () => {
    // One at a time: browsers drop a burst of simultaneous downloads.
    for (const p of people) { await download(p); await sleep(350); }
    setNotice(`Downloaded ${people.length} QR codes.`);
  };

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setNotice('Link copied.'); } catch { window.prompt('Copy this link:', text); }
  };

  const customUrl = (() => {
    const value = custom.trim();
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) return value;
    return `${origin}${value.startsWith('/') ? '' : '/'}${value}`;
  })();

  return (
    <div className="space-y-5">
      <div className="border border-brand-border bg-brand-card p-4">
        <p className="font-display text-xs font-extrabold uppercase tracking-[0.08em] text-brand-heading">Any page</p>
        <p className="mt-1 text-[0.8125rem] text-brand-textMuted">Type a page of the site (for example /shop or /contact-us) or a full web address.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input value={custom} onChange={(e) => setCustom(e.target.value)} className="field-input max-w-md flex-1" placeholder="/shop" />
          <button className="btn-primary px-4 py-2" disabled={!customUrl}
            onClick={() => setOpen({ title: 'QR code', subtitle: custom, url: customUrl, filename: `qr-${custom.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home'}` })}>
            <QrCode className="h-3.5 w-3.5" /> Make QR code
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.8125rem] text-brand-textMuted">
          Referral codes: a customer who scans one is credited to that person for 30 days.
        </p>
        <button className="btn-secondary" onClick={() => void downloadAll()} disabled={people.length === 0}>
          <Download className="h-3.5 w-3.5" /> Download all ({people.length})
        </button>
      </div>
      {notice && <p className="text-[0.75rem] text-brand-accentGlow">{notice}</p>}

      {people.length === 0 ? (
        <p className="border border-brand-border bg-brand-card p-8 text-center text-xs text-brand-textMuted">
          Nobody has a referral code yet. Sales agents and sub-users get one automatically; add affiliates in the Affiliates tab.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {people.map((p) => (
            <div key={p.key} className="flex gap-3 border border-brand-border bg-brand-card p-3">
              <Thumb url={linkFor(p)} onOpen={() => setOpen(targetFor(p))} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-brand-heading">{p.name}</p>
                <p className="text-[0.6875rem] uppercase tracking-[0.1em] text-brand-textMuted">{p.kind} · {p.code}</p>
                <p className="mt-1 truncate font-mono text-[0.6875rem] text-brand-textMuted">{linkFor(p)}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button className="btn-secondary px-2 py-1" onClick={() => void download(p)}><Download className="h-3 w-3" /> PNG</button>
                  <button className="btn-secondary px-2 py-1" onClick={() => void copy(linkFor(p))}><Copy className="h-3 w-3" /> Link</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && <QrCodeModal target={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
