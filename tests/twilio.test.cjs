const test = require('node:test');
const assert = require('node:assert/strict');

const { loadTs } = require('./loadTs.cjs');

// Set before the module loads: env.ts reads process.env once, at import.
process.env.TWILIO_ACCOUNT_SID = 'AC' + '0'.repeat(32);
process.env.TWILIO_AUTH_TOKEN = '0'.repeat(32);
process.env.TWILIO_API_KEY = 'SK' + '0'.repeat(32);
process.env.TWILIO_API_SECRET = '0'.repeat(32);
process.env.TWILIO_TWIML_APP_SID = 'AP' + '0'.repeat(32);
process.env.TWILIO_PHONE_NUMBER = '+15551234567';
process.env.TWILIO_STUDIO_FLOWS = 'Welcome:FW' + 'a'.repeat(32) + ',Re-engage:FW' + 'b'.repeat(32);

const twilio = loadTs('src/lib/twilio.ts');

test('toE164 accepts the forms people actually type', () => {
  assert.equal(twilio.toE164('+1 555 123 4567'), '+15551234567');
  assert.equal(twilio.toE164('(555) 123-4567'), '+15551234567');
  assert.equal(twilio.toE164('555.123.4567'), '+15551234567');
  assert.equal(twilio.toE164('15551234567'), '+15551234567');
  assert.equal(twilio.toE164('+44 20 7946 0958'), '+442079460958');
});

test('toE164 refuses what it cannot be sure about', () => {
  assert.equal(twilio.toE164(''), null);
  assert.equal(twilio.toE164('   '), null);
  assert.equal(twilio.toE164('12345'), null, 'too short to be a number');
  assert.equal(twilio.toE164('call me'), null);
  assert.equal(twilio.toE164('555-CALL-NOW'), null, 'letters are not dialled');
  assert.equal(twilio.toE164('+1'), null);
  assert.equal(twilio.toE164(null), null);
  assert.equal(twilio.toE164(12345), null, 'only strings');
});

test('isE164 matches only a normalised number', () => {
  assert.equal(twilio.isE164('+15551234567'), true);
  assert.equal(twilio.isE164('15551234567'), false);
  assert.equal(twilio.isE164('+0555123456'), false, 'country codes do not start with zero');
});

test('parseRecipientList splits, normalises and de-duplicates', () => {
  const { valid, invalid } = twilio.parseRecipientList(
    '+1 555 123 4567\n(555) 123-4567\n555.987.6543, nonsense; +44 20 7946 0958'
  );

  assert.deepEqual(valid, ['+15551234567', '+15559876543', '+442079460958']);
  assert.deepEqual(invalid, ['nonsense']);
});

test('parseRecipientList copes with an empty or non-string list', () => {
  assert.deepEqual(twilio.parseRecipientList(''), { valid: [], invalid: [] });
  assert.deepEqual(twilio.parseRecipientList(null), { valid: [], invalid: [] });
  assert.deepEqual(twilio.parseRecipientList('\n\n , ; '), { valid: [], invalid: [] });
});

test('clipBody trims and caps at the SMS limit', () => {
  assert.equal(twilio.clipBody('  hello  '), 'hello');
  assert.equal(twilio.clipBody('x'.repeat(2000)).length, 1600);
  assert.equal(twilio.clipBody(undefined), '');
});

test('voiceIdentityFor is a safe identity that still names the person', () => {
  assert.equal(twilio.voiceIdentityFor('Jo.Smith+admin@Example.com'), 'admin-jo-smith-admin-example-com');
  assert.ok(/^[a-z0-9-]+$/.test(twilio.voiceIdentityFor('someone@example.com')));
});

test('only flows named in the environment can be started', () => {
  assert.equal(twilio.isKnownFlowSid('FW' + 'a'.repeat(32)), true);
  assert.equal(twilio.isKnownFlowSid('FW' + 'c'.repeat(32)), false, 'another flow on the same account');
  assert.equal(twilio.isKnownFlowSid(''), false);
  assert.equal(twilio.isKnownFlowSid(undefined), false);
});

test('the status report names what is configured and leaks no secret', () => {
  const status = twilio.twilioStatus();

  assert.equal(status.configured, true);
  assert.equal(status.voice, true);
  assert.equal(status.fromNumber, '+15551234567');
  assert.equal(status.studioFlows.length, 2);
  assert.equal(status.studioFlows[0].label, 'Welcome');

  const serialised = JSON.stringify(status);
  assert.ok(!serialised.includes(process.env.TWILIO_API_SECRET), 'the API secret must never be returned');
  assert.ok(!serialised.includes(process.env.TWILIO_AUTH_TOKEN), 'the auth token must never be returned');
});

test('a voice token is signed with the API key, not the account or auth token', () => {
  const { token, identity } = twilio.createVoiceToken('admin-test');

  const [, payloadPart] = token.split('.');
  const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));

  // The trap this guards: signing with the auth token produces a JWT that
  // looks fine here and is rejected by Twilio at call time.
  assert.ok(payload.iss.startsWith('SK'), 'issuer must be the API key SID');
  assert.ok(payload.sub.startsWith('AC'), 'subject must be the account SID');
  assert.ok(payload.grants.voice.outgoing.application_sid.startsWith('AP'), 'must point at the TwiML app');
  assert.equal(payload.grants.identity, identity);
});

/* ----------------------------------------------------- choosing the sender */

const OWNED = new Set(['+15551234567', '+12145550001', '+19095550002']);

test('an explicitly chosen number is used when we own it', () => {
  assert.deepEqual(twilio.chooseSender('+1 214 555 0001', OWNED, '+15551234567'), {
    ok: true,
    from: '+12145550001',
  });
});

test('nothing chosen falls back to the default', () => {
  assert.deepEqual(twilio.chooseSender('', OWNED, '+15551234567'), { ok: true, from: '+15551234567' });
  assert.deepEqual(twilio.chooseSender(undefined, OWNED, '+15551234567'), { ok: true, from: '+15551234567' });
});

test('a number we do not own is refused, never quietly swapped', () => {
  // The whole point of the server-side check: a crafted request must not be
  // able to send from a number that is not on the account, and must not be
  // silently rewritten to one that is - the sender is visible to the person
  // receiving it.
  const result = twilio.chooseSender('+447700900000', OWNED, '+15551234567');
  assert.equal(result.ok, false);
  assert.match(result.error, /not on this Twilio account/i);
});

test('a chosen value that is not a phone number is refused', () => {
  const result = twilio.chooseSender('pick one', OWNED, '+15551234567');
  assert.equal(result.ok, false);
  assert.match(result.error, /not a valid phone number/i);
});

test('a stale default that is no longer on the account asks for a choice', () => {
  // A number released in the Twilio console must not keep being offered.
  const result = twilio.chooseSender('', OWNED, '+15559999999');
  assert.equal(result.ok, false);
  assert.match(result.error, /Choose which number/i);
});

test('no default and no choice asks for a choice', () => {
  const result = twilio.chooseSender('', OWNED, null);
  assert.equal(result.ok, false);
  assert.match(result.error, /Choose which number/i);
});
