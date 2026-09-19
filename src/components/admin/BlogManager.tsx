'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bold, Copy, Download, ExternalLink, Eye, Heading2, ImagePlus, Italic, Link2, List, ListOrdered,
  Loader2, Pencil, Plus, Quote, RefreshCw, Search, Trash2, Upload, X,
} from 'lucide-react';
import RichText from '@/components/RichText';
import { downloadBlob } from '@/lib/sheetFiles';
import { SearchPreview } from './SiteContentEditor';
import UploadField, { type UploadKind } from './UploadField';

/**
 * Storefront > Blog.
 *
 * Posts with their own SEO and AI-answer fields, a picture library to upload,
 * reuse and download images, and a live preview in the site's own formatting.
 */

type Fetcher = (path: string, init?: RequestInit) => Promise<Response>;

interface Article {
  id?: string;
  slug: string; title: string; excerpt: string; content: string; category: string; author: string;
  image: string | null; tags: string[]; read_time: string; is_published: boolean; published_at: string | null;
  created_at?: string;
  meta_title?: string | null; meta_description?: string | null; keywords?: string[]; canonical_url?: string | null;
  og_image?: string | null; image_alt?: string | null; faq?: { question: string; answer: string }[]; noindex?: boolean;
}

interface LibraryFile { name: string; url: string; bytes: number; createdAt: string | null }

const blank = (): Article => ({
  slug: '', title: '', excerpt: '', content: '', category: 'Research', author: '', image: null, tags: [],
  read_time: '', is_published: false, published_at: null, meta_title: '', meta_description: '', keywords: [],
  canonical_url: '', og_image: null, image_alt: '', faq: [], noindex: false,
});

const statusOf = (a: Article) => {
  if (!a.is_published) return { label: 'Draft', cls: 'border border-brand-borderLight text-brand-textMuted' };
  if (a.published_at && new Date(a.published_at).getTime() > Date.now()) return { label: 'Scheduled', cls: 'bg-navy text-cream' };
  return { label: 'Live', cls: 'bg-brand-accent text-brand-onAccent' };
};

