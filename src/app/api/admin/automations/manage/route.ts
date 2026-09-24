import { requireAdmin } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { featureUnavailable, features } from '@/lib/env';
import { writeAudit } from '@/lib/audit';
import { ok, created, badRequest, notFound, serverError, readJson, clip, isEmail } from '@/lib/api';
import { isTrigger, sanitizeStep, sanitizeTriggerConfig, MAX_STEPS } from '@/lib/automations';
import { AUTOMATION_MIGRATION, needsAutomationMigration } from '@/lib/automationEngine';

export const dynamic = 'force-dynamic';

/**
 * Automations: list, open one, create, edit, duplicate, delete.
 *
 *   GET    /api/admin/automations/manage        every sequence with its numbers
 *   GET    ?id=                                 one sequence, its steps and who is in it
 *   POST   { name, trigger_type }               new draft
 *   POST   { action: 'duplicate', id }          copy as a new draft
 *   PATCH  { id, ...fields, steps? }            edit; steps replace the whole list
 *   DELETE ?id=                                 delete, and everybody in it
 *
 * The steps are saved as one list rather than one row at a time, because the
 * builder reorders them freely and a half-applied reorder is a sequence that
 * sends the wrong email.
 */

const LIST = 'id, name, description, trigger_type, trigger_config, status, allow_reentry, stop_on_order, enrolled_count, completed_count, sent_count, created_at, updated_at';
const STEP_COLUMNS = 'id, position, kind, subject, preview_text, from_name, reply_to, design, wait_minutes, condition_type, on_fail';

async function authorize(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return { response: unavailable } as const;
  const auth = await requireAdmin(req, { permission: 'automations' });
  return auth.ok ? ({ auth } as const) : ({ response: auth.response } as const);
}

function clean(body: Record<string, unknown>, partial: boolean) {
  const row: Record<string, unknown> = {};
  const fields: Record<string, string> = {};
  const has = (k: string) => !partial || k in body;

  if (has('name')) {
    const name = clip(body.name, 160);
    if (!name) fields.name = 'Give the automation a name.'; else row.name = name;
  }
  if (has('description')) row.description = clip(body.description, 500) || null;
  if (has('trigger_type')) {
    if (!isTrigger(body.trigger_type)) fields.trigger_type = 'Choose what starts it.';
    else row.trigger_type = body.trigger_type;
  }
  if (has('trigger_config')) row.trigger_config = sanitizeTriggerConfig(body.trigger_config);
  if (has('allow_reentry')) row.allow_reentry = Boolean(body.allow_reentry);
  if (has('stop_on_order')) row.stop_on_order = Boolean(body.stop_on_order);
  if (has('reply_to')) {
    const v = clip(body.reply_to, 200);
    if (v && !isEmail(v)) fields.reply_to = 'That is not an email address.';
  }
  return { row, fields };
}

export async function GET(req: Request) {
  const access = await authorize(req);
  if ('response' in access) return access.response;
  const db = getSupabaseAdmin();
  const id = new URL(req.url).searchParams.get('id');

  if (!id) {
    const { data, error } = await db.from('email_automations').select(LIST).order('created_at', { ascending: false }).limit(200);
    if (error) {
      if (needsAutomationMigration(error)) {
        return ok({ automations: [], ready: false, notice: AUTOMATION_MIGRATION, emailReady: features.email });
      }
      return serverError(error.message);
    }
    return ok({ automations: data ?? [], ready: true, notice: null, emailReady: features.email });
  }

  const { data: automation, error } = await db.from('email_automations').select(LIST).eq('id', id).maybeSingle();
  if (error) return serverError(needsAutomationMigration(error) ? AUTOMATION_MIGRATION : error.message);
  if (!automation) return notFound('That automation no longer exists.');

  const { data: steps } = await db.from('email_automation_steps')
    .select(STEP_COLUMNS).eq('automation_id', id).order('position');

  const { data: enrollments } = await db.from('email_automation_enrollments')
    .select('id, email, name, source, status, current_position, next_run_at, stopped_reason, enrolled_at, completed_at')
    .eq('automation_id', id).order('enrolled_at', { ascending: false }).limit(500);

  const { data: sends } = await db.from('email_automation_sends')
    .select('step_id, status, opened_at, clicked_at').eq('automation_id', id).limit(20000);

  // Per-step delivery, so the builder can show which email nobody opens.
  const stats = new Map<string, { sent: number; opened: number; clicked: number; failed: number }>();
  for (const s of sends ?? []) {
    const key = String(s.step_id ?? '');
    const row = stats.get(key) ?? { sent: 0, opened: 0, clicked: 0, failed: 0 };
    if (s.status === 'failed') row.failed += 1; else row.sent += 1;
    if (s.opened_at) row.opened += 1;
    if (s.clicked_at) row.clicked += 1;
    stats.set(key, row);
  }

  return ok({
    automation,
    steps: steps ?? [],
    enrollments: enrollments ?? [],
    stepStats: Object.fromEntries(stats),
    emailReady: features.email,
  });
}

