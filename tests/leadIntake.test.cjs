const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./loadTs.cjs');

const {
  parseIntake, buildNotes, matchChoice, originAllowed, hostOf,
  INTEREST_OPTIONS, GOAL_OPTIONS,
} = loadTs('src/lib/leadIntake.ts');
const { siteHost } = loadTs('src/lib/partnerLead.ts');

/** A submission exactly as the documented form sends one. */
const submission = () => ({
  full_name: 'Jane Doe',
  email: 'Jane@Example.com ',
  phone: '(405) 555-0134',
  interest: 'weight_management',
  goal: 'body_composition',
  message: 'Do you ship to Oklahoma?',
  lead_source: 'peptidesoklahomacity.com',
  tracking_phone: '405-555-0100',
  page_url: 'https://peptidesoklahomacity.com/contact',
  utm_source: 'google',
  utm_campaign: 'okc-weight',
  company: '',
  ts: Date.now() - 20_000,
});

describe('a documented submission', () => {
  it('is accepted, with the email normalised', () => {
    const result = parseIntake(submission(), 'fallback');
    assert.ok(result.lead, JSON.stringify(result.fields));
    assert.equal(result.lead.email, 'jane@example.com');
    assert.equal(result.lead.phone, '(405) 555-0134');
    assert.equal(result.lead.interest, 'weight_management');
    assert.equal(result.lead.goal, 'body_composition');
  });

  it('keeps the campaign details the form collected', () => {
    const { lead } = parseIntake(submission(), 'fallback');
    assert.equal(lead.meta.utm_source, 'google');
    assert.equal(lead.meta.utm_campaign, 'okc-weight');
    assert.equal(lead.meta.page_url, 'https://peptidesoklahomacity.com/contact');
  });

  it('falls back to the site label when the hidden field is missing', () => {
    const { lead } = parseIntake({ ...submission(), lead_source: '' }, 'Oklahoma City');
    assert.equal(lead.lead_source, 'Oklahoma City');
  });

  it('caps an oversized message instead of refusing the lead', () => {
    const { lead } = parseIntake({ ...submission(), message: 'x'.repeat(9000) }, 'f');
    assert.equal(lead.message.length, 5000);
  });
});

describe('validation', () => {
  it('names every field the visitor has to fix', () => {
    const result = parseIntake(
      { ...submission(), email: 'nope', phone: '', interest: '', goal: '' }, 'f'
    );
    assert.ok(result.fields);
    assert.deepEqual(Object.keys(result.fields).sort(), ['email', 'goal', 'interest', 'phone']);
  });

  it('requires a name that looks like a name', () => {
    const result = parseIntake({ ...submission(), full_name: '.' }, 'f');
    assert.equal(Object.keys(result.fields)[0], 'full_name');
  });

  it('requires a phone number, unlike the storefront contact form', () => {
    const result = parseIntake({ ...submission(), phone: '' }, 'f');
    assert.match(result.fields.phone, /required/i);
  });
});

describe('spam defences', () => {
  it('drops a submission with anything in the honeypot', () => {
    assert.equal(parseIntake({ ...submission(), company: 'Acme' }, 'f').silentlyDrop, true);
  });

  it('drops one sent too soon after the page loaded', () => {
    assert.equal(parseIntake({ ...submission(), ts: Date.now() - 100 }, 'f').silentlyDrop, true);
  });

  it('drops one carrying a forged future timestamp', () => {
    assert.equal(parseIntake({ ...submission(), ts: Date.now() + 60_000 }, 'f').silentlyDrop, true);
  });

  it('accepts one a real person could have filled in', () => {
    assert.ok(parseIntake({ ...submission(), ts: Date.now() - 4_000 }, 'f').lead);
  });
});

describe('the dropdowns', () => {
  it('accepts the label as well as the value', () => {
    assert.equal(matchChoice('Hair & scalp', INTEREST_OPTIONS).slug, 'hair_scalp');
    assert.equal(matchChoice('Healthy aging', GOAL_OPTIONS).slug, 'healthy_aging');
  });

  it('keeps an unknown answer as other, with the text', () => {
    const odd = matchChoice('Peptide stacking advice', INTEREST_OPTIONS);
    assert.equal(odd.slug, 'other');
    assert.equal(odd.raw, 'Peptide stacking advice');
  });
});

describe('what the salesperson reads', () => {
  it('spells out both answers, the site and the campaign', () => {
    const notes = buildNotes(parseIntake(submission(), 'f').lead);
    assert.match(notes, /Interested in: Weight management/);
    assert.match(notes, /Primary goal: Body composition/);
    assert.match(notes, /From: peptidesoklahomacity\.com/);
    assert.match(notes, /called number 405-555-0100/);
    assert.match(notes, /Do you ship to Oklahoma\?/);
    assert.match(notes, /Campaign: source=google/);
  });

  it('shows what somebody typed when they chose Other', () => {
    const { lead } = parseIntake({ ...submission(), interest: 'Peptide stacking advice' }, 'f');
    assert.match(buildNotes(lead), /Interested in: Other \(Peptide stacking advice\)/);
  });
});

describe('the domain allow-list', () => {
  const domains = 'peptidesoklahomacity.com, peptidestulsa.com';

  it('allows the registered domain and its subdomains', () => {
    assert.equal(originAllowed(domains, 'https://peptidesoklahomacity.com'), true);
    assert.equal(originAllowed(domains, 'https://www.peptidesoklahomacity.com'), true);
    assert.equal(originAllowed(domains, 'https://go.peptidesoklahomacity.com'), true);
    assert.equal(originAllowed(domains, 'https://peptidestulsa.com/contact'), true);
  });

  it('refuses a lookalike domain', () => {
    assert.equal(originAllowed(domains, 'https://notpeptidesoklahomacity.com'), false);
    assert.equal(originAllowed(domains, 'https://peptidesoklahomacity.com.evil.net'), false);
  });

  it('refuses a missing origin and an empty list', () => {
    assert.equal(originAllowed(domains, null), false);
    assert.equal(originAllowed('', 'https://peptidesoklahomacity.com'), false);
  });

  it('reads the host out of a full URL', () => {
    assert.equal(hostOf('https://WWW.Example.com/x?y=1'), 'example.com');
    assert.equal(hostOf('not a url'), '');
  });
});

describe('site host, used by this site own contact form', () => {
  it('keeps the domain and drops the path', () => {
    assert.equal(siteHost('https://Shop.Example.com/contact'), 'shop.example.com');
    assert.equal(siteHost('miami-peptides.com'), 'miami-peptides.com');
  });

  it('rejects a value that is not a domain', () => {
    assert.equal(siteHost('not a domain'), null);
    assert.equal(siteHost('localhost'), null);
  });
});
