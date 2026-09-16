'use client';

import React, { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { buildOrderMessage, whatsAppLink } from '@/lib/whatsapp';

interface Props {
  authedFetch: (path: string, init?: RequestInit) => Promise<Response>;
}

/**
 * Dashboard > Storefront: the number behind every "Order on WhatsApp" button.
 * Switched off, or with no number, the buttons disappear from the site.
 */
export default function WhatsAppSettings({ authedFetch }: Props) {
  const [number, setNumber] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [saved, setSaved] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    authedFetch('/api/admin/whatsapp')
      .then((res) => res.json())
      .then((p) => {
        const w = p?.data?.whatsapp;
        if (w) { setNumber(w.number ? `+${w.number}` : ''); setEnabled(Boolean(w.enabled)); setSaved(w.number); }
      })
      .catch(() => setError('Could not load the WhatsApp setting.'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setSaving(true); setError(''); setNotice('');
    try {
      const res = await authedFetch('/api/admin/whatsapp', {
        method: 'POST',
        body: JSON.stringify({ number, enabled }),
      });
      const p = await res.json().catch(() => null);
      if (!res.ok) { setError(p?.message ?? 'Could not save.'); return; }
      const w = p.data.whatsapp;
      setNumber(w.number ? `+${w.number}` : '');
      setEnabled(w.enabled);
      setSaved(w.number);
      setNotice(w.enabled ? 'Saved — the buttons are live on the site' : 'Saved — the buttons are hidden');
    } catch {
      setError('Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const testLink = saved
    ? whatsAppLink(saved, buildOrderMessage([{ name: 'Test product', quantity: 1, unitPrice: 0 }]))
    : '';

  return (
    <div className="border border-brand-border bg-brand-card p-4">
      <h2 className="eyebrow mb-2 flex items-center gap-1.5">
        <MessageCircle className="h-3.5 w-3.5" /> Order on WhatsApp
      </h2>
      <p className="text-[0.8125rem] leading-relaxed text-brand-textMuted">
        Adds an &ldquo;Order on WhatsApp&rdquo; button to product pages and the cart. It opens a chat
        with this number, with the customer&rsquo;s items and total already typed out.
      </p>

      {loading ? (
        <p className="mt-4 text-xs text-brand-textMuted">Loading...</p>
      ) : (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="eyebrow mb-1.5 block">WhatsApp number</span>
            <input
              value={number}
              onChange={(e) => { setNumber(e.target.value); setNotice(''); }}
              placeholder="+1 555 123 4567"
              inputMode="tel"
              className="w-full max-w-xs border border-brand-border bg-brand-dark px-3 py-2 font-mono text-xs text-brand-heading placeholder-brand-textMuted focus:border-brand-accent focus:outline-none"
            />
            <span className="mt-1 block text-[0.75rem] text-brand-textMuted">
              With the country code. A 10-digit number is treated as US.
            </span>
          </label>

          <label className="flex items-center gap-2 text-[0.8125rem] text-brand-body">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => { setEnabled(e.target.checked); setNotice(''); }}
              className="h-4 w-4 accent-[#1f4233]"
            />
            Show the button on the website
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => void save()} disabled={saving} className="btn-primary disabled:opacity-60">
              {saving ? 'Saving...' : 'Save'}
            </button>
            {testLink && (
              <a
                href={testLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 font-display text-[0.75rem] font-extrabold uppercase tracking-[0.1em] text-brand-textMuted transition-colors hover:text-brand-accentGlow"
              >
                Test the link
              </a>
            )}
            {notice && (
              <span className="font-display text-[0.75rem] font-extrabold uppercase tracking-[0.1em] text-brand-success">
                {notice}
              </span>
            )}
            {error && <span className="text-[0.8125rem] text-red-600">{error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
