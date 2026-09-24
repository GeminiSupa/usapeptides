import 'server-only';

import { getSupabaseAdmin } from './supabaseAdmin';
import { features } from './env';
import {
  composeDesigned, fromHeader, sendEmail, suppressedEmails, CampaignError,
} from './campaignSender';
import { getSiteContent } from './siteContentServer';
import { reserveSends, releaseSends } from './sendingPolicy';
import {
  clampWait, sanitizeTriggerConfig, DEFAULT_CART_AGE_HOURS,
  type ConditionId, type OnFail, type StepKind, type TriggerId,
} from './automations';

/**
 * The engine that walks people through a sequence.
 *
 * One pass over the due enrollments per run. Each enrollment is claimed before
 * anything is sent, so two workers - the cron and somebody watching the screen
 * - can never send the same step twice. Every send goes through the same daily
 * limit as campaigns and skips anybody on the suppression list.
 *
 * Nothing here knows the business name, the products or any person: all of
 * that comes from the database and from BUSINESS.
 */

type Db = ReturnType<typeof getSupabaseAdmin>;

export const AUTOMATION_MIGRATION =
  'Automations need a database update. Run supabase/migrations/0024_email_automations.sql in the Supabase SQL editor, then reload.';

export const needsAutomationMigration = (e: { code?: string; message?: string } | null | undefined) =>
  Boolean(e && (e.code === '42P01' || e.code === 'PGRST205' || e.code === 'PGRST202' || e.code === '42703'
    || e.code === 'PGRST204' || /does not exist|schema cache/i.test(e.message ?? '')));

const BATCH_BUDGET_MS = 40_000;
const MAX_ENROLLMENTS_PER_RUN = Math.max(1, Math.min(500, Number(process.env.AUTOMATION_BATCH_SIZE) || 60));
const SEND_DELAY_MS = Math.max(0, Number(process.env.EMAIL_SEND_DELAY_MS) || 400);
/** A step that somehow never finishes is retried rather than left stuck. */
const STUCK_AFTER_MS = 600_000;

const normEmail = (v: unknown) => String(v ?? '').trim().toLowerCase();
const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

/* ------------------------------------------------------------ enrolling -- */

export interface Person {
  email: string;
  name?: string | null;
  source?: string | null;
  subjectType?: string | null;
  subjectId?: string | null;
}

export interface EnrollResult {
  enrolled: number;
  skipped: { email: string; reason: string }[];
}

/**
 * Put people into one automation.
 *
 * Refuses an address that has unsubscribed, and refuses a second pass unless
 * the automation allows re-entry - a welcome series that arrives twice is
 * worse than one that never arrives.
 */
export async function enroll(
  automationId: string,
  people: Person[],
  opts: { force?: boolean } = {}
): Promise<EnrollResult> {
  const db = getSupabaseAdmin();
  const { data: automation, error } = await db.from('email_automations')
    .select('id, status, allow_reentry').eq('id', automationId).maybeSingle();
  if (error) throw new CampaignError(needsAutomationMigration(error) ? AUTOMATION_MIGRATION : error.message, 500);
  if (!automation) throw new CampaignError('That automation no longer exists.', 404);

  const suppressed = await suppressedEmails(db);
  const skipped: EnrollResult['skipped'] = [];
  let enrolled = 0;

  for (const person of people) {
    const email = normEmail(person.email);
    if (!validEmail(email)) { skipped.push({ email: String(person.email ?? ''), reason: 'Not an email address' }); continue; }
    if (suppressed.has(email)) { skipped.push({ email, reason: 'Unsubscribed or bounced' }); continue; }

    const { data: existing } = await db.from('email_automation_enrollments')
      .select('id, status').eq('automation_id', automationId).eq('email', email).maybeSingle();

    if (existing) {
      if (existing.status === 'active') { skipped.push({ email, reason: 'Already part-way through' }); continue; }
      if (!automation.allow_reentry && !opts.force) { skipped.push({ email, reason: 'Has already been through it' }); continue; }
      const { error: reopen } = await db.from('email_automation_enrollments').update({
        status: 'active', current_position: 0, next_run_at: new Date().toISOString(),
        claimed_at: null, stopped_reason: null, completed_at: null, enrolled_at: new Date().toISOString(),
        name: person.name ?? null, source: person.source ?? 'manual',
        subject_type: person.subjectType ?? null, subject_id: person.subjectId ?? null,
      }).eq('id', existing.id);
      if (reopen) { skipped.push({ email, reason: reopen.message }); continue; }
      enrolled += 1;
      continue;
    }

    const { error: insert } = await db.from('email_automation_enrollments').insert({
      automation_id: automationId,
      email,
      name: person.name ?? null,
      source: person.source ?? 'manual',
      subject_type: person.subjectType ?? null,
      subject_id: person.subjectId ?? null,
      status: 'active',
      current_position: 0,
      next_run_at: new Date().toISOString(),
    });
    if (insert) {
      // A duplicate here means another request enrolled them a moment ago.
      skipped.push({ email, reason: /duplicate|unique/i.test(insert.message) ? 'Already enrolled' : insert.message });
      continue;
    }
    enrolled += 1;
  }

  if (enrolled) await bumpCounter(db, automationId, 'enrolled_count', enrolled);
  return { enrolled, skipped };
}

