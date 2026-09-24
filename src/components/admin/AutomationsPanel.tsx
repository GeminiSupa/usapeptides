'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, Clock, Copy, Flag, GitBranch, Loader2,
  Mail, Pause, Play, Plus, RefreshCw, Send, ShieldCheck, Trash2, Users, X, XCircle,
} from 'lucide-react';
import EmailBlockEditor from './EmailBlockEditor';
import { type UploadKind } from './UploadField';
import { useSiteContent } from '@/components/SiteContentProvider';
import {
  AUTOMATION_STATUS_LABEL, CONDITIONS, ENROLLMENT_STATUS_LABEL, ON_FAIL_OPTIONS, STEP_KINDS,
  TRIGGERS, WAIT_UNITS, sequenceProblems, splitWait, stepSummary, totalDuration, triggerLabel,
  DEFAULT_CART_AGE_HOURS, type OnFail, type Step, type StepKind, type TriggerId,
} from '@/lib/automations';
import { checkEmail, VERDICT_LABEL, type SpamReport } from '@/lib/emailHealth';
import { AUDIENCES, sanitizeDesign, type EmailDesign } from '@/lib/emailDesign';

/**
 * Email automation.
 *
 *   Deliverability  why our mail lands in spam, and the warm-up limit
 *   Sequences       the drip builder: a vertical list of steps, top to bottom
 *
 * The builder is a list rather than a canvas on purpose. A sequence runs in
 * one direction, so a column of cards says exactly what will happen and stays
 * usable on a phone.
 *
 * Nothing here assumes this business: the triggers, audiences and limits all
 * come from shared lists.
 */

type Fetcher = (path: string, init?: RequestInit) => Promise<Response>;

interface Automation {
  id: string; name: string; description: string | null;
  trigger_type: TriggerId; trigger_config: { cartAgeHours?: number; minOrderTotal?: number } | null;
  status: string; allow_reentry: boolean; stop_on_order: boolean;
  enrolled_count: number; completed_count: number; sent_count: number;
  created_at: string; updated_at: string;
}

interface Enrollment {
  id: string; email: string; name: string | null; source: string | null; status: string;
  current_position: number; next_run_at: string | null; stopped_reason: string | null;
  enrolled_at: string; completed_at: string | null;
}

interface StepStat { sent: number; opened: number; clicked: number; failed: number }

const STATUS_CHIP: Record<string, string> = {
  draft: 'border border-brand-borderLight text-brand-textMuted',
  active: 'bg-brand-accent text-brand-onAccent',
  paused: 'border border-action text-action',
};

const KIND_ICON: Record<StepKind, typeof Mail> = {
  email: Mail, wait: Clock, condition: GitBranch, goal: Flag,
};

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 1000) / 10}%` : '—');

async function json(res: Response) {
  const p = await res.json().catch(() => null);
  if (!res.ok) throw new Error(p?.message ?? 'Something went wrong.');
  return p.data;
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '—');

/* ========================================================================== */

export default function AutomationsPanel({ authedFetch, upload }: {
  authedFetch: Fetcher;
  upload: (file: File, kind: UploadKind) => Promise<string>;
}) {
  const [tab, setTab] = useState<'sequences' | 'health'>('sequences');
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {([['sequences', 'Sequences'], ['health', 'Deliverability']] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => { setTab(id); setOpenId(null); }}
            className={`chip ${tab === id ? 'bg-brand-accent text-brand-onAccent' : 'border border-brand-borderLight text-brand-heading'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'health' ? (
        <Deliverability authedFetch={authedFetch} />
      ) : openId ? (
        <Builder id={openId} authedFetch={authedFetch} upload={upload} onBack={() => setOpenId(null)} />
      ) : (
        <SequenceList authedFetch={authedFetch} onOpen={setOpenId} />
      )}
    </div>
  );
}

/* --------------------------------------------------------- the spam side -- */

interface Check {
  id: string; label: string; status: 'pass' | 'warn' | 'fail' | 'unknown';
  detail: string; fix?: string; record?: { type: string; name: string; value: string }; found?: string[];
}

interface HealthData {
  dns: { sendingDomain: string | null; fromAddress: string | null; provider: string; checks: Check[]; score: { passed: number; total: number }; error: string | null };
  policy: { warmup_enabled: boolean; warmup_started_on: string | null; daily_cap_override: number | null; max_daily_cap: number };
  today: { cap: number | null; reason: string; warmupDay: number | null };
  sentToday: number;
  remaining: number | null;
  ready: boolean;
  notice: string | null;
  schedule: { day: number; cap: number }[];
  warmupDays: number;
}

