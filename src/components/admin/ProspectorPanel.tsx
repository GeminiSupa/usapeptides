'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark, Check, CheckSquare, Download, ExternalLink, Globe, Loader2, Mail, MapPin, MessageCircle,
  Phone, RefreshCw, Search, Square, Target, Trash2, Upload, UserPlus, X,
} from 'lucide-react';
import ProspectMap, { type MapPin as Pin } from './ProspectMap';
import { BUSINESS } from '@/lib/env';
import { cleanWhatsAppNumber, isValidWhatsAppNumber } from '@/lib/whatsapp';
import { exportSheet, readSpreadsheet, stamp, type SheetFormat } from '@/lib/sheetFiles';
import {
  OUTREACH_TEMPLATES, PROSPECT_STAGES, SEARCH_PROFILES, fillTemplate, fitBand, stageLabel,
  type ProspectPlace,
} from '@/lib/prospector';

/**
 * Prospector: find businesses on a free map, save the good ones, and work them
 * through a pipeline — WhatsApp, email and call from the same screen, notes and
 * follow-up dates on each, and one click to copy a warm one into Leads.
 */

type Fetcher = (path: string, init?: RequestInit) => Promise<Response>;

interface Saved {
  id: string; company: string; contact_name: string | null; email: string | null; phone: string | null;
  website: string | null; segment: string | null; stage: string; next_action: string | null; next_action_at: string | null;
  created_at: string; category?: string | null; formatted_address?: string | null; city?: string | null; region?: string | null;
  latitude?: number | null; longitude?: number | null; map_url?: string | null; whatsapp?: string | null;
  fit_score?: number; fit_reasons?: string[]; notes?: string | null; tags?: string[]; owner_id?: string | null;
  last_contacted_at?: string | null; lead_id?: string | null; source_external_id?: string | null;
}

interface Activity { id: string; activity: string; body: string | null; actor: string | null; created_at: string }
interface TeamMember { id: string; name: string }

const keyOf = (p: ProspectPlace) => p.source_external_id ?? `${p.company}|${p.latitude}|${p.longitude}`;
const TONE_CHIP = { high: 'bg-brand-accent text-brand-onAccent', medium: 'bg-navy text-cream', low: 'border border-brand-borderLight text-brand-textMuted' };

