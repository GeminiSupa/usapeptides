const test = require('node:test');
const assert = require('node:assert/strict');

const { loadTs } = require('./loadTs.cjs');

const {
  CALL_RECORDING_SETTING_ID,
  DEFAULT_CALL_RECORDING,
  normalizeCallRecording,
  dialRecordAttribute,
} = loadTs('src/lib/twilioCallRecording.ts');

test('the setting key is the one the dashboard and the webhook agree on', () => {
  assert.equal(CALL_RECORDING_SETTING_ID, 'twilio_call_recording');
});

test('recording is off until somebody turns it on', () => {
  assert.equal(DEFAULT_CALL_RECORDING.enabled, false);
  assert.equal(normalizeCallRecording(undefined).enabled, false);
  assert.equal(normalizeCallRecording(null).enabled, false);
  assert.equal(normalizeCallRecording({}).enabled, false);
  assert.equal(normalizeCallRecording('yes').enabled, false, 'a string is not a setting');
});

test('only a real boolean true switches recording on', () => {
  assert.equal(normalizeCallRecording({ enabled: true }).enabled, true);
  assert.equal(normalizeCallRecording({ enabled: 'true' }).enabled, false);
  assert.equal(normalizeCallRecording({ enabled: 1 }).enabled, false);
});

test('who changed it survives the round trip', () => {
  const row = { enabled: true, changed_by: 'someone@example.com', changed_at: '2026-10-09T12:00:00.000Z' };
  assert.deepEqual(normalizeCallRecording(row), {
    enabled: true,
    changedBy: 'someone@example.com',
    changedAt: '2026-10-09T12:00:00.000Z',
  });
});

test('a half-written row does not break the read', () => {
  assert.deepEqual(normalizeCallRecording({ enabled: true, changed_by: 42 }), {
    enabled: true,
    changedBy: null,
    changedAt: null,
  });
});

test('the Dial attribute is absent when recording is off, not set to false', () => {
  // An attribute of record="false" is not valid TwiML; the attribute has to
  // be left off the element entirely.
  assert.equal(dialRecordAttribute(false), undefined);
  assert.equal(dialRecordAttribute(true), 'record-from-ringing-dual');
});
