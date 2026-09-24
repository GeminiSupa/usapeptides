/**
 * Email automations - the shapes and rules the API and the builder UI share.
 *
 * Deliberately NOT `server-only`: the builder renders the same step list the
 * engine walks, and a second copy of these rules living in the component is a
 * second copy that drifts. Nothing secret is here; every route re-checks.
 *
 * No business name, address or person appears in this file.
 */

import { sanitizeDesign, type EmailDesign } from './emailDesign';

/* ---------------------------------------------------------- the triggers -- */

export type TriggerId =
  | 'manual'
  | 'lead_created'
  | 'newsletter_signup'
  | 'customer_created'
  | 'order_placed'
  | 'abandoned_cart';

export interface TriggerDef {
  id: TriggerId;
  label: string;
  /** What actually starts it, in the owner's words. */
  description: string;
  /** Where the address comes from, shown on the card. */
  source: string;
}

export const TRIGGERS: TriggerDef[] = [
  {
    id: 'manual',
    label: 'No trigger - I start it myself',
    description: 'Nothing starts this on its own. You add people to it by hand from the Enrolled tab.',
    source: 'manual',
  },
  {
    id: 'lead_created',
    label: 'New lead from a lead-gen site',
    description: 'Somebody fills in the contact form on one of the lead sites.',
    source: 'lead',
  },
  {
    id: 'newsletter_signup',
    label: 'Newsletter signup',
    description: 'Somebody subscribes from the storefront.',
    source: 'subscriber',
  },
  {
    id: 'customer_created',
    label: 'New customer account',
    description: 'Somebody creates an account on the store.',
    source: 'customer',
  },
  {
    id: 'order_placed',
    label: 'Order placed',
    description: 'An order is recorded, however it was paid for.',
    source: 'customer',
  },
  {
    id: 'abandoned_cart',
    label: 'Abandoned cart',
    description: 'A cart has been left alone for a while with nothing ordered since.',
    source: 'customer',
  },
];

const TRIGGER_BY_ID = new Map(TRIGGERS.map((t) => [t.id, t]));

export const isTrigger = (v: unknown): v is TriggerId => TRIGGER_BY_ID.has(String(v) as TriggerId);

export const triggerLabel = (id: string): string => TRIGGER_BY_ID.get(id as TriggerId)?.label ?? id;

/** Only this trigger needs a number from the owner: how long is "abandoned". */
export const DEFAULT_CART_AGE_HOURS = 4;

export interface TriggerConfig {
  /** abandoned_cart: how many hours of silence before the sequence starts. */
  cartAgeHours?: number;
  /** order_placed: only orders at or above this total, in the store currency. */
  minOrderTotal?: number;
}

export function sanitizeTriggerConfig(input: unknown): TriggerConfig {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const out: TriggerConfig = {};
  const hours = Number(raw.cartAgeHours);
  if (Number.isFinite(hours)) out.cartAgeHours = Math.min(168, Math.max(1, Math.round(hours)));
  const total = Number(raw.minOrderTotal);
  if (Number.isFinite(total) && total > 0) out.minOrderTotal = Math.round(total * 100) / 100;
  return out;
}

/* ------------------------------------------------------------- the steps -- */

export type StepKind = 'email' | 'wait' | 'condition' | 'goal';

export type ConditionId = 'opened_previous' | 'clicked_previous' | 'has_ordered' | 'not_ordered';

export type OnFail = 'continue' | 'skip_next' | 'exit';

export interface Step {
  id: string;
  kind: StepKind;
  subject?: string | null;
  preview_text?: string | null;
  from_name?: string | null;
  reply_to?: string | null;
  design?: EmailDesign;
  wait_minutes: number;
  condition_type?: ConditionId | null;
  on_fail: OnFail;
}

export const STEP_KINDS: { id: StepKind; label: string; hint: string }[] = [
  { id: 'email',     label: 'Send email',  hint: 'Write and send one email.' },
  { id: 'wait',      label: 'Wait',        hint: 'Hold for a while before the next step.' },
  { id: 'condition', label: 'If / then',   hint: 'Check something, then carry on, skip a step, or stop.' },
  { id: 'goal',      label: 'Finish',      hint: 'End the sequence here.' },
];

export const CONDITIONS: { id: ConditionId; label: string }[] = [
  { id: 'opened_previous',  label: 'They opened the last email' },
  { id: 'clicked_previous', label: 'They clicked a link in the last email' },
  { id: 'has_ordered',      label: 'They have placed an order' },
  { id: 'not_ordered',      label: 'They have not placed an order' },
];

