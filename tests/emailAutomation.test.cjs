const assert = require('node:assert/strict');
const test = require('node:test');
const { loadTs } = require('./loadTs.cjs');

const health = loadTs('src/lib/emailHealth.ts');
const automations = loadTs('src/lib/automations.ts');

/* ------------------------------------------------------------- warm-up --- */

test('the warm-up starts small and never more than doubles', () => {
  const caps = [];
  for (let day = 1; day <= health.WARMUP_DAYS; day += 1) caps.push(health.warmupCap(day, 100000));
  assert.equal(caps[0], 25, 'day one is 25');
  for (let i = 1; i < caps.length; i += 1) {
    assert.ok(caps[i] >= caps[i - 1], 'the limit never goes backwards');
    assert.ok(caps[i] <= caps[i - 1] * 2, `day ${i + 1} more than doubled`);
  }
});

test('the warm-up never exceeds the ceiling the owner set', () => {
  assert.equal(health.warmupCap(1, 10), 10);
  assert.equal(health.warmupCap(30, 10), 10);
});

test('day one is day one, and the day advances with the calendar', () => {
  const at = (iso) => new Date(iso);
  assert.equal(health.warmupDay('2026-09-01', at('2026-09-01T23:00:00Z')), 1);
  assert.equal(health.warmupDay('2026-09-01', at('2026-09-02T00:30:00Z')), 2);
  assert.equal(health.warmupDay('2026-09-01', at('2026-09-11T12:00:00Z')), 11);
  assert.equal(health.warmupDay(null), 1, 'no start date behaves as the first day');
  assert.equal(health.warmupDay('nonsense'), 1);
});

test('a finished warm-up hands back the full ceiling', () => {
  const policy = { warmup_enabled: true, warmup_started_on: '2026-01-01', daily_cap_override: null, max_daily_cap: 2000 };
  const today = health.dailyCap(policy, new Date('2026-06-01T00:00:00Z'));
  assert.equal(today.cap, 2000);
});

test('with no start date the ramp cannot advance, which is why sending stamps one', () => {
  // warmupDay(null) is day one on every date, so an unset start date pins the
  // limit at the first rung for ever. reserveSends stamps today's date on the
  // first send to start the clock; this test pins the behaviour that makes
  // that stamping necessary, so removing it cannot pass unnoticed.
  const policy = { warmup_enabled: true, warmup_started_on: null, daily_cap_override: null, max_daily_cap: 2000 };
  assert.equal(health.dailyCap(policy, new Date('2026-09-01T00:00:00Z')).cap, 25);
  assert.equal(health.dailyCap(policy, new Date('2027-09-01T00:00:00Z')).cap, 25);
});

test('a manual override wins, but cannot exceed the ceiling', () => {
  const policy = { warmup_enabled: true, warmup_started_on: '2026-09-01', daily_cap_override: 5000, max_daily_cap: 2000 };
  assert.equal(health.dailyCap(policy, new Date('2026-09-02T00:00:00Z')).cap, 2000);

  const lower = health.dailyCap({ ...policy, daily_cap_override: 10 }, new Date('2026-09-02T00:00:00Z'));
  assert.equal(lower.cap, 10);
});

test('turning the warm-up off lifts the limit to the ceiling', () => {
  const policy = { warmup_enabled: false, warmup_started_on: '2026-09-01', daily_cap_override: null, max_daily_cap: 750 };
  assert.equal(health.dailyCap(policy, new Date('2026-09-02T00:00:00Z')).cap, 750);
});

/* ---------------------------------------------------------- spam checks --- */

const plain = {
  subject: 'Your order is on its way',
  text: 'Thanks for ordering. Everything has been packed and is leaving today. Tracking follows in a separate note once the carrier scans it, usually within a day.',
  linkCount: 1,
  imageCount: 0,
  hasUnsubscribe: true,
};

test('an ordinary email scores clean', () => {
  const report = health.checkEmail(plain);
  assert.equal(report.verdict, 'good');
  assert.equal(report.score, 0);
});

test('shouting, money words and a missing unsubscribe all count against it', () => {
  const loud = health.checkEmail({ ...plain, subject: 'ACT NOW!! FREE GIFT!!' });
  assert.equal(loud.verdict, 'poor');
  assert.ok(loud.findings.some((f) => /capital letters/i.test(f.message)));

  const noUnsub = health.checkEmail({ ...plain, hasUnsubscribe: false });
  assert.ok(noUnsub.findings.some((f) => /unsubscribe/i.test(f.message)));
  assert.ok(noUnsub.score >= 25);
});

test('medical claims are treated as the highest risk for this trade', () => {
  const report = health.checkEmail({ ...plain, text: 'This product is FDA approved and clinically proven to cure everything.' });
  assert.equal(report.verdict, 'poor');
  assert.equal(report.findings[0].severity, 'high');
});

