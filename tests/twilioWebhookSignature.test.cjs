const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { loadTs } = require('./loadTs.cjs');

const AUTH_TOKEN = 'a'.repeat(32);
process.env.TWILIO_AUTH_TOKEN = AUTH_TOKEN;

const { publicUrlOf, verifyTwilioSignature, readFormParams } = loadTs('src/lib/twilioWebhookSignature.ts');

/**
 * Twilio's own scheme: the URL, then every POST field sorted by name and
 * concatenated as name followed by value, HMAC-SHA1 with the auth token,
 * base64. Reimplemented here rather than imported so the test would catch
 * the library changing under us.
 */
function sign(url, params) {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
  return crypto.createHmac('sha1', AUTH_TOKEN).update(Buffer.from(data, 'utf-8')).digest('base64');
}

const formRequest = (url, params, headers = {}) =>
  new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
    body: new URLSearchParams(params).toString(),
  });

/* ----------------------------------------------------------- the signed URL */

test('the signed URL is rebuilt from the forwarded host, not the proxied one', () => {
  const req = new Request('http://localhost:3000/api/admin/twilio/voice', {
    method: 'POST',
    headers: { 'x-forwarded-host': 'www.example.com', 'x-forwarded-proto': 'http' },
  });

  // https is forced: the proxy speaks http to the function, but Twilio signed
  // the public https address. Trusting x-forwarded-proto here is what made
  // every signature fail.
  assert.equal(publicUrlOf(req), 'https://www.example.com/api/admin/twilio/voice');
});

test('localhost keeps its scheme so the webhook can be exercised locally', () => {
  const req = new Request('http://localhost:3000/api/admin/twilio/voice', { method: 'POST' });
  assert.equal(publicUrlOf(req), 'http://localhost:3000/api/admin/twilio/voice');
});

test('a query string stays part of the signed URL', () => {
  const req = new Request('https://www.example.com/api/admin/twilio/voice?x=1', { method: 'POST' });
  assert.equal(publicUrlOf(req), 'https://www.example.com/api/admin/twilio/voice?x=1');
});

/* --------------------------------------------------------- the verification */

test('a correctly signed request is accepted', async () => {
  const url = 'https://www.example.com/api/admin/twilio/voice';
  const params = { To: '+15551234567', From: 'client:admin-test', CallSid: 'CA' + '1'.repeat(32) };

  const req = formRequest(url, params, { 'x-twilio-signature': sign(url, params) });
  const parsed = await readFormParams(req);

  assert.deepEqual(parsed, params);
  assert.deepEqual(verifyTwilioSignature(req, parsed), { ok: true, reason: 'valid' });
});

test('changing a single parameter invalidates the signature', async () => {
  const url = 'https://www.example.com/api/admin/twilio/voice';
  const params = { To: '+15551234567', CallSid: 'CA' + '1'.repeat(32) };
  const signature = sign(url, params);

  // What an attacker would do: keep a captured signature, change the number.
  const tampered = { ...params, To: '+447700900000' };
  const req = formRequest(url, tampered, { 'x-twilio-signature': signature });

  assert.deepEqual(verifyTwilioSignature(req, tampered), { ok: false, reason: 'invalid-signature' });
});

test('a signature for a different URL is rejected', async () => {
  const params = { To: '+15551234567' };
  const signature = sign('https://someone-else.example/api/admin/twilio/voice', params);

  const req = formRequest('https://www.example.com/api/admin/twilio/voice', params, {
    'x-twilio-signature': signature,
  });

  assert.deepEqual(verifyTwilioSignature(req, params), { ok: false, reason: 'invalid-signature' });
});

test('a bad signature is refused outside production too', async () => {
  const params = { To: '+15551234567' };
  const req = formRequest('http://localhost:3000/api/admin/twilio/voice', params, {
    'x-twilio-signature': 'not-a-signature',
  });

  assert.deepEqual(verifyTwilioSignature(req, params), { ok: false, reason: 'invalid-signature' });
});

/* ------------------------------------------------------- signed or not at all */

test('an unsigned request passes outside production, so it can be tested locally', async () => {
  const params = { To: '+15551234567' };
  const req = formRequest('http://localhost:3000/api/admin/twilio/voice', params);

  assert.deepEqual(verifyTwilioSignature(req, params), { ok: true, reason: 'not-required' });
});

test('an unsigned request is refused in production', async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';

  try {
    const url = 'https://www.example.com/api/admin/twilio/voice';
    const params = { To: '+15551234567' };
    const req = formRequest(url, params);

    assert.deepEqual(verifyTwilioSignature(req, params), { ok: false, reason: 'missing-signature' });

    // And the signed version of the same request still gets through.
    const signed = formRequest(url, params, { 'x-twilio-signature': sign(url, params) });
    assert.deepEqual(verifyTwilioSignature(signed, params), { ok: true, reason: 'valid' });
  } finally {
    process.env.NODE_ENV = previous;
  }
});

test('a malformed body reads as no parameters rather than throwing', async () => {
  const req = new Request('https://www.example.com/api/admin/twilio/voice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'not form data',
  });

  assert.deepEqual(await readFormParams(req), {});
});