export const ON_FAIL_OPTIONS: { id: OnFail; label: string }[] = [
  { id: 'continue',  label: 'carry on to the next step anyway' },
  { id: 'skip_next', label: 'skip the next step' },
  { id: 'exit',      label: 'stop the sequence for them' },
];

const CONDITION_IDS = new Set<string>(CONDITIONS.map((c) => c.id));
const ON_FAIL_IDS = new Set<string>(ON_FAIL_OPTIONS.map((o) => o.id));
const STEP_KIND_IDS = new Set<string>(STEP_KINDS.map((k) => k.id));

export const isStepKind = (v: unknown): v is StepKind => STEP_KIND_IDS.has(String(v));

/** The longest a single wait may be. A year of silence is a bug, not a plan. */
export const MAX_WAIT_MINUTES = 365 * 24 * 60;

/** The most steps one sequence may hold, so a runaway builder cannot spam. */
export const MAX_STEPS = 40;

export const WAIT_UNITS: { id: 'minutes' | 'hours' | 'days'; label: string; minutes: number }[] = [
  { id: 'minutes', label: 'minutes', minutes: 1 },
  { id: 'hours',   label: 'hours',   minutes: 60 },
  { id: 'days',    label: 'days',    minutes: 1440 },
];

/** Split stored minutes back into the pair the builder shows. */
export function splitWait(minutes: number): { value: number; unit: 'minutes' | 'hours' | 'days' } {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  if (m > 0 && m % 1440 === 0) return { value: m / 1440, unit: 'days' };
  if (m > 0 && m % 60 === 0) return { value: m / 60, unit: 'hours' };
  return { value: m, unit: 'minutes' };
}

export const clampWait = (minutes: unknown): number =>
  Math.min(MAX_WAIT_MINUTES, Math.max(0, Math.round(Number(minutes) || 0)));

/**
 * Everything the API is willing to store for one step.
 *
 * Fields that belong to another kind are nulled rather than kept, so a card
 * switched from Email to Wait cannot keep a subject line that would then be
 * sent by a later edit.
 */
export function sanitizeStep(input: unknown, position: number): Record<string, unknown> {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const kind: StepKind = isStepKind(raw.kind) ? raw.kind : 'email';
  const text = (v: unknown, max: number) => {
    const s = String(v ?? '').trim();
    return s ? s.slice(0, max) : null;
  };

  return {
    position,
    kind,
    subject: kind === 'email' ? text(raw.subject, 200) : null,
    preview_text: kind === 'email' ? text(raw.preview_text, 200) : null,
    from_name: kind === 'email' ? text(raw.from_name, 80) : null,
    reply_to: kind === 'email' ? text(raw.reply_to, 200) : null,
    design: kind === 'email' ? sanitizeDesign(raw.design) : {},
    wait_minutes: kind === 'wait' ? clampWait(raw.wait_minutes) : 0,
    condition_type: kind === 'condition' && CONDITION_IDS.has(String(raw.condition_type))
      ? String(raw.condition_type) : null,
    on_fail: kind === 'condition' && ON_FAIL_IDS.has(String(raw.on_fail)) ? String(raw.on_fail) : 'continue',
  };
}

/* ------------------------------------------------------------ the checks -- */

export interface Problem { stepId: string | null; message: string }

/**
 * What stops a sequence going live.
 *
 * Run by the UI as you type and again by the API before it will flip a
 * sequence to active, because the UI can be skipped and the API cannot.
 */
export function sequenceProblems(steps: Step[]): Problem[] {
  const problems: Problem[] = [];
  const emails = steps.filter((s) => s.kind === 'email');

  if (!steps.length) problems.push({ stepId: null, message: 'Add at least one step.' });
  if (!emails.length) problems.push({ stepId: null, message: 'A sequence that sends no email does nothing. Add a Send email step.' });
  if (steps.length > MAX_STEPS) problems.push({ stepId: null, message: `That is more than ${MAX_STEPS} steps.` });

  steps.forEach((s, i) => {
    if (s.kind === 'email') {
      if (!String(s.subject ?? '').trim()) problems.push({ stepId: s.id, message: 'This email has no subject line.' });
      if (!sanitizeDesign(s.design).blocks.length) problems.push({ stepId: s.id, message: 'This email is empty.' });
    }
    if (s.kind === 'wait' && s.wait_minutes <= 0) {
      problems.push({ stepId: s.id, message: 'This wait is set to zero, so it does nothing.' });
    }
    if (s.kind === 'condition') {
      if (!s.condition_type) problems.push({ stepId: s.id, message: 'Choose what this step should check.' });
      const needsPrevious = s.condition_type === 'opened_previous' || s.condition_type === 'clicked_previous';
      if (needsPrevious && !steps.slice(0, i).some((p) => p.kind === 'email')) {
        problems.push({ stepId: s.id, message: 'There is no earlier email for this to check. Move it below one.' });
      }
    }
  });

  // Two emails back to back with no wait between them arrive together, which
  // is the fastest way to be marked as spam.
  for (let i = 1; i < steps.length; i += 1) {
    if (steps[i].kind === 'email' && steps[i - 1].kind === 'email') {
      problems.push({ stepId: steps[i].id, message: 'This email follows another with no wait between them. Add a Wait step.' });
    }
  }

  return problems;
}