/**
 * Start every live automation that listens for this event.
 *
 * Called from the routes that create a lead, a subscriber, a customer or an
 * order. It never throws: a nurture email failing to start must not fail the
 * thing the customer was actually doing.
 */
export async function fireTrigger(trigger: TriggerId, person: Person, context: { orderTotal?: number } = {}): Promise<void> {
  try {
    if (!features.adminDatabase) return;
    const db = getSupabaseAdmin();
    const { data, error } = await db.from('email_automations')
      .select('id, trigger_config').eq('trigger_type', trigger).eq('status', 'active').limit(25);
    if (error || !data?.length) return;

    for (const automation of data) {
      const config = sanitizeTriggerConfig(automation.trigger_config);
      if (trigger === 'order_placed' && config.minOrderTotal && Number(context.orderTotal ?? 0) < config.minOrderTotal) continue;
      await enroll(automation.id, [person]).catch(() => undefined);
    }
  } catch {
    // Deliberately silent. The caller is a checkout or a signup.
  }
}

/* -------------------------------------------------------------- running -- */

interface StepRow {
  id: string; position: number; kind: StepKind;
  subject: string | null; preview_text: string | null; from_name: string | null; reply_to: string | null;
  design: unknown; wait_minutes: number; condition_type: ConditionId | null; on_fail: OnFail;
}

interface EnrollmentRow {
  id: string; automation_id: string; email: string; name: string | null;
  current_position: number; status: string;
}

interface AutomationRow {
  id: string; name: string; status: string; stop_on_order: boolean;
}

export interface RunSummary {
  processed: number;
  sent: number;
  completed: number;
  stopped: number;
  failed: number;
  held: string | null;
}

/**
 * Advance everybody who is due.
 *
 * `automationId` limits the run to one sequence, which is what the dashboard
 * button uses; the cron passes nothing and takes them all.
 */