const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export default function BlogManager({ authedFetch, upload }: { authedFetch: Fetcher; upload: (file: File, kind: UploadKind) => Promise<string> }) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [seoReady, setSeoReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Article | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await authedFetch('/api/admin/articles/editor');
      const p = await res.json();
      if (!res.ok) throw new Error(p?.message ?? 'Could not load the blog.');
      setArticles(p.data.articles); setSeoReady(p.data.seoReady);
    } catch (err) {
      const m = err instanceof Error ? err.message : 'Could not load the blog.';
      if (m !== 'denied') setError(m);
    } finally { setLoading(false); }
  }, [authedFetch]);

  useEffect(() => { void load(); }, [load]);

  const remove = async (a: Article) => {
    if (!window.confirm(`Delete "${a.title}"? It comes off the website straight away.`)) return;
    const res = await authedFetch(`/api/admin/articles/editor?id=${encodeURIComponent(a.id!)}`, { method: 'DELETE' });
    if (res.ok) setArticles((prev) => prev.filter((x) => x.id !== a.id));
    else setError((await res.json().catch(() => null))?.message ?? 'Delete failed.');
  };

  const visible = articles.filter((a) => !query.trim() || `${a.title} ${a.category} ${a.tags?.join(' ')}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="space-y-4">
      {!seoReady && (
        <p className="border border-action/50 bg-brand-card p-3 text-xs text-brand-body">
          Posts work now. To store each post&apos;s SEO fields, run <strong>supabase/migrations/0015_blog_seo.sql</strong> in the Supabase SQL editor.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-textMuted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a post" className="field-input pl-8" />
        </div>
        <button className="btn-secondary" onClick={() => setLibraryOpen(true)}><ImagePlus className="h-3.5 w-3.5" /> Picture library</button>
        <button className="btn-secondary" onClick={() => void load()}><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
        <button className="btn-primary px-4 py-2" onClick={() => setEditing(blank())}><Plus className="h-3.5 w-3.5" /> New post</button>
      </div>

      {error && <p className="border border-action/50 bg-brand-card p-3 text-xs text-brand-body">{error}</p>}

      {visible.length === 0 ? (
        <p className="border border-brand-border bg-brand-card p-10 text-center text-xs text-brand-textMuted">
          {loading ? 'Loading…' : articles.length ? 'No posts match.' : 'No posts in the dashboard yet. The website shows the built-in starter articles until you publish your first one.'}
        </p>
      ) : (
        <div className="divide-y divide-brand-border border border-brand-border bg-brand-card">
          {visible.map((a) => {
            const s = statusOf(a);
            return (
              <div key={a.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="h-14 w-20 flex-shrink-0 border border-brand-border bg-brand-dark">
                  {a.image && <img src={a.image} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <button onClick={() => setEditing({ ...blank(), ...a })} className="block truncate text-left font-semibold text-brand-heading hover:underline">{a.title}</button>
                  <p className="truncate text-[0.75rem] text-brand-textMuted">
                    {a.category} · /blog/{a.slug}{a.published_at ? ` · ${new Date(a.published_at).toLocaleDateString()}` : ''}
                  </p>
                </div>
                <span className={`chip ${s.cls}`}>{s.label}</span>
                <div className="flex items-center gap-1">
                  {s.label === 'Live' && (
                    <a href={`/blog/${a.slug}`} target="_blank" rel="noopener noreferrer" title="Open on the website" className="p-1.5 text-brand-textMuted hover:text-brand-heading">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <button onClick={() => setEditing({ ...blank(), ...a })} className="btn-secondary px-2 py-1"><Pencil className="h-3 w-3" /> Edit</button>
                  <button onClick={() => void remove(a)} title="Delete" className="p-1.5 text-brand-textMuted hover:text-action"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <PostEditor
          initial={editing}
          seoReady={seoReady}
          authedFetch={authedFetch}
          upload={upload}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load(); }}
        />
      )}

      {libraryOpen && <PictureLibrary authedFetch={authedFetch} upload={upload} onClose={() => setLibraryOpen(false)} />}
    </div>
  );
}

/* ------------------------------------------------------------ editor ---- */

function PostEditor({ initial, seoReady, authedFetch, upload, onClose, onSaved }: {
  initial: Article; seoReady: boolean; authedFetch: Fetcher;
  upload: (file: File, kind: UploadKind) => Promise<string>;
  onClose: () => void; onSaved: () => void;
}) {
  const [a, setA] = useState<Article>(initial);
  const [tab, setTab] = useState<'write' | 'preview' | 'seo'>('write');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [picker, setPicker] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const set = (patch: Partial<Article>) => setA((prev) => ({ ...prev, ...patch }));

  /** Wrap the selection, or insert at the cursor, keeping focus in the box. */
  const wrap = (before: string, after = '', placeholder = '') => {
    const el = textRef.current;
    const text = a.content;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const selected = text.slice(start, end) || placeholder;
    const next = text.slice(0, start) + before + selected + after + text.slice(end);
    set({ content: next });
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };
  const linePrefix = (prefix: string) => wrap(`\n${prefix}`, '', 'text');

  const insertImage = (url: string, alt = 'Picture') => { wrap(`\n![${alt}](${url})\n`); setPicker(false); };

  const save = async () => {
    setBusy(true); setError(''); setFieldErrors({});
    const body: Record<string, unknown> = {
      ...a,
      tags: a.tags,
      published_at: a.published_at,
    };
    if (!seoReady) for (const k of ['meta_title', 'meta_description', 'keywords', 'canonical_url', 'og_image', 'image_alt', 'faq', 'noindex']) delete body[k];
    try {
      const res = await authedFetch('/api/admin/articles/editor', { method: a.id ? 'PATCH' : 'POST', body: JSON.stringify(body) });
      const p = await res.json().catch(() => null);
      if (!res.ok) { setError(p?.message ?? 'Could not save.'); setFieldErrors(p?.fields ?? {}); return; }
      if (p?.data?.notice) window.alert(p.data.notice);
      onSaved();
    } catch { setError('Could not save.'); }
    finally { setBusy(false); }
  };

  const fe = (k: string) => fieldErrors[k] && <p className="mt-1 text-[0.75rem] text-action">{fieldErrors[k]}</p>;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const tool = 'inline-flex h-8 w-8 items-center justify-center text-brand-body hover:bg-brand-dark hover:text-brand-heading';

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/60 p-2 sm:p-6" role="dialog" aria-modal="true" aria-label="Edit post">
      <div className="mx-auto max-w-5xl border border-brand-border bg-brand-card">
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-brand-border bg-brand-card px-4 py-3">
          <div className="flex gap-1">
            {([['write', 'Write'], ['preview', 'Preview'], ['seo', 'SEO & AI answers']] as const).map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`chip px-3 py-1.5 ${tab === id ? 'bg-brand-accent text-brand-onAccent' : 'text-brand-body hover:text-brand-heading'}`}>
                {id === 'preview' && <Eye className="h-3 w-3" />}{label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-brand-body">
              <input type="checkbox" checked={a.is_published} onChange={(e) => set({ is_published: e.target.checked })} /> Publish
            </label>
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary px-4 py-2" disabled={busy} onClick={() => void save()}>
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
            </button>
          </div>
        </div>

        {error && <p className="m-4 border border-action/50 p-3 text-xs text-brand-body">{error}</p>}

        {tab === 'write' && (
          <div className="grid grid-cols-1 gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
            <div className="space-y-4">
              <label className="block">
                <span className="field-label">Title</span>
                <input className="field-input text-base font-semibold" value={a.title} onChange={(e) => set({ title: e.target.value })} />
                {fe('title')}
              </label>
              <label className="block">
                <span className="field-label">Short introduction (shown on the blog list)</span>
                <textarea className="field-input" rows={2} value={a.excerpt} onChange={(e) => set({ excerpt: e.target.value })} />
              </label>
              <div>
                <span className="field-label">Post</span>
                <div className="flex flex-wrap items-center border border-b-0 border-brand-border bg-brand-card">
                  <button type="button" title="Heading" className={tool} onClick={() => linePrefix('## ')}><Heading2 className="h-4 w-4" /></button>
                  <button type="button" title="Bold" className={tool} onClick={() => wrap('**', '**', 'bold text')}><Bold className="h-4 w-4" /></button>
                  <button type="button" title="Italic" className={tool} onClick={() => wrap('*', '*', 'italic text')}><Italic className="h-4 w-4" /></button>
                  <button type="button" title="Bullet list" className={tool} onClick={() => linePrefix('- ')}><List className="h-4 w-4" /></button>
                  <button type="button" title="Numbered list" className={tool} onClick={() => linePrefix('1. ')}><ListOrdered className="h-4 w-4" /></button>
                  <button type="button" title="Quote" className={tool} onClick={() => linePrefix('> ')}><Quote className="h-4 w-4" /></button>
                  <button type="button" title="Link" className={tool} onClick={() => {
                    const url = window.prompt('Link address (https://… or /page)');
                    if (url) wrap('[', `](${url})`, 'link text');
                  }}><Link2 className="h-4 w-4" /></button>
                  <button type="button" title="Picture" className={tool} onClick={() => setPicker(true)}><ImagePlus className="h-4 w-4" /></button>
                  <span className="ml-auto px-2 text-[0.6875rem] text-brand-textMuted">
                    {a.content.split(/\s+/).filter(Boolean).length} words
                  </span>
                </div>
                <textarea ref={textRef} className="field-input min-h-[24rem] font-mono text-[0.8125rem] leading-relaxed" value={a.content}
                  onChange={(e) => set({ content: e.target.value })}
                  placeholder={'## A heading\n\nA paragraph. **Bold**, *italic*, [a link](https://example.com).\n\n- a bullet\n- another'} />
              </div>
            </div>

            <aside className="space-y-4">
              <div>
                <span className="field-label">Header picture</span>
                <UploadField kind="blog" value={a.image ?? ''} onChange={(url) => set({ image: url || null })} upload={upload} />
                {fe('image')}
              </div>
              <label className="block">
                <span className="field-label">Picture description (for Google and screen readers)</span>
                <input className="field-input" value={a.image_alt ?? ''} disabled={!seoReady} onChange={(e) => set({ image_alt: e.target.value })} />
              </label>
              <label className="block">
                <span className="field-label">Web address</span>
                <input className="field-input font-mono text-xs" value={a.slug} placeholder="built from the title" onChange={(e) => set({ slug: e.target.value })} />
                <span className="mt-1 block truncate text-[0.6875rem] text-brand-textMuted">{origin}/blog/{a.slug || '…'}</span>
                {fe('slug')}
              </label>
              <label className="block">
                <span className="field-label">Category</span>
                <input className="field-input" value={a.category} onChange={(e) => set({ category: e.target.value })} />
              </label>
              <label className="block">
                <span className="field-label">Author</span>
                <input className="field-input" value={a.author} onChange={(e) => set({ author: e.target.value })} />
              </label>
              <label className="block">
                <span className="field-label">Tags (comma separated)</span>
                <input className="field-input" value={a.tags.join(', ')} onChange={(e) => set({ tags: e.target.value.split(',').map((t) => t.trimStart()) })} />
              </label>
              <label className="block">
                <span className="field-label">Reading time</span>
                <input className="field-input" value={a.read_time} placeholder="worked out for you" onChange={(e) => set({ read_time: e.target.value })} />
              </label>
              <label className="block">
                <span className="field-label">Publish date</span>
                <input type="datetime-local" className="field-input" value={toLocalInput(a.published_at)}
                  onChange={(e) => set({ published_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
                <span className="mt-1 block text-[0.6875rem] text-brand-textMuted">A future date keeps it hidden until then.</span>
                {fe('published_at')}
              </label>
            </aside>
          </div>
        )}

        {tab === 'preview' && (
          <article className="mx-auto max-w-3xl space-y-5 p-6">
            <p className="text-xs text-brand-textMuted">{a.category} · {a.read_time || 'reading time added on save'}</p>
            <h1 className="page-title">{a.title || 'Untitled post'}</h1>
            {a.image && <img src={a.image} alt={a.image_alt ?? ''} className="aspect-video w-full border border-brand-border object-cover" />}
            {a.excerpt && <p className="border border-brand-border bg-brand-dark p-4 text-sm text-brand-body">{a.excerpt}</p>}
            <RichText text={a.content} className="text-sm leading-relaxed text-brand-body" />
          </article>
        )}

        {tab === 'seo' && (
          <div className="space-y-5 p-4">
            {!seoReady && (
              <p className="border border-action/50 p-3 text-xs text-brand-body">
                Run migration 0015_blog_seo.sql to save these fields. Until then the page title and introduction are used.
              </p>
            )}
            <SearchPreview
              title={(a.meta_title || a.title || '')}
              description={a.meta_description || a.excerpt}
              url={`${origin.replace(/^https?:\/\//, '')} › blog › ${a.slug || '…'}`}
            />
            <fieldset disabled={!seoReady} className="grid grid-cols-1 gap-4 disabled:opacity-60 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="field-label">Google title <span className="normal-case">({(a.meta_title ?? '').length}/60, blank = post title)</span></span>
                <input className="field-input" value={a.meta_title ?? ''} onChange={(e) => set({ meta_title: e.target.value })} />
              </label>
              <label className="block md:col-span-2">
                <span className="field-label">Google description <span className="normal-case">({(a.meta_description ?? '').length}/160, blank = introduction)</span></span>
                <textarea className="field-input" rows={3} value={a.meta_description ?? ''} onChange={(e) => set({ meta_description: e.target.value })} />
              </label>
              <label className="block">
                <span className="field-label">Keywords (comma separated)</span>
                <input className="field-input" value={(a.keywords ?? []).join(', ')} onChange={(e) => set({ keywords: e.target.value.split(',').map((t) => t.trimStart()) })} />
              </label>
              <label className="block">
                <span className="field-label">Original address, if copied from elsewhere</span>
                <input className="field-input" placeholder="https://…" value={a.canonical_url ?? ''} onChange={(e) => set({ canonical_url: e.target.value })} />
                {fe('canonical_url')}
              </label>
              <div>
                <span className="field-label">Share picture (blank = header picture)</span>
                <UploadField kind="blog" value={a.og_image ?? ''} onChange={(url) => set({ og_image: url || null })} upload={upload} />
              </div>
              <label className="flex items-start gap-2 text-xs text-brand-body">
                <input type="checkbox" className="mt-0.5" checked={Boolean(a.noindex)} onChange={(e) => set({ noindex: e.target.checked })} />
                Hide this post from Google (it stays on the website).
              </label>
            </fieldset>

            <fieldset disabled={!seoReady} className="space-y-3 border border-brand-border p-4 disabled:opacity-60">
              <legend className="px-2 font-display text-xs font-extrabold uppercase tracking-[0.08em] text-brand-heading">Questions this post answers</legend>
              <p className="text-[0.75rem] text-brand-textMuted">
                Shown at the end of the post and published in the page code as FAQ data — the format ChatGPT, Google AI answers and voice assistants quote from.
              </p>
              {(a.faq ?? []).map((f, i) => (
                <div key={i} className="space-y-2 border border-brand-border bg-brand-dark p-3">
                  <div className="flex gap-2">
                    <input className="field-input font-semibold" placeholder="Question" value={f.question}
                      onChange={(e) => set({ faq: (a.faq ?? []).map((x, n) => (n === i ? { ...x, question: e.target.value } : x)) })} />
                    <button type="button" title="Remove" onClick={() => set({ faq: (a.faq ?? []).filter((_, n) => n !== i) })} className="p-2 text-brand-textMuted hover:text-action"><X className="h-4 w-4" /></button>
                  </div>
                  <textarea className="field-input" rows={2} placeholder="Answer, in one or two plain sentences" value={f.answer}
                    onChange={(e) => set({ faq: (a.faq ?? []).map((x, n) => (n === i ? { ...x, answer: e.target.value } : x)) })} />
                </div>
              ))}
              <button type="button" className="btn-secondary" onClick={() => set({ faq: [...(a.faq ?? []), { question: '', answer: '' }] })}>
                <Plus className="h-3.5 w-3.5" /> Add a question
              </button>
            </fieldset>
          </div>
        )}
      </div>

      {picker && (
        <PictureLibrary authedFetch={authedFetch} upload={upload} onClose={() => setPicker(false)} onPick={(f) => insertImage(f.url, f.name.replace(/-[a-z0-9]+-[a-z0-9]+\.\w+$/, '').replace(/-/g, ' '))} />
      )}
    </div>
  );
}