/** One line describing a step, for the collapsed card and the enrolled list. */
export function stepSummary(s: Step): string {
  if (s.kind === 'email') return s.subject?.trim() || 'Untitled email';
  if (s.kind === 'wait') {
    const { value, unit } = splitWait(s.wait_minutes);
    return value <= 0 ? 'No wait set' : `Wait ${value} ${value === 1 ? unit.replace(/s$/, '') : unit}`;
  }
  if (s.kind === 'goal') return 'Finish the sequence';
  const check = CONDITIONS.find((c) => c.id === s.condition_type)?.label ?? 'Nothing chosen yet';
  const fail = ON_FAIL_OPTIONS.find((o) => o.id === s.on_fail)?.label ?? '';
  return `If ${check.toLowerCase()} - otherwise ${fail}`;
}

/** How long a whole sequence takes, for the header. */
export function totalDuration(steps: Step[]): string {
  const minutes = steps.reduce((sum, s) => sum + (s.kind === 'wait' ? s.wait_minutes : 0), 0);
  if (minutes <= 0) return 'all at once';
  const days = Math.floor(minutes / 1440);
  const hours = Math.round((minutes % 1440) / 60);
  if (days && hours) return `${days}d ${hours}h`;
  if (days) return `${days} day${days === 1 ? '' : 's'}`;
  if (hours) return `${hours} hour${hours === 1 ? '' : 's'}`;
  return `${minutes} min`;
}

/**
 * The whole sequence as sentences, for somebody who wants to know what it will
 * do before they turn it on.
 *
 * Built from the same step list the engine walks, so it cannot describe
 * something different from what will happen - and it counts the waits, which
 * is the part people get wrong.
 */
export function plainEnglish(steps: Step[], trigger: TriggerId): string[] {
  const lines: string[] = [];
  const t = TRIGGER_BY_ID.get(trigger);
  lines.push(trigger === 'manual'
    ? 'Nothing starts this by itself. It runs for whoever you add on the People tab.'
    : `Starts when: ${String(t?.description ?? trigger)}`);

  let elapsed = 0;
  let emails = 0;
  const since = (m: number) => {
    if (m <= 0) return 'straight away';
    if (m % 1440 === 0) return `${m / 1440} day${m / 1440 === 1 ? '' : 's'} in`;
    if (m % 60 === 0) return `${m / 60} hour${m / 60 === 1 ? '' : 's'} in`;
    return `${m} minutes in`;
  };

  for (const step of steps) {
    if (step.kind === 'wait') { elapsed += clampWait(step.wait_minutes); continue; }
    if (step.kind === 'email') {
      emails += 1;
      lines.push(`${since(elapsed)}: send "${step.subject?.trim() || 'an untitled email'}".`);
      continue;
    }
    if (step.kind === 'goal') { lines.push(`${since(elapsed)}: everybody who gets here is finished.`); continue; }
    const check = CONDITIONS.find((c) => c.id === step.condition_type)?.label ?? 'something not chosen yet';
    const fail = ON_FAIL_OPTIONS.find((o) => o.id === step.on_fail)?.label ?? '';
    lines.push(`${since(elapsed)}: check whether ${check.toLowerCase()} - if not, ${fail}.`);
  }

  if (!emails) lines.push('No email is ever sent, so this does nothing at the moment.');

  // A wait at the very end is the commonest confusion: people expect it to
  // mean something, and it means the sequence sits there before finishing.
  const last = steps[steps.length - 1];
  if (last?.kind === 'wait' && clampWait(last.wait_minutes) > 0) {
    lines.push('The last step is a wait, so after the final email people simply sit there until it passes, then finish. You can delete it - it changes nothing.');
  }

  return lines;
}

export const AUTOMATION_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  active: 'Running',
  paused: 'Paused',
};

export const ENROLLMENT_STATUS_LABEL: Record<string, string> = {
  active: 'In progress',
  completed: 'Finished',
  stopped: 'Stopped',
  failed: 'Failed',
};