export default function ProspectorPanel({ authedFetch, me }: { authedFetch: Fetcher; me: { id: string; fullName: string | null; email: string } }) {
  const [tab, setTab] = useState<'find' | 'pipeline'>('find');

  /* ------------------------------------------------------------ search -- */
  const [query, setQuery] = useState('research labs');
  const [location, setLocation] = useState('');
  const [results, setResults] = useState<ProspectPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchNote, setSearchNote] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [focus, setFocus] = useState<{ latitude: number; longitude: number } | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [selectedResult, setSelectedResult] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  /* ---------------------------------------------------------- pipeline -- */
  const [saved, setSaved] = useState<Saved[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [stageFilter, setStageFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [text, setText] = useState('');
  const [dueOnly, setDueOnly] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [saveOwner, setSaveOwner] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authedFetch('/api/admin/prospects/pipeline');
      const p = await res.json();
      if (!res.ok) throw new Error(p?.message ?? 'Could not load saved prospects.');
      setSaved(p.data.prospects); setTeam(p.data.team);
      setNotice((n) => p.data.notice ?? (n.includes('0016') ? '' : n));
    } catch (err) {
      const m = err instanceof Error ? err.message : 'Could not load saved prospects.';
      if (m !== 'denied') setError(m);
    } finally { setLoading(false); }
  }, [authedFetch]);

  useEffect(() => { void load(); }, [load]);

  const savedKeys = useMemo(() => {
    const s = new Set<string>();
    for (const p of saved) {
      if (p.source_external_id) s.add(p.source_external_id);
      s.add(`${p.company.toLowerCase()}|${(p.city ?? '').toLowerCase()}`);
    }
    return s;
  }, [saved]);
  const isSaved = (p: ProspectPlace) =>
    Boolean((p.source_external_id && savedKeys.has(p.source_external_id)) || savedKeys.has(`${p.company.toLowerCase()}|${(p.city ?? '').toLowerCase()}`));

  const runSearch = async (bbox?: { south: number; west: number; north: number; east: number }) => {
    if (query.trim().length < 2) { setSearchNote('Type the kind of business to look for.'); return; }
    if (!bbox && !location.trim()) { setSearchNote('Type a city or area — or move the map and press "Search this area".'); return; }
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setSearching(true); setSearchNote('Searching the map…'); setWarnings([]); setResults([]); setPicked(new Set()); setSelectedResult(null);
    try {
      const res = await authedFetch('/api/admin/prospects/search', {
        method: 'POST',
        body: JSON.stringify({ query, location: bbox ? '' : location, bbox }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const p = await res.json().catch(() => null);
        throw new Error(p?.message ?? 'Search failed.');
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          const e = JSON.parse(line);
          if (e.type === 'meta') {
            setFocus(e.center ?? null);
            setSearchNote(`${e.profile ? `Looking for ${e.profile.toLowerCase()}` : `Looking for "${query}"`}${e.area ? ` in ${e.area}` : ''}${e.categorySearch ? ' — the full list can take up to 30 seconds…' : '…'}`);
          } else if (e.type === 'partial') {
            setResults(e.prospects);
          } else if (e.type === 'complete') {
            setResults(e.prospects);
            setWarnings(e.warnings ?? []);
            setSearchNote(e.prospects.length ? `${e.prospects.length} businesses found.` : 'Nothing found. Try another business type, a bigger city, or move the map.');
          } else if (e.type === 'error') {
            throw new Error(e.message);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setSearchNote(err instanceof Error ? err.message : 'Search failed.');
    } finally {
      setSearching(false);
    }
  };

  const savePlaces = async (places: ProspectPlace[]) => {
    if (!places.length) return;
    setError('');
    try {
      const res = await authedFetch('/api/admin/prospects/pipeline', {
        method: 'POST', body: JSON.stringify({ places, ownerId: saveOwner || undefined }),
      });
      const p = await res.json().catch(() => null);
      if (!res.ok) throw new Error(p?.message ?? 'Could not save.');
      setNotice([`Saved ${p.data.saved}.`, p.data.duplicates ? `${p.data.duplicates} already saved.` : '', p.data.notice ?? ''].filter(Boolean).join(' '));
      setPicked(new Set());
      void load();
    } catch (err) {
      const m = err instanceof Error ? err.message : 'Could not save.';
      if (m !== 'denied') setError(m);
    }
  };

  /* --------------------------------------------------------- pipeline -- */

  const now = Date.now();
  const visibleSaved = useMemo(() => saved.filter((p) => {
    if (stageFilter !== 'all' && p.stage !== stageFilter) return false;
    if (ownerFilter === 'mine' && p.owner_id !== me.id) return false;
    if (ownerFilter === 'none' && p.owner_id) return false;
    if (!['all', 'mine', 'none'].includes(ownerFilter) && p.owner_id !== ownerFilter) return false;
    if (dueOnly && !(p.next_action_at && new Date(p.next_action_at).getTime() <= now + 86_400_000)) return false;
    if (text.trim()) {
      const q = text.toLowerCase();
      if (![p.company, p.city, p.category, p.segment, p.email, p.contact_name, p.notes].some((v) => String(v ?? '').toLowerCase().includes(q))) return false;
    }
    return true;
  }).sort((a, b) => (Number(b.fit_score ?? 0) - Number(a.fit_score ?? 0)) || a.company.localeCompare(b.company)),
  [saved, stageFilter, ownerFilter, dueOnly, text, me.id, now]);

  const stageCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of saved) c[p.stage] = (c[p.stage] ?? 0) + 1;
    return c;
  }, [saved]);

  const patch = async (ids: string[], changes: Record<string, unknown>) => {
    setError('');
    const res = await authedFetch('/api/admin/prospects/pipeline', { method: 'PATCH', body: JSON.stringify({ ids, changes }) });
    const p = await res.json().catch(() => null);
    if (!res.ok) { setError(p?.message ?? 'Could not update.'); return false; }
    setSaved((prev) => prev.map((x) => (ids.includes(x.id) ? { ...x, ...changes } as Saved : x)));
    return true;
  };

  const remove = async (ids: string[]) => {
    if (!ids.length || !window.confirm(`Delete ${ids.length === 1 ? 'this prospect' : `${ids.length} prospects`}? Their notes go too.`)) return;
    const res = await authedFetch(`/api/admin/prospects/pipeline?ids=${ids.map(encodeURIComponent).join(',')}`, { method: 'DELETE' });
    if (!res.ok) { setError((await res.json().catch(() => null))?.message ?? 'Delete failed.'); return; }
    setSaved((prev) => prev.filter((x) => !ids.includes(x.id)));
    setChecked(new Set());
    if (openId && ids.includes(openId)) setOpenId(null);
  };

  const doExport = async (format: SheetFormat) => {
    const rows = visibleSaved;
    const owner = (id?: string | null) => team.find((t) => t.id === id)?.name ?? '';
    const full = format !== 'pdf';
    const headers = full
      ? ['Business', 'Category', 'Stage', 'Fit', 'Contact', 'Email', 'Phone', 'WhatsApp', 'Website', 'Address', 'City', 'State', 'Owner', 'Next follow-up', 'Notes', 'Latitude', 'Longitude']
      : ['Business', 'Category', 'Stage', 'Fit', 'Email', 'Phone', 'City', 'Owner'];
    await exportSheet(format, {
      filename: `prospects-${stamp()}`,
      title: 'Prospects',
      headers,
      rows: rows.map((p) => full
        ? [p.company, p.category ?? p.segment ?? '', stageLabel(p.stage), p.fit_score ?? '', p.contact_name ?? '', p.email ?? '', p.phone ?? '',
          p.whatsapp ?? '', p.website ?? '', p.formatted_address ?? '', p.city ?? '', p.region ?? '', owner(p.owner_id),
          p.next_action_at ? p.next_action_at.slice(0, 10) : '', p.notes ?? '', p.latitude ?? '', p.longitude ?? '']
        : [p.company, p.category ?? p.segment ?? '', stageLabel(p.stage), p.fit_score ?? '', p.email ?? '', p.phone ?? '', p.city ?? '', owner(p.owner_id)]),
    });
  };

  const doImport = async (file?: File) => {
    if (!file) return;
    setError(''); setNotice('Reading the file…');
    try {
      const raw = await readSpreadsheet(file);
      const pick = (r: Record<string, unknown>, ...names: string[]) => {
        const entry = Object.entries(r).find(([k]) => names.includes(k.toLowerCase().trim()));
        return entry ? String(entry[1] ?? '') : '';
      };
      const places = raw.map((r) => ({
        company: pick(r, 'business', 'company', 'name', 'organization', 'organisation'),
        category: pick(r, 'category', 'type', 'segment'),
        contact_name: pick(r, 'contact', 'contact name', 'person'),
        email: pick(r, 'email', 'e-mail'),
        phone: pick(r, 'phone', 'telephone', 'tel'),
        whatsapp: pick(r, 'whatsapp'),
        website: pick(r, 'website', 'web', 'url'),
        address: pick(r, 'address', 'formatted address', 'street'),
        city: pick(r, 'city', 'town'),
        state: pick(r, 'state', 'region', 'province'),
        country: pick(r, 'country'),
        notes: pick(r, 'notes', 'note', 'comments'),
        latitude: pick(r, 'latitude', 'lat'),
        longitude: pick(r, 'longitude', 'lng', 'lon'),
        stage: PROSPECT_STAGES.find((s) => s.label.toLowerCase() === pick(r, 'stage', 'status').toLowerCase())?.id,
        source_provider: 'import',
      })).filter((p) => p.company);
      if (!places.length) throw new Error('No column called Business, Company or Name was found.');
      await savePlaces(places as unknown as ProspectPlace[]);
    } catch (err) {
      setNotice('');
      setError(err instanceof Error ? err.message : 'Import failed.');
    }
    if (importRef.current) importRef.current.value = '';
  };

  /* ------------------------------------------------------------- pins --- */

  const pins: Pin[] = tab === 'find'
    ? results.filter((p) => p.latitude != null && p.longitude != null).map((p) => ({
      key: keyOf(p), label: p.company, latitude: p.latitude!, longitude: p.longitude!,
      tone: isSaved(p) ? 'saved' : fitBand(p.fit_score).tone,
    }))
    : visibleSaved.filter((p) => p.latitude != null && p.longitude != null).map((p) => ({
      key: p.id, label: p.company, latitude: p.latitude!, longitude: p.longitude!, tone: fitBand(p.fit_score ?? 0).tone,
    }));

  const open = saved.find((p) => p.id === openId) ?? null;
  const selResult = results.find((p) => keyOf(p) === selectedResult) ?? null;
  const allPicked = results.length > 0 && results.every((p) => picked.has(keyOf(p)) || isSaved(p));

  /* ------------------------------------------------------------- view --- */

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1 border-b border-brand-border">
        {([['find', 'Find businesses', Search], ['pipeline', `Pipeline (${saved.length})`, Target]] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 font-display text-[0.8125rem] font-extrabold uppercase tracking-[0.1em] ${
              tab === id ? 'border-brand-accent text-brand-heading' : 'border-transparent text-brand-textMuted hover:text-brand-body'}`}>
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
        <span className="ml-auto pb-2 text-[0.6875rem] text-brand-textMuted">Free map data from OpenStreetMap — no Google fees.</span>
      </div>

      {error && <p className="border border-action/50 bg-brand-card p-3 text-xs text-brand-body">{error}</p>}
      {notice && <p className="border border-brand-border bg-brand-card p-3 text-xs text-brand-body">{notice}</p>}

      {tab === 'find' && (
        <form onSubmit={(e) => { e.preventDefault(); void runSearch(); }} className="space-y-3 border border-brand-border bg-brand-card p-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto]">
            <label className="block">
              <span className="field-label">Kind of business</span>
              <input list="prospect-kinds" value={query} onChange={(e) => setQuery(e.target.value)} className="field-input" placeholder="e.g. research labs, universities" />
              <datalist id="prospect-kinds">{SEARCH_PROFILES.map((p) => <option key={p.id} value={p.label} />)}</datalist>
            </label>
            <label className="block">
              <span className="field-label">City or area</span>
              <input value={location} onChange={(e) => setLocation(e.target.value)} className="field-input" placeholder="e.g. Austin, TX" />
            </label>
            <div className="flex items-end">
              <button type="submit" disabled={searching} className="btn-primary w-full px-5 py-2.5">
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Search
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SEARCH_PROFILES.slice(0, 8).map((p) => (
              <button key={p.id} type="button" onClick={() => setQuery(p.label)}
                className={`chip ${query === p.label ? 'bg-brand-accent text-brand-onAccent' : 'border border-brand-borderLight text-brand-body hover:text-brand-heading'}`}>
                {p.label}
              </button>
            ))}
          </div>
          {(searchNote || warnings.length > 0) && (
            <div className="text-[0.75rem] text-brand-textMuted">
              {searchNote && <p className="flex items-center gap-1.5">{searching && <Loader2 className="h-3 w-3 animate-spin" />}{searchNote}</p>}
              {warnings.map((w) => <p key={w} className="text-action">{w}</p>)}
            </div>
          )}
        </form>
      )}

      {tab === 'pipeline' && (
        <div className="space-y-2 border border-brand-border bg-brand-card p-3">
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setStageFilter('all')} className={`chip ${stageFilter === 'all' ? 'bg-brand-accent text-brand-onAccent' : 'border border-brand-borderLight text-brand-body'}`}>All {saved.length}</button>
            {PROSPECT_STAGES.map((s) => (
              <button key={s.id} onClick={() => setStageFilter(s.id)}
                className={`chip ${stageFilter === s.id ? 'bg-brand-accent text-brand-onAccent' : 'border border-brand-borderLight text-brand-body'}`}>
                {s.label} {stageCounts[s.id] ?? 0}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[12rem] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-textMuted" />
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Find a saved business" className="field-input pl-8" />
            </div>
            <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} className="field-input w-auto" aria-label="Owner">
              <option value="all">Everyone&apos;s</option>
              <option value="mine">Mine</option>
              <option value="none">Nobody&apos;s yet</option>
              {team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-brand-body">
              <input type="checkbox" checked={dueOnly} onChange={(e) => setDueOnly(e.target.checked)} /> Follow-up due
            </label>
            <ExportMenu onPick={(f) => void doExport(f)} disabled={!visibleSaved.length} />
            <input ref={importRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={(e) => void doImport(e.target.files?.[0])} />
            <button className="btn-secondary" onClick={() => importRef.current?.click()}><Upload className="h-3.5 w-3.5" /> Import</button>
            <button className="btn-secondary" onClick={() => void load()}><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /></button>
          </div>
          {checked.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-brand-border pt-2 text-xs">
              <strong className="text-brand-heading">{checked.size} selected</strong>
              <select className="field-input w-auto" value="" onChange={(e) => { if (e.target.value) void patch(Array.from(checked), { stage: e.target.value }); }}>
                <option value="">Move to stage…</option>
                {PROSPECT_STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <select className="field-input w-auto" value="" onChange={(e) => { if (e.target.value) void patch(Array.from(checked), { owner_id: e.target.value === 'none' ? null : e.target.value }); }}>
                <option value="">Give to…</option>
                <option value="none">Nobody</option>
                {team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button className="btn-secondary" onClick={() => void remove(Array.from(checked))}><Trash2 className="h-3.5 w-3.5" /> Delete</button>
              <button className="text-brand-textMuted underline" onClick={() => setChecked(new Set())}>Clear</button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* list */}
        <div className="flex max-h-[70vh] min-h-[22rem] flex-col border border-brand-border bg-brand-card">
          {tab === 'find' ? (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-brand-border p-2 text-xs">
                <button className="flex items-center gap-1.5 text-brand-body" disabled={!results.length}
                  onClick={() => setPicked(allPicked ? new Set() : new Set(results.filter((p) => !isSaved(p)).map(keyOf)))}>
                  {allPicked ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />} All
                </button>
                <span className="text-brand-textMuted">{results.length} results</span>
                <select value={saveOwner} onChange={(e) => setSaveOwner(e.target.value)} className="field-input ml-auto min-h-8 w-auto py-1 text-xs" aria-label="Save for">
                  <option value="">Save for nobody yet</option>
                  <option value={me.id}>Save as mine</option>
                  {team.filter((t) => t.id !== me.id).map((t) => <option key={t.id} value={t.id}>Save for {t.name}</option>)}
                </select>
                <button className="btn-primary px-3 py-1.5" disabled={!picked.size}
                  onClick={() => void savePlaces(results.filter((p) => picked.has(keyOf(p))))}>
                  <Bookmark className="h-3.5 w-3.5" /> Save {picked.size || ''}
                </button>
              </div>
              <div className="min-h-0 flex-1 divide-y divide-brand-border/60 overflow-y-auto">
                {results.length === 0 && (
                  <p className="p-8 text-center text-xs text-brand-textMuted">
                    {searching ? 'Searching…' : 'Pick a kind of business and a city, then press Search. Or move the map and press "Search this area".'}
                  </p>
                )}
                {results.map((p) => {
                  const k = keyOf(p);
                  const already = isSaved(p);
                  const band = fitBand(p.fit_score);
                  return (
                    <div key={k} className={`flex gap-2 p-2.5 ${selectedResult === k ? 'bg-brand-dark' : ''}`}>
                      <button disabled={already} aria-label="Select" className="mt-0.5 text-brand-body disabled:opacity-40"
                        onClick={() => setPicked((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; })}>
                        {already ? <Check className="h-4 w-4" /> : picked.has(k) ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                      </button>
                      <button className="min-w-0 flex-1 text-left" onClick={() => setSelectedResult(k)}>
                        <p className="truncate font-semibold text-brand-heading">{p.company}</p>
                        <p className="truncate text-[0.6875rem] text-brand-textMuted">{[p.category, p.city, p.region].filter(Boolean).join(' · ') || p.formatted_address}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-[0.6875rem] text-brand-textMuted">
                          <span className={`chip ${TONE_CHIP[band.tone]}`}>{p.fit_score} {band.label}</span>
                          {p.website && <Globe className="h-3 w-3" aria-label="Website" />}
                          {p.phone && <Phone className="h-3 w-3" aria-label="Phone" />}
                          {p.email && <Mail className="h-3 w-3" aria-label="Email" />}
                          {already && <span className="font-bold text-action">Saved</span>}
                        </p>
                      </button>
                      {!already && (
                        <button onClick={() => void savePlaces([p])} title="Save" className="self-center p-1.5 text-brand-textMuted hover:text-brand-heading">
                          <Bookmark className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="min-h-0 flex-1 divide-y divide-brand-border/60 overflow-y-auto">
              {visibleSaved.length === 0 && (
                <p className="p-8 text-center text-xs text-brand-textMuted">
                  {loading ? 'Loading…' : saved.length ? 'No prospects match.' : 'Nothing saved yet. Find businesses and press Save, or import a spreadsheet.'}
                </p>
              )}
              {visibleSaved.map((p) => {
                const band = fitBand(p.fit_score ?? 0);
                const due = p.next_action_at && new Date(p.next_action_at).getTime() <= now + 86_400_000;
                return (
                  <div key={p.id} className={`flex gap-2 p-2.5 ${openId === p.id ? 'bg-brand-dark' : ''}`}>
                    <button aria-label="Select" className="mt-0.5 text-brand-body"
                      onClick={() => setChecked((s) => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })}>
                      {checked.has(p.id) ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                    </button>
                    <button className="min-w-0 flex-1 text-left" onClick={() => setOpenId(p.id)}>
                      <p className="truncate font-semibold text-brand-heading">{p.company}</p>
                      <p className="truncate text-[0.6875rem] text-brand-textMuted">
                        {[p.category ?? p.segment, p.city, team.find((t) => t.id === p.owner_id)?.name].filter(Boolean).join(' · ')}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-[0.6875rem]">
                        <span className="chip border border-brand-borderLight text-brand-heading">{stageLabel(p.stage)}</span>
                        {p.fit_score != null && <span className={`chip ${TONE_CHIP[band.tone]}`}>{p.fit_score}</span>}
                        {p.lead_id && <span className="text-brand-accentGlow">In Leads</span>}
                        {p.next_action_at && (
                          <span className={due ? 'font-bold text-action' : 'text-brand-textMuted'}>
                            Follow up {new Date(p.next_action_at).toLocaleDateString()}
                          </span>
                        )}
                      </p>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* map + detail */}
        <div className="space-y-3">
          <div className="h-[26rem] xl:h-[32rem]">
            <ProspectMap
              pins={pins}
              selected={tab === 'find' ? selectedResult : openId}
              onSelect={(k) => (tab === 'find' ? setSelectedResult(k) : setOpenId(k))}
              onSearchArea={tab === 'find' ? (box) => void runSearch(box) : undefined}
              searching={searching}
              focus={focus}
            />
          </div>
          {tab === 'find' && selResult && (
            <PlaceCard place={selResult} saved={isSaved(selResult)} onSave={() => void savePlaces([selResult])} onClose={() => setSelectedResult(null)} />
          )}
        </div>
      </div>

      {tab === 'pipeline' && open && (
        <ProspectDrawer
          key={open.id}
          prospect={open}
          team={team}
          me={me}
          authedFetch={authedFetch}
          onPatch={(changes) => patch([open.id], changes)}
          onDelete={() => void remove([open.id])}
          onLead={() => void load()}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

function ExportMenu({ onPick, disabled }: { onPick: (f: SheetFormat) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button className="btn-secondary" disabled={disabled} onClick={() => setOpen((o) => !o)}><Download className="h-3.5 w-3.5" /> Export</button>
      {open && (
        <>
          <button aria-label="Close menu" className="fixed inset-0 z-30 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-1 w-40 border border-brand-border bg-brand-card py-1">
            {([['xlsx', 'Excel (.xlsx)'], ['csv', 'CSV (.csv)'], ['pdf', 'PDF']] as const).map(([id, label]) => (
              <button key={id} onClick={() => { setOpen(false); onPick(id); }} className="block w-full px-3 py-2 text-left text-xs text-brand-body hover:bg-brand-dark">{label}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PlaceCard({ place, saved, onSave, onClose }: { place: ProspectPlace; saved: boolean; onSave: () => void; onClose: () => void }) {
  return (
    <div className="border border-brand-border bg-brand-card p-4 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-sm font-extrabold text-brand-heading">{place.company}</p>
          <p className="text-brand-textMuted">{place.category}</p>
        </div>
        <button onClick={onClose} aria-label="Close" className="p-1 text-brand-textMuted"><X className="h-4 w-4" /></button>
      </div>
      {place.formatted_address && <p className="mt-2 text-brand-body">{place.formatted_address}</p>}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {place.website && <a className="text-brand-accentGlow underline" href={place.website} target="_blank" rel="noopener noreferrer">Website</a>}
        {place.phone && <a className="text-brand-accentGlow underline" href={`tel:${place.phone.replace(/[^\d+]/g, '')}`}>{place.phone}</a>}
        {place.email && <a className="text-brand-accentGlow underline" href={`mailto:${place.email}`}>{place.email}</a>}
        {place.map_url && <a className="text-brand-accentGlow underline" href={place.map_url} target="_blank" rel="noopener noreferrer">Map</a>}
      </div>
      <p className="mt-2 text-brand-textMuted">Fit {place.fit_score}: {place.fit_reasons.join(' · ')}</p>
      <div className="mt-3">
        {saved ? <span className="font-bold text-action">Already in your pipeline</span> : (
          <button className="btn-primary px-3 py-1.5" onClick={onSave}><Bookmark className="h-3.5 w-3.5" /> Save to pipeline</button>
        )}
      </div>
    </div>
  );
}

function ProspectDrawer({ prospect, team, me, authedFetch, onPatch, onDelete, onLead, onClose }: {
  prospect: Saved; team: TeamMember[]; me: { id: string; fullName: string | null; email: string };
  authedFetch: Fetcher;
  onPatch: (changes: Record<string, unknown>) => Promise<boolean>;
  onDelete: () => void; onLead: () => void; onClose: () => void;
}) {
  const [form, setForm] = useState({
    contact_name: prospect.contact_name ?? '', email: prospect.email ?? '', phone: prospect.phone ?? '',
    whatsapp: prospect.whatsapp ?? '', website: prospect.website ?? '', notes: prospect.notes ?? '',
    next_action: prospect.next_action ?? '',
    next_action_at: prospect.next_action_at ? prospect.next_action_at.slice(0, 10) : '',
  });
  const [activity, setActivity] = useState<Activity[]>([]);
  const [note, setNote] = useState('');
  const [kind, setKind] = useState('note');
  const [template, setTemplate] = useState(OUTREACH_TEMPLATES[0].id);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const loadActivity = useCallback(async () => {
    const res = await authedFetch(`/api/admin/prospects/pipeline?activity=${encodeURIComponent(prospect.id)}`);
    const p = await res.json().catch(() => null);
    if (res.ok) setActivity(Array.isArray(p?.data?.activity) ? p.data.activity : []);
  }, [authedFetch, prospect.id]);
  useEffect(() => { void loadActivity(); }, [loadActivity]);

  const dirty = Object.entries(form).some(([k, v]) => {
    const current = k === 'next_action_at' ? (prospect.next_action_at ?? '').slice(0, 10) : ((prospect as unknown as Record<string, unknown>)[k] ?? '');
    return v !== current;
  });

  const save = async () => {
    setBusy('save'); setMsg('');
    const ok = await onPatch({ ...form, next_action_at: form.next_action_at || null });
    setBusy(''); setMsg(ok ? 'Saved.' : '');
  };

  const log = async (k: string, body: string) => {
    await authedFetch('/api/admin/prospects/pipeline', { method: 'POST', body: JSON.stringify({ action: 'note', id: prospect.id, kind: k, body }) });
    void loadActivity();
  };

  const tpl = OUTREACH_TEMPLATES.find((t) => t.id === template)!;
  const values = { company: prospect.company, business: BUSINESS.name, sender: me.fullName || me.email, contact: form.contact_name || '' };
  const subject = fillTemplate(tpl.subject, values);
  const body = fillTemplate(tpl.body, values);
  const wa = cleanWhatsAppNumber(form.whatsapp || form.phone);
  const canWa = isValidWhatsAppNumber(wa) && prospect.stage !== 'do_not_contact';
  const canEmail = Boolean(form.email) && prospect.stage !== 'do_not_contact';

  const reach = (channel: 'whatsapp' | 'email' | 'call') => {
    void log(channel, channel === 'call' ? 'Called' : `${channel === 'whatsapp' ? 'WhatsApp' : 'Email'} opened: ${tpl.label}`);
    if (prospect.stage === 'identified' || prospect.stage === 'qualified') void onPatch({ stage: 'contacted' });
  };

  const toLead = async () => {
    setBusy('lead');
    const res = await authedFetch('/api/admin/prospects/pipeline', { method: 'POST', body: JSON.stringify({ action: 'lead', id: prospect.id }) });
    const p = await res.json().catch(() => null);
    setBusy('');
    setMsg(res.ok ? 'Copied to Leads.' : p?.message ?? 'Could not copy.');
    if (res.ok) onLead();
  };

  const field = (key: keyof typeof form, label: string, type = 'text') => (
    <label className="block">
      <span className="field-label">{label}</span>
      <input type={type} className="field-input" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
    </label>
  );

  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-black/40" role="dialog" aria-modal="true" aria-label={prospect.company}>
      <button aria-label="Close" className="flex-1 cursor-default" onClick={onClose} />
      <aside className="flex h-full w-full max-w-lg flex-col border-l border-brand-border bg-brand-card">
        <div className="flex items-start justify-between gap-3 border-b border-brand-border p-4">
          <div className="min-w-0">
            <h2 className="font-display text-base font-extrabold text-brand-heading">{prospect.company}</h2>
            <p className="text-xs text-brand-textMuted">{[prospect.category ?? prospect.segment, prospect.formatted_address ?? prospect.city].filter(Boolean).join(' · ')}</p>
            {prospect.fit_reasons?.length ? <p className="mt-1 text-[0.6875rem] text-brand-textMuted">Fit {prospect.fit_score}: {prospect.fit_reasons.join(' · ')}</p> : null}
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 text-brand-textMuted hover:text-brand-heading"><X className="h-5 w-5" /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="field-label">Stage</span>
              <select className="field-input" value={prospect.stage} onChange={(e) => void onPatch({ stage: e.target.value })}>
                {PROSPECT_STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="field-label">Owner</span>
              <select className="field-input" value={prospect.owner_id ?? ''} onChange={(e) => void onPatch({ owner_id: e.target.value || null })}>
                <option value="">Nobody</option>
                {team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
          </div>

          {/* outreach */}
          <section className="space-y-2 border border-brand-border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="field-label mb-0">Reach out</span>
              <select className="field-input min-h-8 w-auto py-1 text-xs" value={template} onChange={(e) => setTemplate(e.target.value)}>
                {OUTREACH_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap border border-brand-border bg-brand-dark p-2 font-sans text-[0.75rem] text-brand-body">{body}</pre>
            {prospect.stage === 'do_not_contact' && <p className="text-action">Marked do not contact.</p>}
            <div className="flex flex-wrap gap-1.5">
              {canWa ? (
                <a className="btn-whatsapp px-3 py-2" target="_blank" rel="noopener noreferrer" onClick={() => reach('whatsapp')}
                  href={`https://wa.me/${wa}?text=${encodeURIComponent(body)}`}><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a>
              ) : <span className="btn-secondary cursor-not-allowed opacity-50"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</span>}
              {canEmail ? (
                <a className="btn-secondary" onClick={() => reach('email')}
                  href={`mailto:${encodeURIComponent(form.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}><Mail className="h-3.5 w-3.5" /> Email</a>
              ) : <span className="btn-secondary cursor-not-allowed opacity-50"><Mail className="h-3.5 w-3.5" /> Email</span>}
              {form.phone && <a className="btn-secondary" href={`tel:${form.phone.replace(/[^\d+]/g, '')}`} onClick={() => reach('call')}><Phone className="h-3.5 w-3.5" /> Call</a>}
              {form.website && <a className="btn-secondary" href={form.website} target="_blank" rel="noopener noreferrer"><Globe className="h-3.5 w-3.5" /> Site</a>}
              {prospect.map_url && <a className="btn-secondary" href={prospect.map_url} target="_blank" rel="noopener noreferrer"><MapPin className="h-3.5 w-3.5" /> Map</a>}
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3">
            {field('contact_name', 'Contact person')}
            {field('email', 'Email', 'email')}
            {field('phone', 'Phone', 'tel')}
            {field('whatsapp', 'WhatsApp (if different)', 'tel')}
            <div className="col-span-2">{field('website', 'Website')}</div>
            {field('next_action', 'Next step')}
            {field('next_action_at', 'Follow up on', 'date')}
            <label className="col-span-2 block">
              <span className="field-label">Notes</span>
              <textarea className="field-input" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
            <div className="col-span-2 flex items-center gap-2">
              <button className="btn-primary px-4 py-2" disabled={!dirty || busy === 'save'} onClick={() => void save()}>
                {busy === 'save' && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save details
              </button>
              {msg && <span className="text-brand-accentGlow">{msg}</span>}
            </div>
          </section>

          {/* timeline */}
          <section className="space-y-2">
            <span className="field-label">Timeline</span>
            <div className="flex gap-2">
              <select className="field-input w-auto" value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="note">Note</option><option value="call">Call</option><option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option><option value="visit">Visit</option>
              </select>
              <input className="field-input" placeholder="What happened?" value={note} onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && note.trim()) { void log(kind, note.trim()); setNote(''); } }} />
              <button className="btn-secondary" disabled={!note.trim()} onClick={() => { void log(kind, note.trim()); setNote(''); }}>Add</button>
            </div>
            <ul className="space-y-1.5">
              {activity.map((a) => (
                <li key={a.id} className="border-l-2 border-brand-border pl-2">
                  <p className="text-brand-body"><span className="font-bold uppercase text-brand-heading">{a.activity.replace('_', ' ')}</span> {a.body}</p>
                  <p className="text-[0.625rem] text-brand-textMuted">{a.actor} · {new Date(a.created_at).toLocaleString()}</p>
                </li>
              ))}
              {!activity.length && <li className="text-brand-textMuted">Nothing yet.</li>}
            </ul>
          </section>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-brand-border p-3">
          <button className="text-xs text-action underline" onClick={onDelete}>Delete</button>
          {prospect.lead_id ? (
            <span className="flex items-center gap-1 text-xs text-brand-accentGlow"><Check className="h-3.5 w-3.5" /> In Leads</span>
          ) : (
            <button className="btn-primary px-3 py-2" disabled={busy === 'lead'} onClick={() => void toLead()}>
              <UserPlus className="h-3.5 w-3.5" /> Copy to Leads
            </button>
          )}
          {prospect.website && (
            <a href={prospect.website} target="_blank" rel="noopener noreferrer" className="hidden text-xs text-brand-textMuted sm:inline-flex sm:items-center sm:gap-1">
              <ExternalLink className="h-3 w-3" /> {prospect.website.replace(/^https?:\/\//, '').replace(/\/.*$/, '')}
            </a>
          )}
        </div>
      </aside>
    </div>
  );
}