export async function runDue(automationId?: string): Promise<RunSummary> {
  const db = getSupabaseAdmin();
  const summary: RunSummary = { processed: 0, sent: 0, completed: 0, stopped: 0, failed: 0, held: null };
  const started = Date.now();

  // Anything claimed and never finished is put back first.
  await db.from('email_automation_enrollments')
    .update({ claimed_at: null })
    .eq('status', 'active')
    .lt('claimed_at', new Date(Date.now() - STUCK_AFTER_MS).toISOString());

  let query = db.from('email_automation_enrollments')
    .select('id, automation_id, email, name, current_position, status')
    .eq('status', 'active')
    .is('claimed_at', null)
    .lte('next_run_at', new Date().toISOString())
    .order('next_run_at')
    .limit(MAX_ENROLLMENTS_PER_RUN);
  if (automationId) query = query.eq('automation_id', automationId);

  const { data: due, error } = await query;
  if (error) {
    if (needsAutomationMigration(error)) return summary;
    throw new CampaignError(error.message, 500);
  }
  if (!due?.length) return summary;

  const suppressed = await suppressedEmails(db);
  const automations = new Map<string, AutomationRow>();
  const steps = new Map<string, StepRow[]>();

  for (const enrollment of due as EnrollmentRow[]) {
    if (Date.now() - started > BATCH_BUDGET_MS) break;

    // Claim it. If somebody else got there first, leave it alone.
    const { data: claimed } = await db.from('email_automation_enrollments')
      .update({ claimed_at: new Date().toISOString() })
      .eq('id', enrollment.id).eq('status', 'active').is('claimed_at', null)
      .select('id').maybeSingle();
    if (!claimed) continue;

    try {
      if (!automations.has(enrollment.automation_id)) {
        const { data } = await db.from('email_automations')
          .select('id, name, status, stop_on_order').eq('id', enrollment.automation_id).maybeSingle();
        if (data) automations.set(enrollment.automation_id, data as AutomationRow);
        const { data: stepRows } = await db.from('email_automation_steps')
          .select('id, position, kind, subject, preview_text, from_name, reply_to, design, wait_minutes, condition_type, on_fail')
          .eq('automation_id', enrollment.automation_id).order('position');
        steps.set(enrollment.automation_id, (stepRows ?? []) as StepRow[]);
      }

      const automation = automations.get(enrollment.automation_id);
      const list = steps.get(enrollment.automation_id) ?? [];

      // A paused sequence holds everybody where they are, rather than dropping
      // them, so resuming picks up exactly where it left off.
      if (!automation || automation.status !== 'active') {
        await db.from('email_automation_enrollments').update({ claimed_at: null }).eq('id', enrollment.id);
        continue;
      }

      const outcome = await advance(db, automation, list, enrollment, suppressed);
      summary.processed += 1;
      summary.sent += outcome.sent;
      if (outcome.finished === 'completed') summary.completed += 1;
      if (outcome.finished === 'stopped') summary.stopped += 1;
      if (outcome.held) summary.held = outcome.held;
      if (outcome.held) break; // no permits left today; leave the rest for tomorrow
    } catch (err) {
      summary.failed += 1;
      await db.from('email_automation_enrollments').update({
        status: 'failed', claimed_at: null,
        stopped_reason: (err instanceof Error ? err.message : 'Failed').slice(0, 300),
      }).eq('id', enrollment.id);
    }

    if (SEND_DELAY_MS) await new Promise((res) => setTimeout(res, SEND_DELAY_MS));
  }

  return summary;
}

interface Outcome { sent: number; finished: 'completed' | 'stopped' | null; held: string | null }