/* ----------------------------------------------------------- library ---- */

function PictureLibrary({ authedFetch, upload, onClose, onPick }: {
  authedFetch: Fetcher;
  upload: (file: File, kind: UploadKind) => Promise<string>;
  onClose: () => void;
  onPick?: (file: LibraryFile) => void;
}) {
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authedFetch('/api/admin/upload?kind=blog');
      const p = await res.json();
      if (!res.ok) throw new Error(p?.message ?? 'Could not load pictures.');
      setFiles(p.data.files);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load pictures.');
    } finally { setLoading(false); }
  }, [authedFetch]);

  useEffect(() => { void load(); }, [load]);

  const add = async (list: FileList | null) => {
    if (!list?.length) return;
    setError('');
    for (const file of Array.from(list)) {
      setBusy(`Uploading ${file.name}…`);
      try { await upload(file, 'blog'); } catch (err) { setError(err instanceof Error ? err.message : 'Upload failed.'); }
    }
    setBusy('');
    if (input.current) input.current.value = '';
    void load();
  };

  const download = async (f: LibraryFile) => {
    const blob = await (await fetch(f.url)).blob();
    downloadBlob(blob, f.name);
  };

  const copy = async (f: LibraryFile) => {
    try { await navigator.clipboard.writeText(f.url); setCopied(f.name); setTimeout(() => setCopied(''), 1500); } catch { /* ignore */ }
  };

  return (
    <div className="fixed inset-0 z-[110] overflow-y-auto bg-black/60 p-3 sm:p-8" role="dialog" aria-modal="true" aria-label="Picture library">
      <div className="mx-auto max-w-4xl border border-brand-border bg-brand-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-border px-4 py-3">
          <h2 className="font-display text-sm font-extrabold uppercase tracking-[0.08em] text-brand-heading">
            Picture library {onPick && <span className="normal-case text-brand-textMuted">— click one to add it to the post</span>}
          </h2>
          <div className="flex items-center gap-2">
            <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif,image/gif" className="hidden" onChange={(e) => void add(e.target.files)} />
            <button className="btn-primary px-3 py-2" onClick={() => input.current?.click()} disabled={Boolean(busy)}>
              <Upload className="h-3.5 w-3.5" /> Upload pictures
            </button>
            <button onClick={onClose} aria-label="Close" className="p-1 text-brand-textMuted hover:text-brand-heading"><X className="h-5 w-5" /></button>
          </div>
        </div>
        <div className="space-y-3 p-4">
          <p className="text-[0.75rem] text-brand-textMuted">JPG, PNG, WEBP, AVIF or GIF, up to 2 MB each.</p>
          {busy && <p className="flex items-center gap-2 text-xs text-brand-textMuted"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {busy}</p>}
          {error && <p className="border border-action/50 p-2 text-xs text-brand-body">{error}</p>}
          {loading ? <p className="text-xs text-brand-textMuted">Loading…</p> : files.length === 0 ? (
            <p className="p-8 text-center text-xs text-brand-textMuted">No pictures yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {files.map((f) => (
                <div key={f.name} className="border border-brand-border bg-brand-dark">
                  <button onClick={() => onPick?.(f)} disabled={!onPick} className={`block aspect-[4/3] w-full bg-white ${onPick ? 'hover:opacity-80' : 'cursor-default'}`}>
                    <img src={f.url} alt="" loading="lazy" className="h-full w-full object-contain" />
                  </button>
                  <div className="flex items-center gap-1 p-1.5">
                    <span className="min-w-0 flex-1 truncate text-[0.625rem] text-brand-textMuted" title={f.name}>
                      {f.bytes ? `${Math.round(f.bytes / 1024)} KB` : f.name}
                    </span>
                    <button title="Copy link" onClick={() => void copy(f)} className="p-1 text-brand-textMuted hover:text-brand-heading">
                      {copied === f.name ? <span className="text-[0.625rem]">Copied</span> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                    <button title="Download" onClick={() => void download(f)} className="p-1 text-brand-textMuted hover:text-brand-heading"><Download className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
