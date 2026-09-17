'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, Loader2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import {
  CONTENT_SECTIONS, parseFaqs, type ContentField, type FaqEntry,
} from '@/lib/siteContent';
import UploadField, { type UploadKind } from './UploadField';

/**
 * Storefront > Website text.
 *
 * Every editable line of the public site, grouped the way the site is laid
 * out. Changes are kept locally until Save, and a field that still shows the
 * template's wording can be put back with one click.
 */

type Fetcher = (path: string, init?: RequestInit) => Promise<Response>;

interface Props {
  authedFetch: Fetcher;
  upload: (file: File, kind: UploadKind) => Promise<string>;
}

export default function SiteContentEditor({ authedFetch, upload }: Props) {
  const [section, setSection] = useState(CONTENT_SECTIONS[0].id);
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [defaults, setDefaults] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await authedFetch('/api/admin/site-content');
      const p = await res.json();
      if (!res.ok) throw new Error(p?.message ?? 'Could not load the website text.');
      setSaved(p.data.values); setDefaults(p.data.defaults); setDraft({});
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load the website text.';
      if (message !== 'denied') setError(message);
    } finally { setLoading(false); }
  }, [authedFetch]);

  useEffect(() => { void load(); }, [load]);

  const value = (key: string) => (key in draft ? draft[key] : saved[key] ?? '');
  const set = (key: string, v: string) => { setNotice(''); setDraft((d) => ({ ...d, [key]: v })); };
  const dirtyKeys = Object.keys(draft).filter((k) => draft[k] !== saved[k]);
  const current = CONTENT_SECTIONS.find((s) => s.id === section) ?? CONTENT_SECTIONS[0];

  const dirtyBySection = useMemo(() => {
    const out: Record<string, number> = {};
    for (const s of CONTENT_SECTIONS) out[s.id] = s.fields.filter((f) => dirtyKeys.includes(f.key)).length;
    return out;
  }, [dirtyKeys]);

  const save = async () => {
    setBusy(true); setError(''); setFieldErrors({}); setNotice('');
    try {
      const values = Object.fromEntries(dirtyKeys.map((k) => [k, draft[k]]));
      const res = await authedFetch('/api/admin/site-content', { method: 'POST', body: JSON.stringify({ values }) });
      const p = await res.json().catch(() => null);
      if (!res.ok) { setError(p?.message ?? 'Could not save.'); setFieldErrors(p?.fields ?? {}); return; }
      setSaved(p.data.values); setDraft({});
      setNotice('Saved. The website shows the new text on the next page load.');
    } catch { setError('Could not save.'); }
    finally { setBusy(false); }
  };

  const restore = (key: string) => set(key, defaults[key] ?? '');

  if (loading) return <p className="flex items-center gap-2 text-xs text-brand-textMuted"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading website text…</p>;

  return (
    <div className="grid gap-5 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Website sections">
        {CONTENT_SECTIONS.map((s) => (
          <button key={s.id} onClick={() => setSection(s.id)}
            className={`flex flex-shrink-0 items-center justify-between gap-2 px-3 py-2 text-left font-display text-[0.75rem] font-extrabold uppercase tracking-[0.08em] ${
              section === s.id ? 'bg-brand-accent text-brand-onAccent' : 'text-brand-body hover:bg-brand-card'}`}>
            {s.label}
            {dirtyBySection[s.id] > 0 && <span className="bg-action px-1.5 text-[0.625rem] text-white">{dirtyBySection[s.id]}</span>}
          </button>
        ))}
      </nav>

      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3 border border-brand-border bg-brand-card p-4">
          <div>
            <h2 className="font-display text-sm font-extrabold uppercase tracking-[0.08em] text-brand-heading">{current.label}</h2>
            <p className="mt-1 text-[0.8125rem] text-brand-textMuted">{current.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {current.page && (
              <a href={current.page} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                <ExternalLink className="h-3.5 w-3.5" /> View page
              </a>
            )}
            <button className="btn-primary px-4 py-2" disabled={busy || dirtyKeys.length === 0} onClick={() => void save()}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save{dirtyKeys.length ? ` ${dirtyKeys.length} change${dirtyKeys.length === 1 ? '' : 's'}` : ''}
            </button>
          </div>
        </div>

        {error && <p className="border border-action/50 bg-brand-card p-3 text-xs text-brand-body">{error}</p>}
        {notice && <p className="border border-brand-border bg-brand-card p-3 text-xs text-brand-accentGlow">{notice}</p>}

        {section === 'seo' && <SearchPreview title={value('seo.siteTitle')} description={value('seo.description')} />}

        <div className="space-y-4 border border-brand-border bg-brand-card p-4">
          {current.fields.map((field) => (
            <FieldEditor
              key={field.key}
              field={field}
              value={value(field.key)}
              isDefault={value(field.key) === defaults[field.key]}
              error={fieldErrors[field.key]}
              upload={upload}
              onChange={(v) => set(field.key, v)}
              onRestore={() => restore(field.key)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FieldEditor({ field, value, isDefault, error, upload, onChange, onRestore }: {
  field: ContentField; value: string; isDefault: boolean; error?: string;
  upload: (file: File, kind: UploadKind) => Promise<string>;
  onChange: (v: string) => void; onRestore: () => void;
}) {
  const over = field.max && value.length > field.max;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={field.key} className="field-label mb-0">{field.label}</label>
        <div className="flex items-center gap-3 text-[0.6875rem]">
          {field.max && <span className={over ? 'font-bold text-action' : 'text-brand-textMuted'}>{value.length}/{field.max}</span>}
          {!isDefault && field.type !== 'faq' && (
            <button onClick={onRestore} className="inline-flex items-center gap-1 text-brand-textMuted hover:text-brand-heading" title="Put back the original wording">
              <RotateCcw className="h-3 w-3" /> Original
            </button>
          )}
        </div>
      </div>

      {field.type === 'faq' ? (
        <FaqEditor value={value} onChange={onChange} />
      ) : field.type === 'image' ? (
        <UploadField kind="blog" value={value} onChange={onChange} upload={upload} />
      ) : field.type === 'textarea' || field.type === 'lines' ? (
        <textarea id={field.key} value={value} onChange={(e) => onChange(e.target.value)}
          rows={field.type === 'lines' ? 4 : Math.min(8, Math.max(2, Math.ceil(value.length / 90)))}
          className="field-input leading-relaxed" />
      ) : (
        <input id={field.key} value={value} onChange={(e) => onChange(e.target.value)}
          type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
          placeholder={field.type === 'url' ? 'https://… or /page' : undefined}
          className="field-input" />
      )}

      {field.help && <p className="mt-1 text-[0.6875rem] text-brand-textMuted">{field.help}</p>}
      {over && <p className="mt-1 text-[0.6875rem] text-action">Search engines cut this off after {field.max} characters.</p>}
      {error && <p className="mt-1 text-[0.75rem] text-action">{error}</p>}
    </div>
  );
}

function FaqEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const items = parseFaqsLoose(value);
  const write = (next: FaqEntry[]) => onChange(JSON.stringify(next));
  const update = (i: number, patch: Partial<FaqEntry>) => write(items.map((f, n) => (n === i ? { ...f, ...patch } : f)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    write(next);
  };
  const categories = Array.from(new Set(items.map((f) => f.category).filter(Boolean)));

  return (
    <div className="space-y-3">
      <datalist id="faq-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
      {items.map((f, i) => (
        <div key={i} className="space-y-2 border border-brand-border bg-brand-dark p-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[0.6875rem] text-brand-textMuted">{i + 1}</span>
            <input list="faq-categories" value={f.category} onChange={(e) => update(i, { category: e.target.value })}
              placeholder="Group, e.g. Shipping" className="field-input min-h-8 max-w-xs py-1 text-xs" />
            <div className="ml-auto flex">
              <button onClick={() => move(i, -1)} title="Move up" className="p-1.5 text-brand-textMuted hover:text-brand-heading"><ArrowUp className="h-3.5 w-3.5" /></button>
              <button onClick={() => move(i, 1)} title="Move down" className="p-1.5 text-brand-textMuted hover:text-brand-heading"><ArrowDown className="h-3.5 w-3.5" /></button>
              <button onClick={() => write(items.filter((_, n) => n !== i))} title="Remove" className="p-1.5 text-brand-textMuted hover:text-action"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
          <input value={f.question} onChange={(e) => update(i, { question: e.target.value })} placeholder="Question" className="field-input font-semibold" />
          <textarea value={f.answer} onChange={(e) => update(i, { answer: e.target.value })} placeholder="Answer" rows={3} className="field-input" />
        </div>
      ))}
      <button className="btn-secondary" onClick={() => write([...items, { category: categories[0] ?? '', question: '', answer: '' }])}>
        <Plus className="h-3.5 w-3.5" /> Add a question
      </button>
      <p className="text-[0.6875rem] text-brand-textMuted">Questions with no answer are not saved.</p>
    </div>
  );
}

/** Like parseFaqs, but keeps half-typed rows so they do not vanish while editing. */
function parseFaqsLoose(value: string): FaqEntry[] {
  try {
    const list = JSON.parse(value || '[]');
    return Array.isArray(list)
      ? list.map((f) => ({ category: String(f?.category ?? ''), question: String(f?.question ?? ''), answer: String(f?.answer ?? '') }))
      : parseFaqs(value);
  } catch {
    return [];
  }
}

export function SearchPreview({ title, description, url }: { title: string; description: string; url?: string }) {
  const host = typeof window !== 'undefined' ? window.location.host : '';
  return (
    <div className="border border-brand-border bg-white p-4">
      <p className="mb-2 text-[0.625rem] font-bold uppercase tracking-[0.12em] text-neutral-500">How it can look on Google</p>
      <p className="truncate text-[0.75rem] text-neutral-600">{url ?? host}</p>
      <p className="truncate text-lg leading-snug text-[#1a0dab]">{title.length > 60 ? `${title.slice(0, 59)}…` : title || 'Page title'}</p>
      <p className="line-clamp-2 text-[0.8125rem] leading-snug text-neutral-700">
        {description.length > 160 ? `${description.slice(0, 159)}…` : description || 'Page description'}
      </p>
    </div>
  );
}
