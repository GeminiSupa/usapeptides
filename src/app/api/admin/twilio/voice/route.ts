import { features } from '@/lib/env';
import { chooseSender, isE164, ownedNumbers, toE164 } from '@/lib/twilio';
import { defaultSender } from '@/lib/twilioSendingNumber';
import { readCallRecording, dialRecordAttribute } from '@/lib/twilioCallRecording';
import { readFormParams, verifyTwilioSignature } from '@/lib/twilioWebhookSignature';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/twilio/voice — the instruction sheet Twilio fetches the
 * moment an admin's browser places a call.
 *
 * THIS ROUTE DELIBERATELY DOES NOT CALL requireAdmin. Twilio calls it server
 * to server with no session and no cookie; an admin check here would refuse
 * every real call. What takes its place is the signature on the request,
 * which only the holder of the account's auth token can produce. Everything
 * else on /api/admin/twilio is gated on the `messaging` permission as usual.
 *
 * It answers in TwiML, Twilio's XML dialect. A failure still has to be valid
 * XML — Twilio reads a 500 as "call failed" and the person at the keyboard
 * hears a generic error, so a refusal is spoken aloud instead.
 */

export async function POST(req: Request) {
  const params = await readFormParams(req);

  const signature = verifyTwilioSignature(req, params);
  if (!signature.ok) {
    // No TwiML here: a request that cannot be shown to be Twilio's gets
    // nothing that would tell it what this endpoint does.
    return new Response('Forbidden', { status: 403 });
  }

  if (!features.twilioVoice) {
    return twiml(say('Calling is not set up on this site yet.'));
  }

  // `To` is whatever the browser passed to device.connect(). It arrives from
  // the client, so it is validated here rather than trusted: this is the one
  // place in the system that can be made to dial an arbitrary number at the
  // business's expense.
  const to = toE164(params.To ?? params.to);
  if (!to || !isE164(to)) {
    return twiml(say('That number does not look right. Check it and try again.'));
  }

  // Which of our numbers the person being called sees. The browser proposes
  // it along with the number to dial, and it is checked against the account
  // here - the webhook is reachable by anyone who can forge a signature's
  // worth of trust, so nothing in these params is taken on faith.
  const [owned, fallback] = await Promise.all([ownedNumbers(), defaultSender()]);
  const sender = chooseSender(params.CallerId ?? params.callerId, owned, fallback);
  if (!sender.ok) {
    return twiml(say('No caller ID is set for this call. Choose a number in the dashboard and try again.'));
  }

  const recording = await readCallRecording();
  const record = dialRecordAttribute(recording.enabled);

  const attributes = [
    `callerId="${escapeXml(sender.from)}"`,
    // Ring the far end before bridging, so the caller hears ringing rather
    // than silence, and the recording starts when the call does.
    'answerOnBridge="true"',
    'timeout="30"',
    record ? `record="${escapeXml(record)}"` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return twiml(`<Dial ${attributes}><Number>${escapeXml(to)}</Number></Dial>`);
}

/**
 * Twilio retries a webhook with GET in some failure paths. Answering with
 * valid TwiML rather than a 405 keeps the caller from hearing Twilio's own
 * error message.
 */
export async function GET() {
  return twiml(say('This line only accepts calls placed from the dashboard.'));
}

/* -------------------------------------------------------------------------- */

const say = (text: string): string => `<Say>${escapeXml(text)}</Say><Hangup/>`;

const twiml = (inner: string): Response =>
  new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`, {
    status: 200,
    headers: { 'Content-Type': 'text/xml; charset=utf-8', 'Cache-Control': 'no-store' },
  });

/**
 * Escapes the five XML entities.
 *
 * Both the phone number and the spoken text end up inside markup, and an
 * unescaped `&` is enough to make Twilio reject the whole document — at
 * which point the call simply fails with no explanation.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
