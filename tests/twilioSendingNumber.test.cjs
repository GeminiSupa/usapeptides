const test = require('node:test');
const assert = require('node:assert/strict');

const { loadTs } = require('./loadTs.cjs');

const {
  SENDING_NUMBER_SETTING_ID,
  normalizeSendingNumber,
} = loadTs('src/lib/twilioSendingNumber.ts');

test('the setting key is stable', () => {
  assert.equal(SENDING_NUMBER_SETTING_ID, 'twilio_sending_number');
});

test('nothing saved reads as no default', () => {
  assert.deepEqual(normalizeSendingNumber(undefined), { number: null, changedBy: null, changedAt: null });
  assert.deepEqual(normalizeSendingNumber({}), { number: null, changedBy: null, changedAt: null });
});

test('only a properly formed number is accepted out of the database', () => {
  // A hand-edited row must not be able to put rubbish into the "from" field
  // of every outgoing message.
  assert.equal(normalizeSendingNumber({ number: '+12145550001' }).number, '+12145550001');
  assert.equal(normalizeSendingNumber({ number: '2145550001' }).number, null);
  assert.equal(normalizeSendingNumber({ number: 'whatever' }).number, null);
  assert.equal(normalizeSendingNumber({ number: 12145550001 }).number, null);
});

test('who changed it is kept', () => {
  assert.deepEqual(
    normalizeSendingNumber({ number: '+12145550001', changed_by: 'a@b.com', changed_at: '2026-10-10T00:00:00.000Z' }),
    { number: '+12145550001', changedBy: 'a@b.com', changedAt: '2026-10-10T00:00:00.000Z' }
  );
});
