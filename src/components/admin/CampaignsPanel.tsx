'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowUp, BarChart3, CheckCircle2, Circle, Copy, Download, Eye, Loader2, Mail,
  Monitor, MousePointerClick, Pause, Pencil, Play, Plus, RefreshCw, Send, Smartphone, Trash2, Users, X,
} from 'lucide-react';
import UploadField, { type UploadKind } from './UploadField';
import { useSiteContent } from '@/components/SiteContentProvider';
import { useCatalogue } from '@/hooks/useCatalogue';
import { exportSheet, stamp } from '@/lib/sheetFiles';
import {
  AUDIENCES, AUDIENCE_FILTERS, BLOCK_LABELS, CAMPAIGN_STATUS_LABEL, EMAIL_TEMPLATES, newBlock, personalize, renderEmailHtml,
  type Block, type BlockType, type EmailDesign,
} from '@/lib/emailDesign';

/**
 * Campaigns: email marketing in the style of Mailchimp.
 *
 *   list     every campaign with sends, open rate and click rate
 *   builder  setup, audience, design (blocks + live preview), review and send
 *   report   progress while sending, then opens, clicks, links and recipients
 *
 * Drafts save themselves. Sending needs an email account (SMTP) connected in
 * Vercel; until then everything else works and the send button says what is
 * missing.
 */

type Fetcher = (path: string, init?: RequestInit) => Promise<Response>;

