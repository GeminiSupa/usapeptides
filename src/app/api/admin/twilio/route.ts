import { requireAdmin } from '@/lib/adminAuth';
import { featureUnavailable } from '@/lib/env';
import { ok, badRequest, serverError, readJson } from '@/lib/api';
import { writeAudit } from '@/lib/audit';
import {
  twilioStatus,
  toE164,
  parseRecipientList,
  clipBody,
  sendSms,
  sendWhatsApp,
  sendBulkSms,
  triggerStudioFlow,
  isKnownFlowSid,
  chooseSender,
  ownedNumbers,
} from '@/lib/twilio';
import { readCallRecording, writeCallRecording } from '@/lib/twilioCallRecording';
import { defaultSender, readSendingNumber, writeSendingNumber } from '@/lib/twilioSendingNumber';

export const dynamic = 'force-dynamic';

/**
 * Dashboard > SMS & calls.
 *
 *   GET  /api/admin/twilio                 what is configured + the recording switch
 *   POST /api/admin/twilio  { action: 'sms' | 'bulk_sms' | 'whatsapp' | 'flow' | 'recording', ... }
 *
 * Gated on the `messaging` permission, which `routePermissions.ts` maps for
 * every path under /api/admin/twilio. The one exception is the voice webhook,
 * which Twilio calls with no session and which proves itself with a signature
 * instead — see that file.
 */

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const status = twilioStatus();
    // The switch lives in the database, so it is readable even when Twilio
    // itself is not configured — which is what lets the panel explain the
    // situation instead of showing an empty screen.
    const recording = status.configured ? await readCallRecording() : null;
    const sendingNumber = status.configured ? await readSendingNumber() : null;
    return ok({ twilio: status, recording, sendingNumber });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const body = await readJson<Record<string, unknown>>(req);
  if (!body) return badRequest('Send an action.');

  const action = typeof body.action === 'string' ? body.action : '';

  switch (action) {
    case 'sms':
      return handleSms(body, auth.admin);
    case 'bulk_sms':
      return handleBulkSms(body, auth.admin);
    case 'whatsapp':
      return handleWhatsApp(body, auth.admin);
    case 'flow':
      return handleFlow(body, auth.admin);
    case 'recording':
      return handleRecording(body, auth.admin);
    case 'sending_number':
      return handleSendingNumber(body, auth.admin);
    default:
      return badRequest('Unknown action.');
  }
}

/* -------------------------------------------------------------------------- */

type Admin = Extract<Awaited<ReturnType<typeof requireAdmin>>, { ok: true }>['admin'];