/** Run one enrollment forward until it has to wait, or the sequence ends. */
async function advance(
  db: Db,
  automation: AutomationRow,
  steps: StepRow[],
  enrollment: EnrollmentRow,
  suppressed: Set<string>
): Promise<Outcome> {
  const email = normEmail(enrollment.email);

  if (suppressed.has(email)) {
    await stop(db, enrollment.id, 'Unsubscribed');
    return { sent: 0, finished: 'stopped', held: null };
  }
  if (automation.stop_on_order && await hasOrdered(db, email, enrollment.id)) {
    await stop(db, enrollment.id, 'They placed an order');
    return { sent: 0, finished: 'stopped', held: null };
  }

  let position = enrollment.current_position;
  let sent = 0;

  // One email per pass at most. Several steps may run in a row when they are
  // conditions and zero-length waits, but two emails never go out together.
  for (let guard = 0; guard < 50; guard += 1) {
    const step = steps.find((s) => s.position === position) ?? steps.filter((s) => s.position > position).sort((a, b) => a.position - b.position)[0];

    if (!step) {
      await db.from('email_automation_enrollments').update({
        status: 'completed', completed_at: new Date().toISOString(), claimed_at: null, current_position: position,
      }).eq('id', enrollment.id);
      await bumpCounter(db, automation.id, 'completed_count', 1);
      return { sent, finished: 'completed', held: null };
    }

    if (step.kind === 'goal') {
      await db.from('email_automation_enrollments').update({
        status: 'completed', completed_at: new Date().toISOString(), claimed_at: null, current_position: step.position + 1,
      }).eq('id', enrollment.id);
      await bumpCounter(db, automation.id, 'completed_count', 1);
      return { sent, finished: 'completed', held: null };
    }

    if (step.kind === 'wait') {
      const minutes = clampWait(step.wait_minutes);
      if (minutes > 0) {
        await db.from('email_automation_enrollments').update({
          current_position: step.position + 1,
          next_run_at: new Date(Date.now() + minutes * 60_000).toISOString(),
          claimed_at: null,
        }).eq('id', enrollment.id);
        return { sent, finished: null, held: null };
      }
      position = step.position + 1;
      continue;
    }

    if (step.kind === 'condition') {
      const passed = await evaluate(db, step.condition_type, enrollment, email);
      if (passed) { position = step.position + 1; continue; }
      if (step.on_fail === 'exit') {
        await stop(db, enrollment.id, `Condition not met at step ${step.position + 1}`);
        return { sent, finished: 'stopped', held: null };
      }
      position = step.position + (step.on_fail === 'skip_next' ? 2 : 1);
      continue;
    }

    // An email step. One permit, one send, then hand over to the next step.
    if (sent > 0) {
      await db.from('email_automation_enrollments').update({
        current_position: step.position, next_run_at: new Date(Date.now() + 60_000).toISOString(), claimed_at: null,
      }).eq('id', enrollment.id);
      return { sent, finished: null, held: null };
    }

    const permit = await reserveSends(db, 1);
    if (permit.granted < 1) {
      // Try again after midnight rather than hammering the limit all day.
      const tomorrow = new Date();
      tomorrow.setUTCHours(24, 5, 0, 0);
      await db.from('email_automation_enrollments').update({
        current_position: step.position, next_run_at: tomorrow.toISOString(), claimed_at: null,
      }).eq('id', enrollment.id);
      return { sent, finished: null, held: permit.reason };
    }

    try {
      await sendStep(db, automation, step, enrollment, email);
      sent += 1;
      await bumpCounter(db, automation.id, 'sent_count', 1);
    } catch (err) {
      await releaseSends(db, 1);
      throw err;
    }
    position = step.position + 1;
  }

  await db.from('email_automation_enrollments').update({ current_position: position, claimed_at: null }).eq('id', enrollment.id);
  return { sent, finished: null, held: null };
}