interface Campaign {
  id: string; name: string; subject: string | null; preview_text: string | null; status: string;
  audience: string; audience_filter: string; scheduled_at: string | null; started_at: string | null;
  completed_at: string | null; recipient_count: number; sent_count: number; failed_count: number;
  open_count: number; click_count: number; unsubscribe_count: number; last_test_at: string | null; created_at: string;
  from_name?: string | null; reply_to?: string | null; design?: EmailDesign;
}

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 1000) / 10}%` : '—');

const STATUS_CHIP: Record<string, string> = {
  draft: 'border border-brand-borderLight text-brand-textMuted',
  scheduled: 'bg-navy text-cream',
  sending: 'bg-action text-white',
  paused: 'border border-action text-action',
  sent: 'bg-brand-accent text-brand-onAccent',
};

async function json(res: Response) {
  const p = await res.json().catch(() => null);
  if (!res.ok) throw new Error(p?.message ?? 'Something went wrong.');
  return p.data;
}

export default function CampaignsPanel({ authedFetch, upload }: { authedFetch: Fetcher; upload: (file: File, kind: UploadKind) => Promise<string> }) {
  const [view, setView] = useState<{ kind: 'list' } | { kind: 'builder'; id: string | null } | { kind: 'report'; id: string }>({ kind: 'list' });
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [notice, setNotice] = useState('');
  const [emailReady, setEmailReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const d = await json(await authedFetch('/api/admin/campaigns/manage'));
      setCampaigns(d.campaigns); setNotice(d.notice ?? ''); setEmailReady(d.emailReady);
    } catch (err) {
      const m = (err as Error).message;
      if (m !== 'denied') setError(m);
    } finally { setLoading(false); }
  }, [authedFetch]);

  useEffect(() => { if (view.kind === 'list') void load(); }, [view.kind, load]);

  // Keep sending campaigns moving while this screen is open.
  useEffect(() => {
    const active = campaigns.filter((c) => c.status === 'sending');
    if (view.kind !== 'list' || !active.length) return;
    const timer = window.setInterval(async () => {
      for (const c of active) {
        try { await authedFetch('/api/admin/campaigns/send', { method: 'POST', body: JSON.stringify({ id: c.id, mode: 'batch' }) }); } catch { /* shown on reload */ }
      }
      void load();
    }, 8000);
    return () => window.clearInterval(timer);
  }, [campaigns, view.kind, authedFetch, load]);

  const totals = useMemo(() => {
    const sent = campaigns.filter((c) => c.sent_count > 0);
    const s = sent.reduce((a, c) => a + c.sent_count, 0);
    return {
      sent: s,
      opens: pct(sent.reduce((a, c) => a + c.open_count, 0), s),
      clicks: pct(sent.reduce((a, c) => a + c.click_count, 0), s),
      campaigns: campaigns.length,
    };
  }, [campaigns]);

  const duplicate = async (c: Campaign) => {
    try {
      const d = await json(await authedFetch('/api/admin/campaigns/manage', { method: 'POST', body: JSON.stringify({ action: 'duplicate', id: c.id }) }));
      setView({ kind: 'builder', id: d.campaign.id });
    } catch (err) { setError((err as Error).message); }
  };

  const remove = async (c: Campaign) => {
    if (!window.confirm(`Delete "${c.name}"? Its report goes too.`)) return;
    try {
      await json(await authedFetch(`/api/admin/campaigns/manage?id=${encodeURIComponent(c.id)}`, { method: 'DELETE' }));
      setCampaigns((prev) => prev.filter((x) => x.id !== c.id));
    } catch (err) { setError((err as Error).message); }
  };

  if (view.kind === 'builder') {
    return <Builder id={view.id} authedFetch={authedFetch} upload={upload} emailReady={emailReady}
      onBack={() => setView({ kind: 'list' })} onSent={(id) => setView({ kind: 'report', id })} />;
  }
  if (view.kind === 'report') {
    return <Report id={view.id} authedFetch={authedFetch} onBack={() => setView({ kind: 'list' })}
      onEdit={(id) => setView({ kind: 'builder', id })} />;
  }

  return (
    <div className="space-y-4">
      {!emailReady && (
        <p className="border border-action/50 bg-brand-card p-3 text-xs text-brand-body">
          <strong>Email is not connected yet.</strong> You can build and preview campaigns now. To send, add RESEND_API_KEY
          and RESEND_FROM in Vercel and redeploy. SMTP remains available as a fallback.
        </p>
      )}
      {notice && <p className="border border-action/50 bg-brand-card p-3 text-xs text-brand-body">{notice}</p>}
      {error && <p className="border border-action/50 bg-brand-card p-3 text-xs text-brand-body">{error}</p>}

      <div className="grid grid-cols-2 gap-px border border-brand-border bg-brand-border md:grid-cols-4">
        {[['Campaigns', totals.campaigns], ['Emails sent', totals.sent], ['Average open rate', totals.opens], ['Average click rate', totals.clicks]].map(([label, value]) => (
          <div key={label} className="bg-brand-card p-4">
            <div className="eyebrow">{label}</div>
            <div className="mt-2 font-display text-xl font-black text-brand-heading">{value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.8125rem] text-brand-textMuted">Build an email, pick who gets it, send or schedule, then watch opens and clicks.</p>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => void load()}><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
          <button className="btn-primary px-4 py-2" disabled={Boolean(notice)} onClick={() => setView({ kind: 'builder', id: null })}>
            <Plus className="h-3.5 w-3.5" /> Create campaign
          </button>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <div className="border border-brand-border bg-brand-card p-12 text-center">
          <Mail className="mx-auto h-6 w-6 text-brand-textMuted" />
          <p className="mt-3 font-display text-sm font-extrabold text-brand-heading">{loading ? 'Loading…' : 'No campaigns yet'}</p>
          <p className="mt-1 text-xs text-brand-textMuted">Start from a template — announcement, product spotlight, offer or newsletter.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-brand-border bg-brand-card">
          <table className="w-full min-w-[52rem] text-left text-xs">
            <thead className="border-b border-brand-border">
              <tr>{['Campaign', 'Status', 'Recipients', 'Opens', 'Clicks', 'Unsubscribed', ''].map((h) => (
                <th key={h} className="px-3 py-2.5 font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.12em] text-brand-textMuted">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const editable = ['draft', 'scheduled', 'paused'].includes(c.status);
                return (
                  <tr key={c.id} className="border-b border-brand-border/60 last:border-b-0 hover:bg-brand-dark">
                    <td className="px-3 py-2.5">
                      <button onClick={() => setView(editable ? { kind: 'builder', id: c.id } : { kind: 'report', id: c.id })}
                        className="block max-w-[22rem] truncate text-left font-semibold text-brand-heading hover:underline">{c.name}</button>
                      <p className="max-w-[22rem] truncate text-[0.6875rem] text-brand-textMuted">{c.subject || 'No subject yet'}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`chip ${STATUS_CHIP[c.status] ?? STATUS_CHIP.draft}`}>{CAMPAIGN_STATUS_LABEL[c.status] ?? c.status}</span>
                      <p className="mt-1 text-[0.6875rem] text-brand-textMuted">
                        {c.status === 'scheduled' && c.scheduled_at ? new Date(c.scheduled_at).toLocaleString()
                          : c.completed_at ? new Date(c.completed_at).toLocaleDateString()
                          : c.status === 'sending' ? `${c.sent_count} of ${c.recipient_count}` : new Date(c.created_at).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 font-mono">{c.recipient_count || '—'}</td>
                    <td className="px-3 py-2.5 font-mono">{pct(c.open_count, c.sent_count)}</td>
                    <td className="px-3 py-2.5 font-mono">{pct(c.click_count, c.sent_count)}</td>
                    <td className="px-3 py-2.5 font-mono">{c.unsubscribe_count || 0}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1">
                        {c.status !== 'draft' && <button title="Report" onClick={() => setView({ kind: 'report', id: c.id })} className="p-1.5 text-brand-textMuted hover:text-brand-heading"><BarChart3 className="h-3.5 w-3.5" /></button>}
                        {editable && <button title="Edit" onClick={() => setView({ kind: 'builder', id: c.id })} className="p-1.5 text-brand-textMuted hover:text-brand-heading"><Pencil className="h-3.5 w-3.5" /></button>}
                        <button title="Duplicate" onClick={() => void duplicate(c)} className="p-1.5 text-brand-textMuted hover:text-brand-heading"><Copy className="h-3.5 w-3.5" /></button>
                        {c.status !== 'sending' && <button title="Delete" onClick={() => void remove(c)} className="p-1.5 text-brand-textMuted hover:text-action"><Trash2 className="h-3.5 w-3.5" /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ================================================================ builder */

type Step = 'setup' | 'audience' | 'design' | 'send';
const STEPS: { id: Step; label: string }[] = [
  { id: 'setup', label: '1. Setup' },
  { id: 'audience', label: '2. Audience' },
  { id: 'design', label: '3. Design' },
  { id: 'send', label: '4. Review & send' },
];

interface Draft {
  id: string | null; name: string; subject: string; preview_text: string; from_name: string; reply_to: string;
  audience: string; audience_filter: string; design: EmailDesign; status: string; last_test_at: string | null;
}

function Builder({ id, authedFetch, upload, emailReady, onBack, onSent }: {
  id: string | null; authedFetch: Fetcher; upload: (file: File, kind: UploadKind) => Promise<string>;
  emailReady: boolean; onBack: () => void; onSent: (id: string) => void;
}) {
  const { t } = useSiteContent();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [step, setStep] = useState<Step>('setup');
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');
  const dirty = useRef(false);

  useEffect(() => {
    let live = true;
    (async () => {
      if (!id) { setDraft(null); return; }
      try {
        const d = await json(await authedFetch(`/api/admin/campaigns/manage?id=${encodeURIComponent(id)}`));
        const c = d.campaign as Campaign;
        if (live) setDraft({
          id: c.id, name: c.name, subject: c.subject ?? '', preview_text: c.preview_text ?? '', from_name: c.from_name ?? '',
          reply_to: c.reply_to ?? '', audience: c.audience || 'subscribers', audience_filter: c.audience_filter || 'none',
          design: c.design && Array.isArray(c.design.blocks) ? c.design : EMAIL_TEMPLATES[0].design(), status: c.status, last_test_at: c.last_test_at,
        });
      } catch (err) { if (live) setError((err as Error).message); }
    })();
    return () => { live = false; };
  }, [id, authedFetch]);

  const update = (patch: Partial<Draft>) => { dirty.current = true; setDraft((d) => (d ? { ...d, ...patch } : d)); };

  const save = useCallback(async (d: Draft) => {
    setSaving('saving'); setError('');
    try {
      const body = { name: d.name, subject: d.subject, preview_text: d.preview_text, from_name: d.from_name, reply_to: d.reply_to, audience: d.audience, audience_filter: d.audience_filter, design: d.design };
      const res = d.id
        ? await authedFetch('/api/admin/campaigns/manage', { method: 'PATCH', body: JSON.stringify({ id: d.id, ...body }) })
        : await authedFetch('/api/admin/campaigns/manage', { method: 'POST', body: JSON.stringify(body) });
      const data = await json(res);
      const savedId: string | undefined = data?.campaign?.id ?? d.id ?? undefined;
      if (!savedId) throw new Error('The campaign could not be saved.');
      dirty.current = false;
      if (!d.id) setDraft((cur) => (cur ? { ...cur, id: savedId } : cur));
      setSaving('saved');
      return savedId;
    } catch (err) {
      setSaving('error'); setError((err as Error).message);
      return null;
    }
  }, [authedFetch]);

  // Autosave two seconds after the last change.
  useEffect(() => {
    if (!draft || !dirty.current || !draft.id) return;
    const timer = window.setTimeout(() => { if (dirty.current) void save(draft); }, 2000);
    return () => window.clearTimeout(timer);
  }, [draft, save]);

  const leave = async () => {
    if (draft && dirty.current) await save(draft);
    onBack();
  };

  if (!draft) {
    return id ? (
      <p className="flex items-center gap-2 text-xs text-brand-textMuted"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading campaign… {error}</p>
    ) : (
      <TemplatePicker onBack={onBack} onPick={async (tpl) => {
        const d: Draft = {
          id: null, name: tpl.id === 'blank' ? 'Untitled campaign' : tpl.name, subject: personalize(tpl.subject, {}, t('business.name')),
          preview_text: tpl.preview, from_name: '', reply_to: '', audience: 'subscribers', audience_filter: 'none',
          design: tpl.design(), status: 'draft', last_test_at: null,
        };
        setDraft(d);
        await save(d);
      }} />
    );
  }

  const locked = !['draft', 'scheduled', 'paused'].includes(draft.status);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-secondary" onClick={() => void leave()}><ArrowLeft className="h-3.5 w-3.5" /> Campaigns</button>
        <input className="field-input max-w-md flex-1 font-semibold" value={draft.name} onChange={(e) => update({ name: e.target.value })} aria-label="Campaign name" />
        <span className="text-[0.75rem] text-brand-textMuted">
          {saving === 'saving' ? 'Saving…' : saving === 'saved' && !dirty.current ? 'All changes saved' : saving === 'error' ? 'Not saved' : dirty.current ? 'Unsaved changes' : ''}
        </span>
        <button className="btn-secondary ml-auto" onClick={() => void save(draft)} disabled={saving === 'saving'}>Save now</button>
      </div>
      {error && <p className="border border-action/50 bg-brand-card p-3 text-xs text-brand-body">{error}</p>}
      {locked && <p className="border border-action/50 bg-brand-card p-3 text-xs">This campaign has been sent, so it can no longer be changed. Duplicate it from the list.</p>}

      <nav className="flex flex-wrap gap-1 border-b border-brand-border">
        {STEPS.map((s) => (
          <button key={s.id} onClick={() => setStep(s.id)}
            className={`-mb-px border-b-2 px-4 py-2.5 font-display text-[0.8125rem] font-extrabold uppercase tracking-[0.08em] ${
              step === s.id ? 'border-brand-accent text-brand-heading' : 'border-transparent text-brand-textMuted hover:text-brand-body'}`}>
            {s.label}
          </button>
        ))}
      </nav>

      <fieldset disabled={locked} className="min-w-0">
        {step === 'setup' && <SetupStep draft={draft} update={update} business={t('business.name')} />}
        {step === 'audience' && <AudienceStep draft={draft} update={update} authedFetch={authedFetch} />}
        {step === 'design' && <DesignStep draft={draft} update={update} upload={upload} />}
        {step === 'send' && (
          <SendStep draft={draft} authedFetch={authedFetch} emailReady={emailReady} goto={setStep}
            ensureSaved={async () => (dirty.current || !draft.id ? save(draft) : draft.id)}
            onSent={onSent} onTested={() => update({ last_test_at: new Date().toISOString() })} />
        )}
      </fieldset>
    </div>
  );
}

function TemplatePicker({ onPick, onBack }: { onPick: (tpl: (typeof EMAIL_TEMPLATES)[number]) => void; onBack: () => void }) {
  const [busy, setBusy] = useState('');
  return (
    <div className="space-y-4">
      <button className="btn-secondary" onClick={onBack}><ArrowLeft className="h-3.5 w-3.5" /> Campaigns</button>
      <h2 className="font-display text-sm font-extrabold uppercase tracking-[0.08em] text-brand-heading">Pick a starting point</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {EMAIL_TEMPLATES.map((tpl) => (
          <button key={tpl.id} disabled={Boolean(busy)} onClick={() => { setBusy(tpl.id); onPick(tpl); }}
            className="border border-brand-border bg-brand-card p-4 text-left transition-colors hover:border-brand-accent disabled:opacity-60">
            <div className="mb-3 flex h-24 flex-col gap-1.5 border border-brand-border bg-white p-2">
              <div className="h-3 bg-forest" />
              {tpl.design().blocks.slice(0, 5).map((b) => (
                <div key={b.id} className={`h-1.5 ${b.type === 'button' ? 'mx-auto w-1/3 bg-action' : b.type === 'heading' ? 'w-2/3 bg-forest/70' : b.type === 'image' || b.type === 'products' ? 'h-4 bg-cream-200' : 'bg-cream-200'}`} />
              ))}
            </div>
            <p className="font-display text-xs font-extrabold uppercase tracking-[0.08em] text-brand-heading">
              {busy === tpl.id && <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />}{tpl.name}
            </p>
            <p className="mt-1 text-[0.75rem] text-brand-textMuted">{tpl.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function SetupStep({ draft, update, business }: { draft: Draft; update: (p: Partial<Draft>) => void; business: string }) {
  return (
    <div className="grid max-w-3xl gap-4 border border-brand-border bg-brand-card p-4">
      <label className="block">
        <span className="field-label">Subject line <span className="normal-case">({draft.subject.length}/60 recommended)</span></span>
        <input className="field-input" value={draft.subject} onChange={(e) => update({ subject: e.target.value })} placeholder="What people see in their inbox" />
      </label>
      <label className="block">
        <span className="field-label">Preview text</span>
        <input className="field-input" value={draft.preview_text} onChange={(e) => update({ preview_text: e.target.value })} placeholder="The grey line shown after the subject" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="field-label">From name</span>
          <input className="field-input" value={draft.from_name} onChange={(e) => update({ from_name: e.target.value })} placeholder={business} />
        </label>
        <label className="block">
          <span className="field-label">Replies go to</span>
          <input className="field-input" type="email" value={draft.reply_to} onChange={(e) => update({ reply_to: e.target.value })} placeholder="Your sending address" />
        </label>
      </div>
      <div className="border border-brand-border bg-white p-3">
        <p className="text-[0.625rem] font-bold uppercase tracking-[0.12em] text-neutral-500">Inbox preview</p>
        <p className="mt-1 text-sm font-bold text-neutral-900">{draft.from_name || business}</p>
        <p className="truncate text-sm text-neutral-900">{draft.subject || 'Subject line'}</p>
        <p className="truncate text-sm text-neutral-500">{draft.preview_text || 'Preview text'}</p>
      </div>
      <p className="text-[0.75rem] text-brand-textMuted">Merge fields: {'{first_name}'}, {'{name}'}, {'{email}'}, {'{business}'} — replaced for each person.</p>
    </div>
  );
}

function AudienceStep({ draft, update, authedFetch }: { draft: Draft; update: (p: Partial<Draft>) => void; authedFetch: Fetcher }) {
  const [info, setInfo] = useState<{ count: number; sizes: Record<string, number>; sample: { email: string; name: string | null; source: string }[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    setLoading(true); setError('');
    authedFetch('/api/admin/campaigns/audience', { method: 'POST', body: JSON.stringify({ audience: draft.audience, filter: draft.audience_filter }) })
      .then(json)
      .then((d) => { if (live) setInfo(d); })
      .catch((err) => { if (live) setError(err.message); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [draft.audience, draft.audience_filter, authedFetch]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {AUDIENCES.map((a) => (
            <button key={a.id} type="button" onClick={() => update({ audience: a.id })}
              className={`flex items-start gap-3 border p-3 text-left ${draft.audience === a.id ? 'border-brand-accent bg-brand-card' : 'border-brand-border bg-brand-card hover:border-brand-borderLight'}`}>
              {draft.audience === a.id ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-brand-accentGlow" /> : <Circle className="mt-0.5 h-4 w-4 text-brand-textMuted" />}
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-brand-heading">{a.label}</span>
                <span className="block text-[0.75rem] text-brand-textMuted">{a.hint}</span>
              </span>
              <span className="font-mono text-sm text-brand-heading">{info?.sizes?.[a.id] ?? '…'}</span>
            </button>
          ))}
        </div>
        <label className="block max-w-md">
          <span className="field-label">Narrow it down</span>
          <select className="field-input" value={draft.audience_filter} onChange={(e) => update({ audience_filter: e.target.value })}>
            {AUDIENCE_FILTERS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </label>
        <p className="text-[0.75rem] text-brand-textMuted">
          People who unsubscribed or whose address bounced are always left out. Each address gets one copy even if it is on several lists.
        </p>
      </div>
      <aside className="border border-brand-border bg-brand-card p-4">
        <p className="eyebrow">This campaign reaches</p>
        <p className="mt-2 font-display text-3xl font-black text-brand-heading">
          {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : info?.count ?? 0}
        </p>
        <p className="text-xs text-brand-textMuted">people</p>
        {error && <p className="mt-2 text-xs text-action">{error}</p>}
        <ul className="mt-4 space-y-1 text-[0.75rem]">
          {info?.sample.map((r) => (
            <li key={r.email} className="truncate text-brand-body"><Users className="mr-1 inline h-3 w-3" />{r.name ? `${r.name} · ` : ''}{r.email}</li>
          ))}
          {info && info.count > info.sample.length && <li className="text-brand-textMuted">and {info.count - info.sample.length} more</li>}
        </ul>
      </aside>
    </div>
  );
}

function DesignStep({ draft, update, upload }: { draft: Draft; update: (p: Partial<Draft>) => void; upload: (file: File, kind: UploadKind) => Promise<string> }) {
  const { t } = useSiteContent();
  const { products } = useCatalogue();
  const [selected, setSelected] = useState<string | null>(draft.design.blocks[0]?.id ?? null);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const blocks = draft.design.blocks;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const setBlocks = (next: Block[]) => update({ design: { ...draft.design, blocks: next } });
  const patchBlock = (id: string, patch: Partial<Block>) => setBlocks(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const add = (type: BlockType) => {
    const b = newBlock(type);
    const at = selected ? blocks.findIndex((x) => x.id === selected) + 1 : blocks.length;
    setBlocks([...blocks.slice(0, at), b, ...blocks.slice(at)]);
    setSelected(b.id);
  };
  const move = (id: string, dir: -1 | 1) => {
    const i = blocks.findIndex((b) => b.id === id);
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    setBlocks(next);
  };

  const html = useMemo(() => {
    const sample = { name: 'Alex Morgan', email: 'alex@example.edu' };
    const design = { ...draft.design, blocks: draft.design.blocks.map((b) => ({ ...b, text: b.text !== undefined ? personalize(b.text, sample, t('business.name')) : undefined })) };
    return renderEmailHtml(design, draft.subject, {
      businessName: t('business.name'), siteUrl: origin, address: t('contact.address'),
      previewText: draft.preview_text, unsubscribeUrl: '#unsubscribe',
    });
  }, [draft.design, draft.subject, draft.preview_text, origin, t]);

  const sel = blocks.find((b) => b.id === selected) ?? null;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <div className="space-y-3">
        <div className="border border-brand-border bg-brand-card p-3">
          <p className="field-label">Add a block</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(BLOCK_LABELS) as BlockType[]).map((type) => (
              <button key={type} type="button" onClick={() => add(type)} className="chip border border-brand-borderLight text-brand-heading hover:border-brand-accent">
                <Plus className="h-3 w-3" /> {BLOCK_LABELS[type]}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
            <label className="flex items-center gap-1.5">Heading colour
              <input type="color" value={draft.design.accent ?? '#1F4233'} onChange={(e) => update({ design: { ...draft.design, accent: e.target.value } })} />
            </label>
            <label className="flex items-center gap-1.5">Background
              <input type="color" value={draft.design.background ?? '#F3F1E6'} onChange={(e) => update({ design: { ...draft.design, background: e.target.value } })} />
            </label>
          </div>
        </div>

        <ol className="divide-y divide-brand-border/60 border border-brand-border bg-brand-card">
          {blocks.map((b, i) => (
            <li key={b.id} className={`flex items-center gap-2 px-3 py-2 ${selected === b.id ? 'bg-brand-dark' : ''}`}>
              <button type="button" onClick={() => setSelected(b.id)} className="min-w-0 flex-1 text-left">
                <span className="font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.1em] text-brand-heading">{BLOCK_LABELS[b.type]}</span>
                <span className="ml-2 truncate text-[0.75rem] text-brand-textMuted">
                  {b.text?.slice(0, 40) || b.label || (b.type === 'products' ? `${b.items?.length ?? 0} products` : b.src ? 'picture' : '')}
                </span>
              </button>
              <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(b.id, -1)} className="p-1 text-brand-textMuted disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
              <button type="button" aria-label="Move down" disabled={i === blocks.length - 1} onClick={() => move(b.id, 1)} className="p-1 text-brand-textMuted disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
              <button type="button" aria-label="Remove" onClick={() => { setBlocks(blocks.filter((x) => x.id !== b.id)); if (selected === b.id) setSelected(null); }} className="p-1 text-brand-textMuted hover:text-action"><X className="h-3.5 w-3.5" /></button>
            </li>
          ))}
          {!blocks.length && <li className="p-6 text-center text-xs text-brand-textMuted">Empty. Add a block above.</li>}
        </ol>

        {sel && (
          <div className="space-y-3 border border-brand-border bg-brand-card p-3">
            <p className="field-label">Edit {BLOCK_LABELS[sel.type].toLowerCase()}</p>
            {(sel.type === 'heading' || sel.type === 'text' || sel.type === 'quote') && (
              <>
                <textarea className="field-input" rows={sel.type === 'text' ? 7 : 2} value={sel.text ?? ''} onChange={(e) => patchBlock(sel.id, { text: e.target.value })} />
                <p className="text-[0.6875rem] text-brand-textMuted">**bold**, *italic*, [link text](https://…). Merge fields like {'{first_name}'} work here.</p>
              </>
            )}
            {sel.type === 'heading' && (
              <select className="field-input" value={sel.size} onChange={(e) => patchBlock(sel.id, { size: e.target.value as 'lg' | 'md' })}>
                <option value="lg">Large</option><option value="md">Medium</option>
              </select>
            )}
            {['heading', 'text', 'quote', 'button'].includes(sel.type) && (
              <div className="flex gap-1">
                {(['left', 'center'] as const).map((a) => (
                  <button key={a} type="button" onClick={() => patchBlock(sel.id, { align: a })}
                    className={`chip ${sel.align === a ? 'bg-brand-accent text-brand-onAccent' : 'border border-brand-borderLight'}`}>{a === 'left' ? 'Left' : 'Centre'}</button>
                ))}
              </div>
            )}
            {sel.type === 'image' && (
              <>
                <UploadField kind="blog" value={sel.src ?? ''} onChange={(url) => patchBlock(sel.id, { src: url })} upload={upload} />
                <input className="field-input" placeholder="Describe the picture" value={sel.alt ?? ''} onChange={(e) => patchBlock(sel.id, { alt: e.target.value })} />
                <input className="field-input" placeholder="Link when clicked (optional): /shop or https://…" value={sel.href ?? ''} onChange={(e) => patchBlock(sel.id, { href: e.target.value })} />
              </>
            )}
            {sel.type === 'button' && (
              <>
                <input className="field-input" placeholder="Button text" value={sel.label ?? ''} onChange={(e) => patchBlock(sel.id, { label: e.target.value })} />
                <input className="field-input" placeholder="/shop or https://…" value={sel.href ?? ''} onChange={(e) => patchBlock(sel.id, { href: e.target.value })} />
                <select className="field-input" value={sel.style} onChange={(e) => patchBlock(sel.id, { style: e.target.value as Block['style'] })}>
                  <option value="action">Orange (buy)</option><option value="brand">Brand colour</option><option value="outline">Outline</option>
                </select>
              </>
            )}
            {sel.type === 'spacer' && (
              <label className="block text-xs">Height: {sel.height}px
                <input type="range" min={8} max={96} value={sel.height ?? 24} onChange={(e) => patchBlock(sel.id, { height: Number(e.target.value) })} className="w-full" />
              </label>
            )}
            {sel.type === 'products' && (
              <div className="space-y-2">
                <select className="field-input" value="" onChange={(e) => {
                  const p = products.find((x) => x.id === e.target.value);
                  if (!p || (sel.items?.length ?? 0) >= 6) return;
                  patchBlock(sel.id, { items: [...(sel.items ?? []), { name: p.name, price: `$${(p.salePrice ?? p.price).toFixed(2)}`, image: p.image, href: `/product/${p.slug}` }] });
                }}>
                  <option value="">Add a product… (up to 6)</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {(sel.items ?? []).map((it, n) => (
                  <div key={`${it.href}${n}`} className="flex items-center gap-2 text-xs">
                    <span className="min-w-0 flex-1 truncate">{it.name}</span>
                    <input className="field-input min-h-8 w-20 py-1" value={it.price} onChange={(e) => patchBlock(sel.id, { items: sel.items!.map((x, k) => (k === n ? { ...x, price: e.target.value } : x)) })} />
                    <button type="button" onClick={() => patchBlock(sel.id, { items: sel.items!.filter((_, k) => k !== n) })} className="p-1 text-brand-textMuted hover:text-action"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="field-label mb-0">Preview</span>
          <div className="flex border border-brand-borderLight">
            {([['desktop', Monitor], ['mobile', Smartphone]] as const).map(([d, Icon]) => (
              <button key={d} type="button" onClick={() => setDevice(d)} aria-label={d}
                className={`p-2 ${device === d ? 'bg-brand-accent text-brand-onAccent' : 'text-brand-body'}`}><Icon className="h-4 w-4" /></button>
            ))}
          </div>
        </div>
        <div className="flex justify-center border border-brand-border bg-brand-dark p-3">
          <iframe title="Email preview" sandbox="allow-same-origin" srcDoc={html}
            className="h-[70vh] border border-brand-border bg-white" style={{ width: device === 'mobile' ? 375 : '100%', maxWidth: 680 }} />
        </div>
      </div>
    </div>
  );
}

function SendStep({ draft, authedFetch, emailReady, goto, ensureSaved, onSent, onTested }: {
  draft: Draft; authedFetch: Fetcher; emailReady: boolean; goto: (s: Step) => void;
  ensureSaved: () => Promise<string | null>; onSent: (id: string) => void; onTested: () => void;
}) {
  const [testTo, setTestTo] = useState('');
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [at, setAt] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    authedFetch('/api/admin/campaigns/audience', { method: 'POST', body: JSON.stringify({ audience: draft.audience, filter: draft.audience_filter }) })
      .then(json).then((d) => setCount(d.count)).catch(() => setCount(null));
  }, [draft.audience, draft.audience_filter, authedFetch]);

  const hasContent = draft.design.blocks.length > 0;
  const checks: [boolean, string, Step][] = [
    [Boolean(draft.subject.trim()), 'Subject line written', 'setup'],
    [Boolean(count), `Audience: ${AUDIENCES.find((a) => a.id === draft.audience)?.label} — ${count ?? '…'} people`, 'audience'],
    [hasContent, 'Email has content', 'design'],
    [Boolean(draft.last_test_at), draft.last_test_at ? `Test sent ${new Date(draft.last_test_at).toLocaleString()}` : 'Send yourself a test (recommended)', 'send'],
    [emailReady, emailReady ? 'Email account connected' : 'Email account not connected — add SMTP settings in Vercel', 'send'],
  ];
  const canSend = checks.slice(0, 3).every(([ok]) => ok) && emailReady && (when === 'now' || Boolean(at));

  const test = async () => {
    setBusy('test'); setMsg('');
    try {
      const id = await ensureSaved();
      if (!id) return;
      const d = await json(await authedFetch('/api/admin/campaigns/send', { method: 'POST', body: JSON.stringify({ id, mode: 'test', to: testTo }) }));
      setMsg(`Test sent to ${d.sent} address${d.sent === 1 ? '' : 'es'}.`);
      onTested();
    } catch (err) { setMsg((err as Error).message); }
    finally { setBusy(''); }
  };

  const send = async () => {
    const label = when === 'now' ? `Send to ${count} people now?` : `Schedule for ${new Date(at).toLocaleString()} to ${count} people?`;
    if (!window.confirm(`${label} This cannot be undone once emails go out.`)) return;
    setBusy('send'); setMsg('');
    try {
      const id = await ensureSaved();
      if (!id) return;
      await json(await authedFetch('/api/admin/campaigns/send', {
        method: 'POST',
        body: JSON.stringify({ id, mode: 'start', audience: draft.audience, filter: draft.audience_filter, scheduledAt: when === 'later' ? new Date(at).toISOString() : null }),
      }));
      onSent(id);
    } catch (err) { setMsg((err as Error).message); }
    finally { setBusy(''); }
  };

  return (
    <div className="grid max-w-4xl gap-4 lg:grid-cols-2">
      <div className="space-y-2 border border-brand-border bg-brand-card p-4">
        <p className="field-label">Checklist</p>
        {checks.map(([ok, label, target]) => (
          <button key={label} type="button" onClick={() => goto(target)} className="flex w-full items-start gap-2 text-left text-xs">
            {ok ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-brand-accentGlow" /> : <Circle className="h-4 w-4 flex-shrink-0 text-action" />}
            <span className={ok ? 'text-brand-body' : 'text-brand-heading'}>{label}</span>
          </button>
        ))}
      </div>

      <div className="space-y-4 border border-brand-border bg-brand-card p-4">
        <div>
          <p className="field-label">Send a test</p>
          <div className="flex gap-2">
            <input className="field-input" placeholder="you@example.com, colleague@example.com" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
            <button className="btn-secondary" disabled={!testTo.trim() || busy === 'test' || !emailReady} onClick={() => void test()}>
              {busy === 'test' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />} Test
            </button>
          </div>
        </div>

        <div>
          <p className="field-label">When</p>
          <div className="flex gap-4 text-xs">
            <label className="flex items-center gap-1.5"><input type="radio" checked={when === 'now'} onChange={() => setWhen('now')} /> Now</label>
            <label className="flex items-center gap-1.5"><input type="radio" checked={when === 'later'} onChange={() => setWhen('later')} /> Later</label>
          </div>
          {when === 'later' && (
            <>
              <input type="datetime-local" className="field-input mt-2" value={at} onChange={(e) => setAt(e.target.value)} />
              <p className="mt-1 text-[0.6875rem] text-brand-textMuted">Starts at that time if the dashboard is open, otherwise at the next daily check.</p>
            </>
          )}
        </div>

        <button className="btn-action w-full" disabled={!canSend || busy === 'send'} onClick={() => void send()}>
          {busy === 'send' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {when === 'now' ? `Send to ${count ?? '…'} people` : 'Schedule'}
        </button>
        {msg && <p className="text-xs text-brand-body">{msg}</p>}
      </div>
    </div>
  );
}

/* ================================================================= report */

interface Recipient {
  id: string; email: string; name: string | null; source: string; status: string; error: string | null;
  sent_at: string | null; opened_at: string | null; open_count: number; clicked_at: string | null; click_count: number; unsubscribed_at: string | null;
}

function Report({ id, authedFetch, onBack, onEdit }: { id: string; authedFetch: Fetcher; onBack: () => void; onEdit: (id: string) => void }) {
  const [data, setData] = useState<{ campaign: Campaign; recipients: Recipient[]; links: { url: string; count: number }[] } | null>(null);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try { setData(await json(await authedFetch(`/api/admin/campaigns/manage?id=${encodeURIComponent(id)}`))); }
    catch (err) { setError((err as Error).message); }
  }, [authedFetch, id]);

  useEffect(() => { void load(); }, [load]);

  // While sending, keep batches going and the numbers fresh.
  const status = data?.campaign.status;
  useEffect(() => {
    if (status !== 'sending' && status !== 'scheduled') return;
    let stop = false;
    const tick = async () => {
      if (stop) return;
      if (status === 'sending') {
        try { await json(await authedFetch('/api/admin/campaigns/send', { method: 'POST', body: JSON.stringify({ id, mode: 'batch' }) })); }
        catch (err) { setError((err as Error).message); }
      }
      await load();
      if (!stop) window.setTimeout(tick, status === 'sending' ? 3000 : 30000);
    };
    const timer = window.setTimeout(tick, 1500);
    return () => { stop = true; window.clearTimeout(timer); };
  }, [status, authedFetch, id, load]);

  const act = async (mode: 'pause' | 'resume' | 'cancel') => {
    setBusy(mode);
    try { await json(await authedFetch('/api/admin/campaigns/send', { method: 'POST', body: JSON.stringify({ id, mode }) })); await load(); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(''); }
  };

  if (!data) return <p className="flex items-center gap-2 text-xs text-brand-textMuted"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading report… {error}</p>;

  const c = data.campaign;
  const sent = c.sent_count;
  const done = data.recipients.filter((r) => r.status !== 'queued' && r.status !== 'sending').length;
  const shown = data.recipients.filter((r) => filter === 'all'
    || (filter === 'opened' && r.opened_at) || (filter === 'clicked' && r.clicked_at)
    || (filter === 'unopened' && r.status === 'sent' && !r.opened_at) || (filter === 'failed' && r.status === 'failed')
    || (filter === 'unsubscribed' && r.unsubscribed_at));

  const exportRecipients = () => exportSheet('csv', {
    filename: `campaign-${c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${stamp()}`,
    title: c.name,
    headers: ['Email', 'Name', 'List', 'Status', 'Sent', 'Opened', 'Opens', 'Clicked', 'Clicks', 'Unsubscribed', 'Error'],
    rows: data.recipients.map((r) => [r.email, r.name ?? '', r.source, r.status, r.sent_at ?? '', r.opened_at ?? '', r.open_count, r.clicked_at ?? '', r.click_count, r.unsubscribed_at ?? '', r.error ?? '']),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-secondary" onClick={onBack}><ArrowLeft className="h-3.5 w-3.5" /> Campaigns</button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-sm font-extrabold uppercase tracking-[0.06em] text-brand-heading">{c.name}</h2>
          <p className="truncate text-xs text-brand-textMuted">{c.subject}</p>
        </div>
        <span className={`chip ${STATUS_CHIP[c.status] ?? ''}`}>{CAMPAIGN_STATUS_LABEL[c.status] ?? c.status}</span>
        {c.status === 'sending' && <button className="btn-secondary" disabled={busy === 'pause'} onClick={() => void act('pause')}><Pause className="h-3.5 w-3.5" /> Pause</button>}
        {c.status === 'paused' && <button className="btn-secondary" disabled={busy === 'resume'} onClick={() => void act('resume')}><Play className="h-3.5 w-3.5" /> Resume</button>}
        {c.status === 'scheduled' && (
          <>
            <button className="btn-secondary" onClick={() => onEdit(c.id)}><Pencil className="h-3.5 w-3.5" /> Edit</button>
            <button className="btn-secondary" disabled={busy === 'cancel'} onClick={() => void act('cancel')}><X className="h-3.5 w-3.5" /> Unschedule</button>
          </>
        )}
        <button className="btn-secondary" onClick={() => void load()}><RefreshCw className="h-3.5 w-3.5" /></button>
      </div>
      {error && <p className="border border-action/50 bg-brand-card p-3 text-xs text-brand-body">{error}</p>}

      {c.status === 'scheduled' && c.scheduled_at && (
        <p className="border border-brand-border bg-brand-card p-3 text-xs">Scheduled for <strong>{new Date(c.scheduled_at).toLocaleString()}</strong> to {c.recipient_count} people.</p>
      )}
      {(c.status === 'sending' || c.status === 'paused') && (
        <div className="border border-brand-border bg-brand-card p-3">
          <div className="flex justify-between text-xs"><span>{c.status === 'sending' ? 'Sending — keep this page open to go faster' : 'Paused'}</span><span className="font-mono">{done} / {c.recipient_count}</span></div>
          <div className="mt-2 h-2 bg-brand-dark"><div className="h-2 bg-action transition-all" style={{ width: `${c.recipient_count ? (done / c.recipient_count) * 100 : 0}%` }} /></div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-px border border-brand-border bg-brand-border md:grid-cols-3 xl:grid-cols-6">
        {([
          ['Recipients', c.recipient_count, Users],
          ['Delivered', sent, Send],
          ['Failed', c.failed_count, X],
          ['Opened', `${pct(c.open_count, sent)} (${c.open_count})`, Eye],
          ['Clicked', `${pct(c.click_count, sent)} (${c.click_count})`, MousePointerClick],
          ['Unsubscribed', c.unsubscribe_count, Mail],
        ] as const).map(([label, value, Icon]) => (
          <div key={label} className="bg-brand-card p-4">
            <div className="eyebrow flex items-center gap-1.5"><Icon className="h-3 w-3" /> {label}</div>
            <div className="mt-2 font-display text-lg font-black text-brand-heading">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="border border-brand-border bg-brand-card p-3">
          <p className="field-label">Most clicked links</p>
          {data.links.length === 0 ? <p className="text-xs text-brand-textMuted">No clicks yet.</p> : (
            <ul className="space-y-1.5 text-xs">
              {data.links.map((l) => (
                <li key={l.url} className="flex gap-2">
                  <span className="min-w-0 flex-1 truncate" title={l.url}>{l.url.replace(/^https?:\/\//, '')}</span>
                  <span className="font-mono text-brand-heading">{l.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border border-brand-border bg-brand-card">
          <div className="flex flex-wrap items-center gap-1.5 border-b border-brand-border p-2">
            {['all', 'opened', 'clicked', 'unopened', 'failed', 'unsubscribed'].map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`chip ${filter === f ? 'bg-brand-accent text-brand-onAccent' : 'border border-brand-borderLight text-brand-body'}`}>{f}</button>
            ))}
            <button className="btn-secondary ml-auto px-2 py-1" onClick={() => void exportRecipients()} disabled={!data.recipients.length}><Download className="h-3 w-3" /> CSV</button>
          </div>
          <div className="max-h-[50vh] overflow-auto">
            <table className="w-full min-w-[40rem] text-left text-xs">
              <thead className="sticky top-0 bg-brand-card"><tr>{['Recipient', 'List', 'Status', 'Opened', 'Clicked'].map((h) => (
                <th key={h} className="px-3 py-2 font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.1em] text-brand-textMuted">{h}</th>
              ))}</tr></thead>
              <tbody>
                {shown.slice(0, 1000).map((r) => (
                  <tr key={r.id} className="border-t border-brand-border/60">
                    <td className="px-3 py-1.5"><span className="text-brand-heading">{r.email}</span>{r.name && <span className="ml-1 text-brand-textMuted">{r.name}</span>}</td>
                    <td className="px-3 py-1.5 text-brand-textMuted">{r.source}</td>
                    <td className="px-3 py-1.5" title={r.error ?? undefined}>{r.unsubscribed_at ? 'unsubscribed' : r.status}</td>
                    <td className="px-3 py-1.5">{r.opened_at ? `${r.open_count}×` : '—'}</td>
                    <td className="px-3 py-1.5">{r.clicked_at ? `${r.click_count}×` : '—'}</td>
                  </tr>
                ))}
                {!shown.length && <tr><td colSpan={5} className="p-6 text-center text-brand-textMuted">Nobody here yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