export async function POST(req: Request) {
  const access = await authorize(req);
  if ('response' in access) return access.response;
  const db = getSupabaseAdmin();
  const body = await readJson<Record<string, unknown>>(req);
  if (!body) return badRequest('Send JSON.');

  if (body.action === 'duplicate') {
    const sourceId = String(body.id ?? '');
    const { data: src, error } = await db.from('email_automations').select(LIST).eq('id', sourceId).maybeSingle();
    if (error) return serverError(needsAutomationMigration(error) ? AUTOMATION_MIGRATION : error.message);
    if (!src) return notFound('That automation no longer exists.');
    const s = src as unknown as Record<string, unknown>;

    const { data: copy, error: insertError } = await db.from('email_automations').insert({
      name: `${s.name} (copy)`.slice(0, 160),
      description: s.description,
      // A copy never starts live, whatever the original was doing.
      trigger_type: s.trigger_type, trigger_config: s.trigger_config,
      allow_reentry: s.allow_reentry, stop_on_order: s.stop_on_order,
      status: 'draft', created_by: access.auth.admin.id,
    }).select(LIST).single();
    if (insertError) return serverError(insertError.message);

    const { data: steps } = await db.from('email_automation_steps').select(STEP_COLUMNS).eq('automation_id', sourceId).order('position');
    if (steps?.length) {
      await db.from('email_automation_steps').insert(steps.map((step, i) => {
        const { id: _drop, ...rest } = step as Record<string, unknown>;
        return { ...rest, position: i, automation_id: copy.id };
      }));
    }
    return created({ automation: copy });
  }

  const { row, fields } = clean(body, false);
  if (Object.keys(fields).length) return badRequest('Some fields need fixing.', fields);

  const { data, error } = await db.from('email_automations')
    .insert({ ...row, status: 'draft', created_by: access.auth.admin.id })
    .select(LIST).single();
  if (error) return serverError(needsAutomationMigration(error) ? AUTOMATION_MIGRATION : error.message);
  return created({ automation: data });
}

export async function PATCH(req: Request) {
  const access = await authorize(req);
  if ('response' in access) return access.response;
  const body = await readJson<Record<string, unknown>>(req);
  if (!body?.id) return badRequest('Which automation?');
  const id = String(body.id);

  const { row, fields } = clean(body, true);
  if (Object.keys(fields).length) return badRequest('Some fields need fixing.', fields);

  const db = getSupabaseAdmin();
  const { data: current, error: readError } = await db.from('email_automations').select('id, name').eq('id', id).maybeSingle();
  if (readError) return serverError(needsAutomationMigration(readError) ? AUTOMATION_MIGRATION : readError.message);
  if (!current) return notFound('That automation no longer exists.');

  if (Object.keys(row).length) {
    const { error } = await db.from('email_automations').update(row).eq('id', id);
    if (error) return serverError(error.message);
  }

  if (Array.isArray(body.steps)) {
    if (body.steps.length > MAX_STEPS) return badRequest(`A sequence cannot have more than ${MAX_STEPS} steps.`);
    const incoming = body.steps.map((step, i) => sanitizeStep(step, i));
    const keep = new Set<string>();

    for (let i = 0; i < incoming.length; i += 1) {
      const sent = (body.steps[i] ?? {}) as Record<string, unknown>;
      const existingId = typeof sent.id === 'string' && /^[0-9a-f-]{36}$/i.test(sent.id) ? sent.id : null;

      if (existingId) {
        const { data, error } = await db.from('email_automation_steps')
          .update(incoming[i]).eq('id', existingId).eq('automation_id', id).select('id').maybeSingle();
        if (error) return serverError(error.message);
        if (data) { keep.add(data.id); continue; }
      }
      const { data, error } = await db.from('email_automation_steps')
        .insert({ ...incoming[i], automation_id: id }).select('id').single();
      if (error) return serverError(needsAutomationMigration(error) ? AUTOMATION_MIGRATION : error.message);
      keep.add(data.id);
    }

    const { data: all } = await db.from('email_automation_steps').select('id').eq('automation_id', id);
    const gone = (all ?? []).map((s) => s.id).filter((sid) => !keep.has(sid));
    if (gone.length) await db.from('email_automation_steps').delete().in('id', gone);
  }

  const { data: saved } = await db.from('email_automations').select(LIST).eq('id', id).maybeSingle();
  const { data: steps } = await db.from('email_automation_steps').select(STEP_COLUMNS).eq('automation_id', id).order('position');
  return ok({ automation: saved, steps: steps ?? [] });
}

export async function DELETE(req: Request) {
  const access = await authorize(req);
  if ('response' in access) return access.response;
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return badRequest('Which automation?');

  const db = getSupabaseAdmin();
  const { data: current } = await db.from('email_automations').select('name, status').eq('id', id).maybeSingle();
  if (!current) return notFound('That automation no longer exists.');
  if (current.status === 'active') return badRequest('Pause the automation before deleting it.');

  const { error } = await db.from('email_automations').delete().eq('id', id);
  if (error) return serverError(error.message);
  await writeAudit(access.auth.admin, {
    action: 'automation.delete', targetType: 'automation', targetId: id, targetLabel: current.name,
  });
  return ok({ deleted: true });
}
