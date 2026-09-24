import { requireAdmin } from '@/lib/adminAuth';
import { featureUnavailable } from '@/lib/env';
import { writeAudit } from '@/lib/audit';
import { ok, badRequest, serverError, readJson } from '@/lib/api';
import { checkDeliverability } from '@/lib/deliverability';
import { getPolicyState, savePolicy } from '@/lib/sendingPolicy';
import { checkEmail, WARMUP_SCHEDULE, WARMUP_DAYS } from '@/lib/emailHealth';

export const dynamic = 'force-dynamic';
// node:dns is not available on the edge runtime, and the DNS lookups are the
// whole point of this route.
export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Why our email goes to spam, and what is being done about it.
 *
 *   GET                              DNS report, sending limit, today's count
 *   POST { action: 'save', ... }     warm-up settings
 *   POST { action: 'check', email }  spam-risk score for one draft
 *
 * Read-only against DNS. Nothing here changes a record at the registrar; it
 * reports what is published and gives the owner the record to paste.
 */

async function authorize(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return { response: unavailable } as const;
  const auth = await requireAdmin(req, { permission: 'automations' });
  return auth.ok ? ({ auth } as const) : ({ response: auth.response } as const);
}

export async function GET(req: Request) {
  const access = await authorize(req);
  if ('response' in access) return access.response;

  const [dns, policy] = await Promise.all([
    checkDeliverability().catch((err: unknown) => ({
      sendingDomain: null, fromAddress: null, provider: 'none' as const, checks: [],
      score: { passed: 0, total: 0 },
      error: err instanceof Error ? err.message : 'DNS lookup failed',
    })),
    getPolicyState(),
  ]);

  return ok({
    dns,
    policy: policy.policy,
    today: { ...policy.today, cap: Number.isFinite(policy.today.cap) ? policy.today.cap : null },
    sentToday: policy.sentToday,
    remaining: Number.isFinite(policy.remaining) ? policy.remaining : null,
    ready: policy.ready,
    notice: policy.notice,
    schedule: WARMUP_SCHEDULE.map(([day, cap]) => ({ day, cap })),
    warmupDays: WARMUP_DAYS,
  });
}

export async function POST(req: Request) {
  const access = await authorize(req);
  if ('response' in access) return access.response;

  const body = await readJson<Record<string, unknown>>(req);
  if (!body) return badRequest('Send JSON.');

  if (body.action === 'check') {
    const email = (body.email ?? {}) as Record<string, unknown>;
    return ok({
      report: checkEmail({
        subject: String(email.subject ?? ''),
        previewText: String(email.previewText ?? ''),
        text: String(email.text ?? ''),
        linkCount: Number(email.linkCount ?? 0),
        imageCount: Number(email.imageCount ?? 0),
        hasUnsubscribe: email.hasUnsubscribe !== false,
      }),
    });
  }

  if (body.action !== 'save') return badRequest('Unknown action.');

  try {
    const state = await savePolicy({
      warmup_enabled: Boolean(body.warmup_enabled),
      warmup_started_on: body.warmup_started_on == null ? null : String(body.warmup_started_on),
      daily_cap_override: body.daily_cap_override == null || body.daily_cap_override === ''
        ? null : Number(body.daily_cap_override),
      max_daily_cap: Number(body.max_daily_cap),
    });
    await writeAudit(access.auth.admin, {
      action: 'email.policy_update', targetType: 'email_sending_policy', targetLabel: 'Sending limits',
      detail: {
        warmup: state.policy.warmup_enabled, started: state.policy.warmup_started_on,
        cap: state.policy.max_daily_cap, override: state.policy.daily_cap_override,
      },
    });
    return ok({
      policy: state.policy,
      today: { ...state.today, cap: Number.isFinite(state.today.cap) ? state.today.cap : null },
      sentToday: state.sentToday,
      ready: state.ready,
      notice: state.notice,
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Could not save.');
  }
}
