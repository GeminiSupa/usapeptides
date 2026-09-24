import { requireAdmin } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { featureUnavailable, features } from '@/lib/env';
import { writeAudit } from '@/lib/audit';
import { ok, badRequest, notFound, serverError, readJson } from '@/lib/api';
import { sequenceProblems, type Step } from '@/lib/automations';
import { AUDIENCES, AUDIENCE_FILTERS, type AudienceFilterId, type AudienceId } from '@/lib/emailDesign';
import {
  buildAudience, composeDesigned, fromHeader, sendEmail, CampaignError,
} from '@/lib/campaignSender';
import { enroll, runDue, AUTOMATION_MIGRATION, needsAutomationMigration } from '@/lib/automationEngine';
import { getSiteContent } from '@/lib/siteContentServer';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Doing things to an automation.
 *
 *   POST { action: 'activate' | 'pause', id }
 *   POST { action: 'test', id, stepId, to: [...] }      a copy to you, recorded nowhere
 *   POST { action: 'enroll', id, emails|audience }      add people by hand
 *   POST { action: 'unenroll', id, enrollmentId }
 *   POST { action: 'run', id }                          push the queue along now
 *
 * A sequence cannot go live while it has problems, and the same check runs in
 * the builder - but the builder can be skipped and this cannot.
 */

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';
const AUDIENCE_IDS = new Set<string>(AUDIENCES.map((a) => a.id));
const FILTER_IDS = new Set<string>(AUDIENCE_FILTERS.map((f) => f.id));

async function authorize(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return { response: unavailable } as const;
  const auth = await requireAdmin(req, { permission: 'automations' });
  return auth.ok ? ({ auth } as const) : ({ response: auth.response } as const);
}

export async function POST(req: Request) {
  const access = await authorize(req);
  if ('response' in access) return access.response;

  const body = await readJson<Record<string, unknown>>(req);
  if (!body?.id) return badRequest('Which automation?');
  const id = String(body.id);
  const action = String(body.action ?? '');
  const db = getSupabaseAdmin();

  const { data: automation, error } = await db.from('email_automations')
    .select('id, name, status, trigger_type').eq('id', id).maybeSingle();
  if (error) return serverError(needsAutomationMigration(error) ? AUTOMATION_MIGRATION : error.message);
  if (!automation) return notFound('That automation no longer exists.');

  const { data: stepRows } = await db.from('email_automation_steps')
    .select('id, position, kind, subject, preview_text, from_name, reply_to, design, wait_minutes, condition_type, on_fail')
    .eq('automation_id', id).order('position');
  const steps = (stepRows ?? []) as unknown as Step[];

  try {
    switch (action) {
      case 'activate': {
        if (!features.email) {
          return badRequest('No email service is connected yet, so nothing could be sent. Add RESEND_API_KEY in Vercel and redeploy.');
        }
        const problems = sequenceProblems(steps);
        if (problems.length) {
          return badRequest('Fix these before turning it on.', Object.fromEntries(problems.map((p, i) => [p.stepId ?? `general_${i}`, p.message])));
        }
        const { error: update } = await db.from('email_automations').update({ status: 'active' }).eq('id', id);
        if (update) return serverError(update.message);
        await writeAudit(access.auth.admin, {
          action: 'automation.activate', targetType: 'automation', targetId: id, targetLabel: automation.name,
        });
        return ok({ status: 'active' });
      }

      case 'pause': {
        const { error: update } = await db.from('email_automations').update({ status: 'paused' }).eq('id', id);
        if (update) return serverError(update.message);
        await writeAudit(access.auth.admin, {
          action: 'automation.pause', targetType: 'automation', targetId: id, targetLabel: automation.name,
        });
        return ok({ status: 'paused' });
      }

      case 'test': {
        const step = steps.find((s) => s.id === String(body.stepId));
        if (!step) return badRequest('Which step should be sent?');
        if (step.kind !== 'email') return badRequest('That step is not an email.');
        if (!String(step.subject ?? '').trim()) return badRequest('Add a subject line first.');

        const to = (Array.isArray(body.to) ? body.to : [])
          .map((v) => String(v ?? '').trim().toLowerCase())
          .filter((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
          .slice(0, 5);
        if (!to.length) return badRequest('Type an email address for the test.');

        const content = await getSiteContent();
        const business = content['business.name'] || automation.name;
        for (const address of to) {
          const composed = await composeDesigned({
            design: step.design,
            subject: `[Test] ${step.subject}`,
            previewText: step.preview_text,
            recipient: { email: address, name: null },
            trackId: ZERO_UUID,
            scope: 'automation',
            tag: id,
          });
          await sendEmail({
            from: fromHeader(step.from_name || business),
            to: address,
            replyTo: step.reply_to || undefined,
            subject: composed.subject,
            html: composed.html,
            text: composed.text,
            headers: { 'List-Unsubscribe': `<${composed.unsub}>`, 'X-Automation-Id': id },
          });
        }
        return ok({ sent: to.length });
      }

      case 'enroll': {
        const audience = String(body.audience ?? '');
        let people: { email: string; name: string | null; source: string }[] = [];

        if (audience && AUDIENCE_IDS.has(audience)) {
          const filter = FILTER_IDS.has(String(body.audience_filter)) ? String(body.audience_filter) : 'none';
          people = await buildAudience(db, audience as AudienceId, filter as AudienceFilterId);
        } else {
          people = (Array.isArray(body.emails) ? body.emails : String(body.emails ?? '').split(/[\s,;]+/))
            .map((v) => String(v ?? '').trim().toLowerCase())
            .filter(Boolean)
            .map((email) => ({ email, name: null, source: 'manual' }));
        }
        if (!people.length) return badRequest('Nobody to add.');
        if (people.length > 5000) return badRequest('That is more than 5,000 people. Narrow the audience.');

        const result = await enroll(id, people);
        await writeAudit(access.auth.admin, {
          action: 'automation.enroll', targetType: 'automation', targetId: id, targetLabel: automation.name,
          detail: { added: result.enrolled, skipped: result.skipped.length },
        });
        return ok(result);
      }

      case 'unenroll': {
        const enrollmentId = String(body.enrollmentId ?? '');
        if (!enrollmentId) return badRequest('Which person?');
        const { error: update } = await db.from('email_automation_enrollments').update({
          status: 'stopped', stopped_reason: 'Removed by hand', claimed_at: null,
          completed_at: new Date().toISOString(),
        }).eq('id', enrollmentId).eq('automation_id', id);
        if (update) return serverError(update.message);
        return ok({ stopped: true });
      }

      case 'run': {
        if (automation.status !== 'active') return badRequest('Turn the automation on first.');
        return ok(await runDue(id));
      }

      default:
        return badRequest('Unknown action.');
    }
  } catch (err) {
    if (err instanceof CampaignError) return badRequest(err.message);
    return serverError(err instanceof Error ? err.message : 'Something went wrong.');
  }
}