/** Write the send row first, so the tracking links have an id to point at. */
async function sendStep(db: Db, automation: AutomationRow, step: StepRow, enrollment: EnrollmentRow, email: string) {
  const content = await getSiteContent();
  const business = content['business.name'] || automation.name;

  const { data: send, error } = await db.from('email_automation_sends').insert({
    enrollment_id: enrollment.id,
    automation_id: automation.id,
    step_id: step.id,
    email,
    name: enrollment.name,
    status: 'sent',
  }).select('id').single();
  if (error) throw new CampaignError(needsAutomationMigration(error) ? AUTOMATION_MIGRATION : error.message, 500);

  const recipient = { email, name: enrollment.name };
  try {
    const composed = await composeDesigned({
      design: step.design,
      subject: step.subject ?? automation.name,
      previewText: step.preview_text,
      recipient,
      trackId: send.id,
      scope: 'automation',
      tag: automation.id,
    });

    await sendEmail({
      from: fromHeader(step.from_name || business),
      to: email,
      replyTo: step.reply_to || undefined,
      subject: composed.subject,
      html: composed.html,
      text: composed.text,
      headers: {
        'List-Unsubscribe': `<${composed.unsub}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'X-Automation-Id': automation.id,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Send failed';
    await db.from('email_automation_sends').update({ status: 'failed', error: message.slice(0, 500) }).eq('id', send.id);
    const permanent = /5\d\d|user unknown|does not exist|mailbox unavailable|invalid recipient/i.test(message);
    if (permanent) {
      await db.from('email_suppressions').upsert({ email, reason: 'bounced' }, { onConflict: 'email', ignoreDuplicates: true });
    }
    throw err;
  }
}

/** Was the last email of this enrollment opened or clicked? */
async function evaluate(db: Db, condition: ConditionId | null, enrollment: EnrollmentRow, email: string): Promise<boolean> {
  if (!condition) return true;

  if (condition === 'has_ordered' || condition === 'not_ordered') {
    const ordered = await hasOrdered(db, email, enrollment.id);
    return condition === 'has_ordered' ? ordered : !ordered;
  }

  const { data } = await db.from('email_automation_sends')
    .select('opened_at, clicked_at').eq('enrollment_id', enrollment.id).eq('status', 'sent')
    .order('sent_at', { ascending: false }).limit(1).maybeSingle();
  if (!data) return false;
  return condition === 'opened_previous' ? Boolean(data.opened_at) : Boolean(data.clicked_at);
}

/** Any order at all from this address, ignoring cancelled ones. */
async function hasOrdered(db: Db, email: string, _enrollmentId: string): Promise<boolean> {
  const { data } = await db.from('orders').select('id').eq('email', email).neq('status', 'cancelled').limit(1);
  return Boolean(data?.length);
}

async function stop(db: Db, enrollmentId: string, reason: string) {
  await db.from('email_automation_enrollments').update({
    status: 'stopped', stopped_reason: reason.slice(0, 300), claimed_at: null,
    completed_at: new Date().toISOString(),
  }).eq('id', enrollmentId);
}

async function bumpCounter(db: Db, automationId: string, column: 'enrolled_count' | 'completed_count' | 'sent_count', by: number) {
  const { data } = await db.from('email_automations').select(column).eq('id', automationId).maybeSingle();
  const current = Number((data as Record<string, unknown> | null)?.[column] ?? 0);
  await db.from('email_automations').update({ [column]: current + by }).eq('id', automationId);
}

/* -------------------------------------------------------- abandoned cart -- */

/**
 * Carts left alone long enough, enrolled into whatever listens for them.
 *
 * Run from the cron, not from a page: there is no event when somebody stops
 * shopping, only the absence of one.
 */
export async function enrollAbandonedCarts(): Promise<{ found: number; enrolled: number }> {
  const db = getSupabaseAdmin();
  const { data: automations, error } = await db.from('email_automations')
    .select('id, trigger_config').eq('trigger_type', 'abandoned_cart').eq('status', 'active').limit(10);
  if (error || !automations?.length) return { found: 0, enrolled: 0 };

  let found = 0;
  let enrolled = 0;

  for (const automation of automations) {
    const hours = sanitizeTriggerConfig(automation.trigger_config).cartAgeHours ?? DEFAULT_CART_AGE_HOURS;
    const cutoff = new Date(Date.now() - hours * 3_600_000).toISOString();
    // Only as far back as a week: a month-old cart is not a recovery, it is
    // an email out of nowhere.
    const floor = new Date(Date.now() - 7 * 86_400_000).toISOString();

    const { data: carts } = await db.from('abandoned_carts')
      .select('id, email, updated_at')
      .not('email', 'is', null)
      .eq('recovered', false)
      .lte('updated_at', cutoff)
      .gte('updated_at', floor)
      .limit(200);

    const people: Person[] = [];
    for (const cart of carts ?? []) {
      const email = normEmail(cart.email);
      if (!validEmail(email)) continue;
      found += 1;
      people.push({ email, name: null, source: 'cart', subjectType: 'cart', subjectId: String(cart.id) });
    }
    if (people.length) {
      const result = await enroll(automation.id, people).catch(() => ({ enrolled: 0, skipped: [] }));
      enrolled += result.enrolled;
    }
  }

  return { found, enrolled };
}

/** Everything the cron does for automations. */
export async function processAutomations(): Promise<{ carts: unknown; run: RunSummary }> {
  const carts = await enrollAbandonedCarts().catch(() => ({ found: 0, enrolled: 0 }));
  const run = await runDue();
  return { carts, run };
}