async function handleSms(body: Record<string, unknown>, admin: Admin) {
  const unavailable = featureUnavailable('twilioSms');
  if (unavailable) return unavailable;

  const to = toE164(body.to);
  const text = clipBody(body.body);

  if (!to) return badRequest('That does not look like a phone number. Include the country code, e.g. +1 555 123 4567.');
  if (!text) return badRequest('Type a message to send.');

  const sender = await resolveSender(body.from);
  if (!sender.ok) return badRequest(sender.error);

  try {
    const result = await sendSms(to, text, sender.from);
    // Logged whether or not Twilio accepted it: a failed send to the wrong
    // number is still an attempt somebody made.
    await writeAudit(admin, {
      action: 'twilio.sms',
      targetType: 'phone',
      targetId: to,
      targetLabel: to,
      detail: { from: sender.from, ok: result.ok, characters: text.length, error: result.error ?? null },
    });
    if (!result.ok) return badRequest(result.error ?? 'Twilio refused the message.');
    return ok({ result, from: sender.from });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}

async function handleBulkSms(body: Record<string, unknown>, admin: Admin) {
  const unavailable = featureUnavailable('twilioSms');
  if (unavailable) return unavailable;

  const { valid, invalid } = parseRecipientList(body.recipients);
  const text = clipBody(body.body);

  if (!text) return badRequest('Type a message to send.');
  if (!valid.length) {
    return badRequest(
      invalid.length
        ? 'None of those look like phone numbers. Include the country code, e.g. +1 555 123 4567.'
        : 'Add at least one phone number.'
    );
  }

  const LIMIT = 200;
  if (valid.length > LIMIT) {
    return badRequest(`That is ${valid.length} numbers. Send at most ${LIMIT} at a time.`);
  }

  const sender = await resolveSender(body.from);
  if (!sender.ok) return badRequest(sender.error);

  try {
    const results = await sendBulkSms(valid, text, sender.from, LIMIT);
    const sent = results.filter((r) => r.ok).length;

    await writeAudit(admin, {
      action: 'twilio.bulk_sms',
      targetType: 'campaign',
      targetLabel: `${sent} of ${results.length} numbers`,
      detail: { from: sender.from, attempted: results.length, sent, failed: results.length - sent, characters: text.length },
    });

    return ok({ results, sent, failed: results.length - sent, skipped: invalid, from: sender.from });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}

async function handleWhatsApp(body: Record<string, unknown>, admin: Admin) {
  const unavailable = featureUnavailable('twilioWhatsApp');
  if (unavailable) return unavailable;

  const to = toE164(body.to);
  const text = clipBody(body.body);

  if (!to) return badRequest('That does not look like a phone number. Include the country code.');
  if (!text) return badRequest('Type a message to send.');

  try {
    const result = await sendWhatsApp(to, text);
    await writeAudit(admin, {
      action: 'twilio.whatsapp',
      targetType: 'phone',
      targetId: to,
      targetLabel: to,
      detail: { ok: result.ok, characters: text.length, error: result.error ?? null },
    });
    if (!result.ok) return badRequest(result.error ?? 'Twilio refused the message.');
    return ok({ result });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}

async function handleFlow(body: Record<string, unknown>, admin: Admin) {
  const unavailable = featureUnavailable('twilioFlows');
  if (unavailable) return unavailable;

  const to = toE164(body.to);
  const flowSid = body.flowSid;

  if (!to) return badRequest('That does not look like a phone number. Include the country code.');
  // Only flows this deployment was configured with. Accepting any SID would
  // let the dashboard start a flow belonging to something else on the account.
  if (!isKnownFlowSid(flowSid)) return badRequest('Pick one of the configured flows.');

  const sender = await resolveSender(body.from);
  if (!sender.ok) return badRequest(sender.error);

  try {
    const result = await triggerStudioFlow(flowSid, to, sender.from);
    await writeAudit(admin, {
      action: 'twilio.flow',
      targetType: 'phone',
      targetId: to,
      targetLabel: to,
      detail: { flowSid, ok: result.ok, error: result.error ?? null },
    });
    if (!result.ok) return badRequest(result.error ?? 'Twilio refused to start the flow.');
    return ok({ result });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}

/**
 * Which number this send goes out from.
 *
 * The browser proposes; the server decides. The proposed number is checked
 * against the numbers the account actually owns, because a request body is
 * not evidence of anything.
 */
async function resolveSender(
  requested: unknown
): Promise<{ ok: true; from: string } | { ok: false; error: string }> {
  const [owned, fallback] = await Promise.all([ownedNumbers(), defaultSender()]);

  if (owned.size === 0) {
    return { ok: false, error: 'This Twilio account has no phone numbers on it yet.' };
  }

  return chooseSender(requested, owned, fallback);
}

/** Remembers which number to preselect next time. */
async function handleSendingNumber(body: Record<string, unknown>, admin: Admin) {
  const unavailable = featureUnavailable('twilio');
  if (unavailable) return unavailable;

  const wanted = toE164(body.number);
  if (!wanted) return badRequest('Pick a number from the list.');

  const owned = await ownedNumbers();
  if (!owned.has(wanted)) {
    return badRequest('That number is not on this Twilio account. Pick one from the list.');
  }

  try {
    return ok({ sendingNumber: await writeSendingNumber(wanted, admin.email) });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}

async function handleRecording(body: Record<string, unknown>, admin: Admin) {
  if (typeof body.enabled !== 'boolean') return badRequest('Say whether recording is on or off.');

  try {
    const before = await readCallRecording();
    const recording = await writeCallRecording(body.enabled, admin.email);

    if (before.enabled !== recording.enabled) {
      await writeAudit(admin, {
        action: 'twilio.recording',
        targetType: 'setting',
        targetId: 'twilio_call_recording',
        targetLabel: recording.enabled ? 'Recording on' : 'Recording off',
        detail: { from: before.enabled, to: recording.enabled },
      });
    }

    return ok({ recording });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
