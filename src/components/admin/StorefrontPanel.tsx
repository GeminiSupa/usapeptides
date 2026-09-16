'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Trash2, ExternalLink, Eye, EyeOff } from 'lucide-react';
import type { Banner } from '@/lib/banner';

/**
 * The Storefront tab: the announcement strip that runs above the header on
 * every page of the public site.
 *
 * This is the shortest demonstration that the dashboard and the website are the
 * same system — type a line here, press save, reload the site, it is there.
 */

interface Props {
  authedFetch: (path: string, init?: RequestInit) => Promise<Response>;
}

const blank = (): Banner => ({
  id: `b-${Date.now().toString(36)}`,
  text: '',
  href: '',
  isActive: true,
});

export default function StorefrontPanel({ authedFetch }: Props) {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    authedFetch('/api/admin/banners')
      .then((res) => res.json())
      .then((p) => setBanners(p?.data?.banners ?? []))
      .catch(() => setError('Could not load the current banner.'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (id: string, patch: Partial<Banner>) => {
    setSaved(false);
    setBanners((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await authedFetch('/api/admin/banners', {
        method: 'POST',
        // Blank lines are dropped rather than saved as empty bars.
        body: JSON.stringify({ banners: banners.filter((b) => b.text.trim()) }),
      });
      const p = await res.json().catch(() => null);
      if (!res.ok) {
        setError(p?.message ?? 'Could not save.');
        return;
      }
      setBanners(p?.data?.banners ?? []);
      setSaved(true);
    } catch {
      setError('Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const live = banners.filter((b) => b.isActive && b.text.trim());
  const preview = live.map((b) => b.text.trim()).join('   •   ');

  return (
    <div className="max-w-3xl space-y-6">
      <div className="border border-brand-border bg-brand-card p-4">
        <h2 className="eyebrow mb-2">Announcement strip</h2>
        <p className="text-[0.8125rem] leading-relaxed text-brand-textMuted">
          A thin bar above the header on every page. Switch all of them off and the bar disappears
          entirely. Several active lines scroll together as one message.
        </p>
      </div>

      {/* What the site will show, rendered the same way it is rendered there. */}
      <div>
        <h3 className="eyebrow mb-2">Preview</h3>
        {preview ? (
          <div className="overflow-hidden border border-black/25 bg-navy">
            <div className="whitespace-nowrap px-4 py-2 font-display text-[0.75rem] font-extrabold uppercase tracking-[0.14em] text-cream">
              {preview}
            </div>
          </div>
        ) : (
          <p className="border border-dashed border-brand-border p-4 text-center text-[0.75rem] text-brand-textMuted">
            Nothing active — the site shows no bar at all.
          </p>
        )}
      </div>

      <div className="space-y-3">
        {loading ? (
          <p className="text-xs text-brand-textMuted">Loading...</p>
        ) : banners.length === 0 ? (
          <p className="border border-brand-border bg-brand-card p-8 text-center text-xs text-brand-textMuted">
            No announcements yet.
          </p>
        ) : (
          banners.map((b, i) => (
            <div key={b.id} className="border border-brand-border bg-brand-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="eyebrow">Line {i + 1}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => update(b.id, { isActive: !b.isActive })}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 font-display text-[0.6875rem] font-black uppercase tracking-[0.1em] transition-colors ${
                      b.isActive
                        ? 'bg-brand-accent text-brand-onAccent'
                        : 'border border-brand-borderLight text-brand-textMuted'
                    }`}
                  >
                    {b.isActive ? <Eye className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />}
                    {b.isActive ? 'Showing' : 'Hidden'}
                  </button>
                  <button
                    onClick={() => {
                      setSaved(false);
                      setBanners((prev) => prev.filter((x) => x.id !== b.id));
                    }}
                    title="Remove this line"
                    className="p-1 text-brand-textMuted hover:text-brand-accentGlow"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>

              <label className="block">
                <span className="eyebrow mb-1.5 block">Message</span>
                <input
                  value={b.text}
                  maxLength={220}
                  onChange={(e) => update(b.id, { text: e.target.value })}
                  placeholder="Free shipping on orders over $100"
                  className="w-full border border-brand-border bg-brand-dark px-3 py-2 text-xs text-brand-heading placeholder-brand-textMuted focus:border-brand-accent focus:outline-none"
                />
              </label>

              <label className="mt-3 block">
                <span className="eyebrow mb-1.5 block">Links to (optional)</span>
                <input
                  value={b.href ?? ''}
                  onChange={(e) => update(b.id, { href: e.target.value })}
                  placeholder="/shop"
                  className="w-full border border-brand-border bg-brand-dark px-3 py-2 font-mono text-xs text-brand-heading placeholder-brand-textMuted focus:border-brand-accent focus:outline-none"
                />
                <span className="mt-1 block text-[0.75rem] text-brand-textMuted">
                  A path on this site like <span className="font-mono">/shop</span>, or a full
                  https:// address. Anything else is ignored.
                </span>
              </label>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-brand-border pt-4">
        <button
          onClick={() => { setSaved(false); setBanners((prev) => [...prev, blank()]); }}
          className="inline-flex items-center gap-1.5 border border-brand-borderLight px-3 py-2 font-display text-[0.75rem] font-extrabold uppercase tracking-[0.1em] text-brand-body transition-colors hover:border-brand-accent hover:text-brand-accentGlow"
        >
          <Plus className="h-3 w-3" /> Add a line
        </button>

        <button onClick={() => void save()} disabled={saving} className="btn-primary disabled:opacity-60">
          {saving ? 'Saving...' : 'Save and publish'}
        </button>

        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-2 font-display text-[0.75rem] font-extrabold uppercase tracking-[0.1em] text-brand-textMuted transition-colors hover:text-brand-accentGlow"
        >
          <ExternalLink className="h-3 w-3" /> Open the website
        </a>

        {saved && (
          <span className="font-display text-[0.75rem] font-extrabold uppercase tracking-[0.1em] text-whatsapp">
            Published — reload the site to see it
          </span>
        )}
        {error && <span className="text-[0.8125rem] text-brand-accentGlow">{error}</span>}
      </div>
    </div>
  );
}