test('a near-empty email with a link is flagged', () => {
  const report = health.checkEmail({ ...plain, text: 'Click below.', linkCount: 1 });
  assert.ok(report.findings.some((f) => /words long/i.test(f.message)));
});

/* ------------------------------------------------------------ sequences --- */

const emailStep = (over = {}) => ({
  id: 's1', kind: 'email', subject: 'Hello', design: { blocks: [{ id: 'b1', type: 'text', text: 'Hi there' }] },
  wait_minutes: 0, on_fail: 'continue', ...over,
});
const waitStep = (over = {}) => ({ id: 'w1', kind: 'wait', wait_minutes: 1440, on_fail: 'continue', ...over });

test('a sequence with an email and a wait is allowed to run', () => {
  const problems = automations.sequenceProblems([emailStep(), waitStep(), emailStep({ id: 's2' })]);
  assert.deepEqual(problems, []);
});

test('an empty sequence, or one that sends nothing, is refused', () => {
  assert.ok(automations.sequenceProblems([]).length);
  assert.ok(automations.sequenceProblems([waitStep()]).some((p) => /sends no email/i.test(p.message)));
});

test('two emails with no wait between them are refused', () => {
  const problems = automations.sequenceProblems([emailStep(), emailStep({ id: 's2' })]);
  assert.ok(problems.some((p) => /no wait between/i.test(p.message)));
});

test('an email with no subject or no content is refused', () => {
  assert.ok(automations.sequenceProblems([emailStep({ subject: '  ' })]).some((p) => /no subject/i.test(p.message)));
  assert.ok(automations.sequenceProblems([emailStep({ design: { blocks: [] } })]).some((p) => /empty/i.test(p.message)));
});

test('a condition about the last email must come after one', () => {
  const first = automations.sequenceProblems([
    { id: 'c1', kind: 'condition', condition_type: 'opened_previous', on_fail: 'exit', wait_minutes: 0 },
    emailStep(),
  ]);
  assert.ok(first.some((p) => /no earlier email/i.test(p.message)));

  const ordered = automations.sequenceProblems([
    emailStep(), waitStep(),
    { id: 'c1', kind: 'condition', condition_type: 'opened_previous', on_fail: 'exit', wait_minutes: 0 },
    emailStep({ id: 's2' }),
  ]);
  assert.deepEqual(ordered, []);
});

/* ------------------------------------------------------- saving a step --- */

test('a step keeps only the fields belonging to its kind', () => {
  const saved = automations.sanitizeStep(
    { kind: 'wait', subject: 'leftover subject', wait_minutes: 90, condition_type: 'has_ordered' },
    3
  );
  assert.equal(saved.kind, 'wait');
  assert.equal(saved.position, 3);
  assert.equal(saved.subject, null, 'a wait cannot carry a subject line');
  assert.equal(saved.condition_type, null);
  assert.equal(saved.wait_minutes, 90);
});

test('an unknown kind, condition or failure branch falls back to something safe', () => {
  const saved = automations.sanitizeStep({ kind: 'delete_everything', on_fail: 'launch_missiles' }, 0);
  assert.equal(saved.kind, 'email');
  assert.equal(saved.on_fail, 'continue');
});

test('a wait is clamped to a year and never goes negative', () => {
  assert.equal(automations.clampWait(-50), 0);
  assert.equal(automations.clampWait(99_999_999), automations.MAX_WAIT_MINUTES);
  assert.equal(automations.clampWait('not a number'), 0);
});

test('waits are shown back in the unit they were entered in', () => {
  assert.deepEqual(automations.splitWait(1440), { value: 1, unit: 'days' });
  assert.deepEqual(automations.splitWait(120), { value: 2, unit: 'hours' });
  assert.deepEqual(automations.splitWait(45), { value: 45, unit: 'minutes' });
});

test('the trigger config only accepts sensible numbers', () => {
  assert.deepEqual(automations.sanitizeTriggerConfig({ cartAgeHours: 0 }), { cartAgeHours: 1 });
  assert.deepEqual(automations.sanitizeTriggerConfig({ cartAgeHours: 9999 }), { cartAgeHours: 168 });
  assert.deepEqual(automations.sanitizeTriggerConfig({ minOrderTotal: -5 }), {});
  assert.deepEqual(automations.sanitizeTriggerConfig('nonsense'), {});
});

test('only the listed triggers are accepted', () => {
  assert.equal(automations.isTrigger('abandoned_cart'), true);
  assert.equal(automations.isTrigger('manual'), true);
  assert.equal(automations.isTrigger('run_arbitrary_code'), false);
});