function Deliverability({ authedFetch }: { authedFetch: Fetcher }) {
  const [data, setData] = useState<HealthData | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<HealthData['policy'] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const d = await json(await authedFetch('/api/admin/deliverability'));
      setData(d);
      setForm(d.policy);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load.');
    } finally {
      setBusy(false);
    }
  }, [authedFetch]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      await json(await authedFetch('/api/admin/deliverability', {
        method: 'POST',
        body: JSON.stringify({ action: 'save', ...form }),
      }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const copy = (text: string, id: string) => {
    void navigator.clipboard?.writeText(text);
    setCopied(id);
    window.setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
  };

  if (busy && !data) return <Loading />;

  const failing = data?.dns.checks.filter((c) => c.status === 'fail').length ?? 0;

  return (
    <div className="space-y-4">
      {error && <Banner tone="bad">{error}</Banner>}
      {data?.notice && <Banner tone="warn">{data.notice}</Banner>}

      <section className="border border-brand-border bg-brand-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-sm font-extrabold uppercase tracking-[0.08em] text-brand-heading">
              Why email lands in spam
            </h3>
            <p className="mt-1 max-w-2xl text-[0.8125rem] text-brand-body">
              A new domain has no reputation, so these three DNS records are the only thing telling Gmail
              the mail is really ours. Missing any of them is the most common reason a new store goes
              straight to the junk folder. No drip sequence can make up for it.
            </p>
          </div>
          <button type="button" onClick={() => void load()} className="btn-secondary btn-sm" disabled={busy}>
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} /> Check again
          </button>
        </div>

        {data && (
          <p className="mt-3 text-[0.8125rem] text-brand-body">
            Sending as <strong className="text-brand-heading">{data.dns.fromAddress ?? 'nothing configured'}</strong>
            {data.dns.sendingDomain ? <> on <strong className="text-brand-heading">{data.dns.sendingDomain}</strong></> : null}.{' '}
            {failing === 0
              ? 'Everything that can be checked from here is in place.'
              : `${failing} thing${failing === 1 ? '' : 's'} need${failing === 1 ? 's' : ''} fixing below.`}
          </p>
        )}

        <ul className="mt-3 divide-y divide-brand-border/60 border border-brand-border">
          {(data?.dns.checks ?? []).map((check) => (
            <li key={check.id} className="p-3">
              <div className="flex items-start gap-2.5">
                <StatusDot status={check.status} />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.1em] text-brand-heading">
                    {check.label}
                  </p>
                  <p className="mt-0.5 text-[0.8125rem] text-brand-body">{check.detail}</p>
                  {check.fix && <p className="mt-1 text-[0.8125rem] text-brand-textMuted">{check.fix}</p>}

                  {check.record && (
                    <div className="mt-2 border border-brand-borderLight bg-brand-dark p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="field-label mb-0">Add this record</span>
                        <button type="button" onClick={() => copy(check.record!.value, check.id)} className="btn-ghost btn-sm">
                          <Copy className="h-3 w-3" /> {copied === check.id ? 'Copied' : 'Copy value'}
                        </button>
                      </div>
                      <dl className="mt-1.5 grid grid-cols-[4rem_minmax(0,1fr)] gap-x-3 gap-y-1 text-[0.75rem]">
                        <dt className="text-brand-textMuted">Type</dt><dd className="text-brand-body">{check.record.type}</dd>
                        <dt className="text-brand-textMuted">Name</dt><dd className="break-all text-brand-body">{check.record.name}</dd>
                        <dt className="text-brand-textMuted">Value</dt><dd className="break-all text-brand-body">{check.record.value}</dd>
                      </dl>
                    </div>
                  )}

                  {check.found?.length ? (
                    <p className="mt-1.5 break-all text-[0.6875rem] text-brand-textMuted">Found: {check.found.join(' · ')}</p>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
          {!data?.dns.checks.length && <li className="p-6 text-center text-xs text-brand-textMuted">Nothing to check yet.</li>}
        </ul>
      </section>

      <section className="border border-brand-border bg-brand-card p-4">
        <h3 className="font-display text-sm font-extrabold uppercase tracking-[0.08em] text-brand-heading">
          Daily sending limit
        </h3>
        <p className="mt-1 max-w-2xl text-[0.8125rem] text-brand-body">
          A domain that sends five hundred emails on its first day gets its first impression made by a spam
          filter. The warm-up raises the limit gradually over {data?.warmupDays ?? 26} days. Campaigns and
          automations both obey it: anything over the limit waits for tomorrow rather than being dropped.
        </p>

        {data && (
          <div className="mt-3 border border-brand-borderLight bg-brand-dark p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-display text-lg font-extrabold text-brand-heading">
                {data.sentToday} / {data.today.cap ?? 'no limit'}
              </span>
              <span className="text-[0.75rem] text-brand-textMuted">{data.today.reason}</span>
            </div>
            <div className="mt-2 h-2 w-full border border-brand-border bg-brand-card">
              <div className="h-full bg-brand-accent"
                style={{ width: `${data.today.cap ? Math.min(100, Math.round((data.sentToday / data.today.cap) * 100)) : 0}%` }} />
            </div>
            <p className="mt-1.5 text-[0.75rem] text-brand-textMuted">
              {data.remaining === null ? 'No limit is in force.' : `${data.remaining} left today.`}
            </p>
          </div>
        )}

        {form && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex items-start gap-2 text-[0.8125rem] text-brand-body">
              <input type="checkbox" className="mt-0.5" checked={form.warmup_enabled}
                onChange={(e) => setForm({ ...form, warmup_enabled: e.target.checked })} />
              <span>
                <span className="text-brand-heading">Warm the domain up gradually</span>
                <span className="block text-brand-textMuted">Strongly recommended for the first month.</span>
              </span>
            </label>

            <label className="block">
              <span className="field-label">Warm-up started on</span>
              <input type="date" className="field-input" value={form.warmup_started_on ?? ''}
                onChange={(e) => setForm({ ...form, warmup_started_on: e.target.value || null })} />
            </label>

            <label className="block">
              <span className="field-label">Ceiling once warmed up</span>
              <input type="number" min={1} className="field-input" value={form.max_daily_cap}
                onChange={(e) => setForm({ ...form, max_daily_cap: Number(e.target.value) })} />
            </label>

            <label className="block">
              <span className="field-label">Override today (leave empty to follow the schedule)</span>
              <input type="number" min={0} className="field-input" value={form.daily_cap_override ?? ''}
                onChange={(e) => setForm({ ...form, daily_cap_override: e.target.value === '' ? null : Number(e.target.value) })} />
            </label>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void save()} className="btn-primary btn-sm" disabled={saving || !form}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />} Save limits
          </button>
          {data?.schedule.length ? (
            <span className="text-[0.75rem] text-brand-textMuted">
              Schedule: {data.schedule.map((s) => `day ${s.day}: ${s.cap}`).join(' · ')}, then the ceiling.
            </span>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function StatusDot({ status }: { status: Check['status'] }) {
  if (status === 'pass') return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent" />;
  if (status === 'warn') return <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-action" />;
  if (status === 'fail') return <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-action" />;
  return <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-brand-textMuted" />;
}

/* ------------------------------------------------------------- the list -- */

function SequenceList({ authedFetch, onOpen }: { authedFetch: Fetcher; onOpen: (id: string) => void }) {
  const [rows, setRows] = useState<Automation[]>([]);
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailReady, setEmailReady] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const d = await json(await authedFetch('/api/admin/automations/manage'));
      setRows(d.automations ?? []);
      setNotice(d.notice ?? null);
      setEmailReady(Boolean(d.emailReady));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load.');
    } finally {
      setBusy(false);
    }
  }, [authedFetch]);

  useEffect(() => { void load(); }, [load]);

  const create = async (trigger: TriggerId) => {
    setCreating(true);
    setError(null);
    try {
      const d = await json(await authedFetch('/api/admin/automations/manage', {
        method: 'POST',
        body: JSON.stringify({
          name: `${triggerLabel(trigger).replace(/ -.*$/, '')} sequence`,
          trigger_type: trigger,
        }),
      }));
      onOpen(d.automation.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create it.');
    } finally {
      setCreating(false);
    }
  };

  const remove = async (row: Automation) => {
    if (!window.confirm(`Delete "${row.name}" and everybody in it? This cannot be undone.`)) return;
    try {
      await json(await authedFetch(`/api/admin/automations/manage?id=${row.id}`, { method: 'DELETE' }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete it.');
    }
  };

  const duplicate = async (row: Automation) => {
    try {
      const d = await json(await authedFetch('/api/admin/automations/manage', {
        method: 'POST', body: JSON.stringify({ action: 'duplicate', id: row.id }),
      }));
      onOpen(d.automation.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not copy it.');
    }
  };

  if (busy && !rows.length && !notice) return <Loading />;

  return (
    <div className="space-y-4">
      {error && <Banner tone="bad">{error}</Banner>}
      {notice && <Banner tone="warn">{notice}</Banner>}
      {!emailReady && (
        <Banner tone="warn">
          No email service is connected, so nothing can be sent yet. You can still build sequences.
        </Banner>
      )}

      <section className="border border-brand-border bg-brand-card p-4">
        <h3 className="font-display text-sm font-extrabold uppercase tracking-[0.08em] text-brand-heading">
          Start a sequence
        </h3>
        <p className="mt-1 text-[0.8125rem] text-brand-body">Pick what sets it off. You can change this later.</p>
        <div className="mt-2.5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {TRIGGERS.map((t) => (
            <button key={t.id} type="button" disabled={creating} onClick={() => void create(t.id)}
              className="border border-brand-borderLight p-3 text-left hover:border-brand-accent disabled:opacity-50">
              <span className="block font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.1em] text-brand-heading">
                {t.label}
              </span>
              <span className="mt-1 block text-[0.75rem] text-brand-textMuted">{t.description}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="overflow-x-auto border border-brand-border bg-brand-card">
        <table className="w-full text-left text-[0.8125rem]">
          <thead className="border-b border-brand-border">
            <tr className="font-display text-[0.6875rem] uppercase tracking-[0.1em] text-brand-textMuted">
              <th className="px-3 py-2.5">Sequence</th>
              <th className="px-3 py-2.5">Starts when</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5 text-right">In it</th>
              <th className="px-3 py-2.5 text-right">Finished</th>
              <th className="px-3 py-2.5 text-right">Emails sent</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border/60">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-brand-dark">
                <td className="px-3 py-2.5">
                  <button type="button" onClick={() => onOpen(row.id)} className="text-left text-brand-heading hover:text-brand-accent">
                    {row.name}
                  </button>
                  {row.description && <span className="block text-[0.75rem] text-brand-textMuted">{row.description}</span>}
                </td>
                <td className="px-3 py-2.5 text-brand-body">{triggerLabel(row.trigger_type)}</td>
                <td className="px-3 py-2.5">
                  <span className={`chip ${STATUS_CHIP[row.status] ?? ''}`}>{AUTOMATION_STATUS_LABEL[row.status] ?? row.status}</span>
                </td>
                <td className="px-3 py-2.5 text-right text-brand-body">{row.enrolled_count}</td>
                <td className="px-3 py-2.5 text-right text-brand-body">{row.completed_count}</td>
                <td className="px-3 py-2.5 text-right text-brand-body">{row.sent_count}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right">
                  <button type="button" aria-label="Duplicate" onClick={() => void duplicate(row)} className="p-1 text-brand-textMuted hover:text-brand-heading">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" aria-label="Delete" onClick={() => void remove(row)} className="p-1 text-brand-textMuted hover:text-action">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={7} className="p-8 text-center text-xs text-brand-textMuted">No sequences yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- the builder -- */

interface LoadedSteps extends Step { design: EmailDesign }

function Builder({ id, authedFetch, upload, onBack }: {
  id: string; authedFetch: Fetcher; upload: (file: File, kind: UploadKind) => Promise<string>; onBack: () => void;
}) {
  const { t } = useSiteContent();
  const [automation, setAutomation] = useState<Automation | null>(null);
  const [steps, setSteps] = useState<LoadedSteps[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [stats, setStats] = useState<Record<string, StepStat>>({});
  const [view, setView] = useState<'steps' | 'people'>('steps');
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const dirty = useRef(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const d = await json(await authedFetch(`/api/admin/automations/manage?id=${id}`));
      setAutomation(d.automation);
      setSteps((d.steps ?? []).map((s: LoadedSteps) => ({ ...s, design: sanitizeDesign(s.design) })));
      setEnrollments(d.enrollments ?? []);
      setStats(d.stepStats ?? {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load.');
    } finally {
      setBusy(false);
    }
  }, [authedFetch, id]);

  useEffect(() => { void load(); }, [load]);

  const problems = useMemo(() => sequenceProblems(steps), [steps]);

  const save = useCallback(async () => {
    if (!automation) return;
    setSaving('saving');
    setError(null);
    try {
      const d = await json(await authedFetch('/api/admin/automations/manage', {
        method: 'PATCH',
        body: JSON.stringify({
          id,
          name: automation.name,
          description: automation.description,
          trigger_type: automation.trigger_type,
          trigger_config: automation.trigger_config ?? {},
          allow_reentry: automation.allow_reentry,
          stop_on_order: automation.stop_on_order,
          steps,
        }),
      }));
      // Keep the ids the server assigned, or a new step is created on every save.
      setSteps((d.steps ?? []).map((s: LoadedSteps) => ({ ...s, design: sanitizeDesign(s.design) })));
      dirty.current = false;
      setSaving('saved');
      window.setTimeout(() => setSaving((s) => (s === 'saved' ? 'idle' : s)), 1800);
    } catch (err) {
      setSaving('idle');
      setError(err instanceof Error ? err.message : 'Could not save.');
    }
  }, [authedFetch, automation, id, steps]);

  // Autosave, quietly, a moment after typing stops.
  useEffect(() => {
    if (!dirty.current || busy) return undefined;
    const timer = window.setTimeout(() => { void save(); }, 1400);
    return () => window.clearTimeout(timer);
  }, [steps, automation, busy, save]);

  const touch = () => { dirty.current = true; };

  const patchAutomation = (patch: Partial<Automation>) => {
    setAutomation((a) => (a ? { ...a, ...patch } : a));
    touch();
  };

  const setStep = (stepId: string, patch: Partial<LoadedSteps>) => {
    setSteps((list) => list.map((s) => (s.id === stepId ? { ...s, ...patch } : s)));
    touch();
  };

  const addStep = (kind: StepKind, at: number) => {
    const fresh: LoadedSteps = {
      // A temporary id: the server replaces it with a real one on save.
      id: `new-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      kind,
      subject: kind === 'email' ? '' : null,
      preview_text: null, from_name: null, reply_to: null,
      design: sanitizeDesign({ blocks: [] }),
      wait_minutes: kind === 'wait' ? 1440 : 0,
      condition_type: kind === 'condition' ? 'opened_previous' : null,
      on_fail: 'continue',
    };
    setSteps((list) => [...list.slice(0, at), fresh, ...list.slice(at)]);
    setOpen(fresh.id);
    touch();
  };

  const move = (index: number, direction: -1 | 1) => {
    const next = index + direction;
    if (next < 0 || next >= steps.length) return;
    setSteps((list) => {
      const copy = [...list];
      [copy[index], copy[next]] = [copy[next], copy[index]];
      return copy;
    });
    touch();
  };

  const removeStep = (stepId: string) => {
    setSteps((list) => list.filter((s) => s.id !== stepId));
    if (open === stepId) setOpen(null);
    touch();
  };

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    setError(null);
    setMessage(null);
    try {
      if (dirty.current) await save();
      const d = await json(await authedFetch('/api/admin/automations/actions', {
        method: 'POST', body: JSON.stringify({ id, action, ...extra }),
      }));
      await load();
      return d;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.');
      return null;
    }
  };

  if (busy && !automation) return <Loading />;
  if (!automation) return <Banner tone="bad">{error ?? 'That automation no longer exists.'}</Banner>;

  const live = automation.status === 'active';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onBack} className="btn-ghost btn-sm"><ArrowLeft className="h-3.5 w-3.5" /> All sequences</button>
        <span className={`chip ${STATUS_CHIP[automation.status] ?? ''}`}>{AUTOMATION_STATUS_LABEL[automation.status] ?? automation.status}</span>
        <span className="text-[0.75rem] text-brand-textMuted">
          {saving === 'saving' ? 'Saving…' : saving === 'saved' ? 'Saved' : `Takes ${totalDuration(steps)} end to end`}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          {live ? (
            <button type="button" onClick={() => void act('pause')} className="btn-secondary btn-sm"><Pause className="h-3.5 w-3.5" /> Pause</button>
          ) : (
            <button type="button" onClick={() => void act('activate')} className="btn-primary btn-sm" disabled={problems.length > 0}>
              <Play className="h-3.5 w-3.5" /> Turn on
            </button>
          )}
          {live && (
            <button type="button" onClick={async () => {
              const d = await act('run');
              if (d) setMessage(`Moved ${d.processed} along, sent ${d.sent}.${d.held ? ` ${d.held}` : ''}`);
            }} className="btn-secondary btn-sm">
              <RefreshCw className="h-3.5 w-3.5" /> Run due now
            </button>
          )}
        </div>
      </div>

      {error && <Banner tone="bad">{error}</Banner>}
      {message && <Banner tone="good">{message}</Banner>}

      <section className="grid gap-3 border border-brand-border bg-brand-card p-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="field-label">Name</span>
          <input className="field-input" value={automation.name} onChange={(e) => patchAutomation({ name: e.target.value })} />
        </label>

        <label className="block">
          <span className="field-label">Starts when</span>
          <select className="field-input" value={automation.trigger_type}
            onChange={(e) => patchAutomation({ trigger_type: e.target.value as TriggerId })}>
            {TRIGGERS.map((tr) => <option key={tr.id} value={tr.id}>{tr.label}</option>)}
          </select>
          <span className="mt-1 block text-[0.75rem] text-brand-textMuted">
            {TRIGGERS.find((tr) => tr.id === automation.trigger_type)?.description}
          </span>
        </label>

        {automation.trigger_type === 'abandoned_cart' && (
          <label className="block">
            <span className="field-label">Hours before a cart counts as abandoned</span>
            <input type="number" min={1} max={168} className="field-input"
              value={automation.trigger_config?.cartAgeHours ?? DEFAULT_CART_AGE_HOURS}
              onChange={(e) => patchAutomation({ trigger_config: { ...automation.trigger_config, cartAgeHours: Number(e.target.value) } })} />
          </label>
        )}

        {automation.trigger_type === 'order_placed' && (
          <label className="block">
            <span className="field-label">Only orders of at least (leave empty for all)</span>
            <input type="number" min={0} step="0.01" className="field-input"
              value={automation.trigger_config?.minOrderTotal ?? ''}
              onChange={(e) => patchAutomation({ trigger_config: { ...automation.trigger_config, minOrderTotal: e.target.value === '' ? undefined : Number(e.target.value) } })} />
          </label>
        )}

        <label className="flex items-start gap-2 text-[0.8125rem] text-brand-body">
          <input type="checkbox" className="mt-0.5" checked={automation.stop_on_order}
            onChange={(e) => patchAutomation({ stop_on_order: e.target.checked })} />
          <span>
            <span className="text-brand-heading">Stop when they order</span>
            <span className="block text-brand-textMuted">Nobody gets chased for a cart they already paid for.</span>
          </span>
        </label>

        <label className="flex items-start gap-2 text-[0.8125rem] text-brand-body">
          <input type="checkbox" className="mt-0.5" checked={automation.allow_reentry}
            onChange={(e) => patchAutomation({ allow_reentry: e.target.checked })} />
          <span>
            <span className="text-brand-heading">Allow the same person round again</span>
            <span className="block text-brand-textMuted">Off for a welcome series, on for a repeat cart reminder.</span>
          </span>
        </label>
      </section>

      {problems.length > 0 && (
        <Banner tone="warn">
          <span className="font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.1em]">Before this can run</span>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {problems.map((p, i) => <li key={`${p.stepId}${i}`}>{p.message}</li>)}
          </ul>
        </Banner>
      )}

      <div className="flex flex-wrap gap-1.5">
        {([['steps', 'Steps'], ['people', `People (${enrollments.length})`]] as const).map(([v, label]) => (
          <button key={v} type="button" onClick={() => setView(v)}
            className={`chip ${view === v ? 'bg-brand-accent text-brand-onAccent' : 'border border-brand-borderLight text-brand-heading'}`}>
            {label}
          </button>
        ))}
      </div>

      {view === 'people' ? (
        <People
          enrollments={enrollments}
          steps={steps}
          onAdd={async (payload) => {
            const d = await act('enroll', payload);
            if (d) setMessage(`Added ${d.enrolled}. Skipped ${d.skipped.length}${d.skipped.length ? `: ${d.skipped.slice(0, 3).map((s: { email: string; reason: string }) => `${s.email} (${s.reason})`).join(', ')}` : ''}.`);
          }}
          onRemove={(enrollmentId) => void act('unenroll', { enrollmentId })}
        />
      ) : (
        <ol className="space-y-2">
          <AddRow onAdd={(kind) => addStep(kind, 0)} first />
          {steps.map((step, index) => (
            <li key={step.id} className="space-y-2">
              <StepCard
                step={step}
                index={index}
                total={steps.length}
                stat={stats[step.id]}
                expanded={open === step.id}
                businessName={t('business.name')}
                onToggle={() => setOpen(open === step.id ? null : step.id)}
                onChange={(patch) => setStep(step.id, patch)}
                onMove={(dir) => move(index, dir)}
                onRemove={() => removeStep(step.id)}
                onTest={async (to) => {
                  const d = await act('test', { stepId: step.id, to });
                  if (d) setMessage(`Test sent to ${to.join(', ')}.`);
                }}
                upload={upload}
              />
              <AddRow onAdd={(kind) => addStep(kind, index + 1)} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function AddRow({ onAdd, first }: { onAdd: (kind: StepKind) => void; first?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[0.6875rem] uppercase tracking-[0.1em] text-brand-textMuted">
        {first ? 'Start with' : 'Then'}
      </span>
      {STEP_KINDS.map((k) => {
        const Icon = KIND_ICON[k.id];
        return (
          <button key={k.id} type="button" onClick={() => onAdd(k.id)} title={k.hint}
            className="chip border border-brand-borderLight text-brand-heading hover:border-brand-accent">
            <Plus className="h-3 w-3" /> <Icon className="h-3 w-3" /> {k.label}
          </button>
        );
      })}
    </div>
  );
}

function StepCard({ step, index, total, stat, expanded, businessName, onToggle, onChange, onMove, onRemove, onTest, upload }: {
  step: LoadedSteps; index: number; total: number; stat?: StepStat; expanded: boolean; businessName: string;
  onToggle: () => void; onChange: (patch: Partial<LoadedSteps>) => void;
  onMove: (dir: -1 | 1) => void; onRemove: () => void;
  onTest: (to: string[]) => Promise<void>; upload: (file: File, kind: UploadKind) => Promise<string>;
}) {
  const Icon = KIND_ICON[step.kind];
  const wait = splitWait(step.wait_minutes);
  const [testTo, setTestTo] = useState('');
  const [testing, setTesting] = useState(false);

  const report: SpamReport | null = useMemo(() => {
    if (step.kind !== 'email') return null;
    const blocks = step.design.blocks ?? [];
    const text = blocks.map((b) => b.text ?? b.label ?? '').join(' ');
    return checkEmail({
      subject: step.subject ?? '',
      previewText: step.preview_text ?? '',
      text,
      linkCount: blocks.filter((b) => b.href).length,
      imageCount: blocks.filter((b) => b.type === 'image').length,
      hasUnsubscribe: true,
    });
  }, [step]);

  return (
    <div className="border border-brand-border bg-brand-card">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-brand-borderLight font-display text-[0.6875rem] font-extrabold text-brand-heading">
          {index + 1}
        </span>
        <Icon className="h-4 w-4 shrink-0 text-brand-accent" />
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left">
          <span className="block truncate text-[0.8125rem] text-brand-heading">{stepSummary(step)}</span>
          {stat && step.kind === 'email' && (
            <span className="block text-[0.6875rem] text-brand-textMuted">
              {stat.sent} sent · {pct(stat.opened, stat.sent)} opened · {pct(stat.clicked, stat.sent)} clicked
              {stat.failed ? ` · ${stat.failed} failed` : ''}
            </span>
          )}
        </button>
        {report && (
          <span className={`chip ${report.verdict === 'poor' ? 'border border-action text-action' : report.verdict === 'fair' ? 'border border-brand-borderLight text-brand-body' : 'border border-brand-borderLight text-brand-textMuted'}`}>
            {VERDICT_LABEL[report.verdict]}
          </span>
        )}
        <button type="button" aria-label="Move up" disabled={index === 0} onClick={() => onMove(-1)} className="p-1 text-brand-textMuted disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
        <button type="button" aria-label="Move down" disabled={index === total - 1} onClick={() => onMove(1)} className="p-1 text-brand-textMuted disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
        <button type="button" aria-label="Remove step" onClick={onRemove} className="p-1 text-brand-textMuted hover:text-action"><X className="h-3.5 w-3.5" /></button>
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-brand-border p-3">
          {step.kind === 'wait' && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="block">
                <span className="field-label">Wait for</span>
                <input type="number" min={0} className="field-input w-28" value={wait.value}
                  onChange={(e) => onChange({ wait_minutes: Math.max(0, Number(e.target.value)) * (WAIT_UNITS.find((u) => u.id === wait.unit)?.minutes ?? 1) })} />
              </label>
              <select className="field-input w-32" value={wait.unit}
                onChange={(e) => {
                  const unit = WAIT_UNITS.find((u) => u.id === e.target.value);
                  onChange({ wait_minutes: wait.value * (unit?.minutes ?? 1) });
                }}>
                {WAIT_UNITS.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
              </select>
              <p className="text-[0.75rem] text-brand-textMuted">
                Sequences are checked every half hour, so a wait is accurate to about thirty minutes.
              </p>
            </div>
          )}

          {step.kind === 'goal' && (
            <p className="text-[0.8125rem] text-brand-body">
              Everybody who reaches this point is finished and gets nothing further from this sequence.
            </p>
          )}

          {step.kind === 'condition' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="field-label">Check</span>
                <select className="field-input" value={step.condition_type ?? ''}
                  onChange={(e) => onChange({ condition_type: e.target.value as LoadedSteps['condition_type'] })}>
                  <option value="">Choose…</option>
                  {CONDITIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="field-label">If not, then</span>
                <select className="field-input" value={step.on_fail}
                  onChange={(e) => onChange({ on_fail: e.target.value as OnFail })}>
                  {ON_FAIL_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </label>
            </div>
          )}

          {step.kind === 'email' && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="field-label">Subject line</span>
                  <input className="field-input" value={step.subject ?? ''} onChange={(e) => onChange({ subject: e.target.value })}
                    placeholder="What this email is about" />
                </label>
                <label className="block sm:col-span-2">
                  <span className="field-label">Preview text</span>
                  <input className="field-input" value={step.preview_text ?? ''} onChange={(e) => onChange({ preview_text: e.target.value })}
                    placeholder="The line shown after the subject in the inbox" />
                </label>
                <label className="block">
                  <span className="field-label">From name</span>
                  <input className="field-input" value={step.from_name ?? ''} onChange={(e) => onChange({ from_name: e.target.value })}
                    placeholder={businessName} />
                </label>
                <label className="block">
                  <span className="field-label">Replies go to</span>
                  <input className="field-input" value={step.reply_to ?? ''} onChange={(e) => onChange({ reply_to: e.target.value })}
                    placeholder="A mailbox somebody reads" />
                </label>
              </div>

              {report && report.findings.length > 0 && (
                <div className="border border-brand-borderLight bg-brand-dark p-3">
                  <p className="field-label mb-1">Spam check — {VERDICT_LABEL[report.verdict]}</p>
                  <ul className="space-y-1 text-[0.75rem]">
                    {report.findings.slice(0, 6).map((f, i) => (
                      <li key={i} className={f.severity === 'high' ? 'text-action' : 'text-brand-body'}>
                        <span>{f.message}</span> <span className="text-brand-textMuted">{f.fix}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <EmailBlockEditor
                design={step.design}
                subject={step.subject ?? ''}
                previewText={step.preview_text}
                onChange={(design) => onChange({ design })}
                upload={upload}
              />

              <div className="flex flex-wrap items-end gap-2 border-t border-brand-border pt-3">
                <label className="block min-w-0 flex-1">
                  <span className="field-label">Send yourself a test</span>
                  <input className="field-input" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com" />
                </label>
                <button type="button" className="btn-secondary btn-sm" disabled={testing || !testTo.trim()}
                  onClick={async () => {
                    setTesting(true);
                    await onTest(testTo.split(/[\s,;]+/).filter(Boolean));
                    setTesting(false);
                  }}>
                  {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send test
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- the people -- */

function People({ enrollments, steps, onAdd, onRemove }: {
  enrollments: Enrollment[];
  steps: LoadedSteps[];
  onAdd: (payload: Record<string, unknown>) => Promise<void>;
  onRemove: (id: string) => void;
}) {
  const [emails, setEmails] = useState('');
  const [audience, setAudience] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async (payload: Record<string, unknown>) => {
    setBusy(true);
    await onAdd(payload);
    setBusy(false);
    setEmails('');
  };

  return (
    <div className="space-y-4">
      <section className="grid gap-3 border border-brand-border bg-brand-card p-4 sm:grid-cols-2">
        <div>
          <label className="block">
            <span className="field-label">Add people by email</span>
            <textarea className="field-input" rows={3} value={emails} onChange={(e) => setEmails(e.target.value)}
              placeholder="One address per line, or separated by commas" />
          </label>
          <button type="button" className="btn-primary btn-sm mt-2" disabled={busy || !emails.trim()}
            onClick={() => void add({ emails })}>
            <Users className="h-3.5 w-3.5" /> Add them
          </button>
        </div>

        <div>
          <label className="block">
            <span className="field-label">Or add a whole list</span>
            <select className="field-input" value={audience} onChange={(e) => setAudience(e.target.value)}>
              <option value="">Choose a list…</option>
              {AUDIENCES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </label>
          <button type="button" className="btn-secondary btn-sm mt-2" disabled={busy || !audience}
            onClick={() => void add({ audience })}>
            <Users className="h-3.5 w-3.5" /> Add the list
          </button>
          <p className="mt-2 text-[0.75rem] text-brand-textMuted">
            Anybody who has unsubscribed is skipped, and so is anybody already part-way through.
          </p>
        </div>
      </section>

      <div className="overflow-x-auto border border-brand-border bg-brand-card">
        <table className="w-full text-left text-[0.8125rem]">
          <thead className="border-b border-brand-border">
            <tr className="font-display text-[0.6875rem] uppercase tracking-[0.1em] text-brand-textMuted">
              <th className="px-3 py-2.5">Email</th>
              <th className="px-3 py-2.5">Where they are</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5">Next step due</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border/60">
            {enrollments.map((e) => (
              <tr key={e.id} className="hover:bg-brand-dark">
                <td className="px-3 py-2.5 text-brand-heading">
                  {e.email}
                  {e.name && <span className="block text-[0.75rem] text-brand-textMuted">{e.name}</span>}
                </td>
                <td className="px-3 py-2.5 text-brand-body">
                  {steps[e.current_position] ? `Step ${e.current_position + 1}: ${stepSummary(steps[e.current_position])}` : 'At the end'}
                </td>
                <td className="px-3 py-2.5 text-brand-body">
                  {ENROLLMENT_STATUS_LABEL[e.status] ?? e.status}
                  {e.stopped_reason && <span className="block text-[0.75rem] text-brand-textMuted">{e.stopped_reason}</span>}
                </td>
                <td className="px-3 py-2.5 text-brand-textMuted">{e.status === 'active' ? when(e.next_run_at) : '—'}</td>
                <td className="px-3 py-2.5 text-right">
                  {e.status === 'active' && (
                    <button type="button" aria-label="Take them out" onClick={() => onRemove(e.id)} className="p-1 text-brand-textMuted hover:text-action">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!enrollments.length && (
              <tr><td colSpan={5} className="p-8 text-center text-xs text-brand-textMuted">Nobody is in this sequence yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ bits -- */

function Loading() {
  return (
    <div className="flex items-center justify-center gap-2 p-12 text-sm text-brand-textMuted">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
    </div>
  );
}

function Banner({ tone, children }: { tone: 'good' | 'warn' | 'bad'; children: React.ReactNode }) {
  const cls = tone === 'bad'
    ? 'border-action text-action'
    : tone === 'warn'
      ? 'border-brand-borderLight text-brand-body'
      : 'border-brand-accent text-brand-heading';
  return <div className={`border ${cls} bg-brand-card p-3 text-[0.8125rem]`}>{children}</div>;
}
