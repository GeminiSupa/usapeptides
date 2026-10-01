const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./loadTs.cjs');

const { parseLeadIntake, secretMatches, siteHost } = loadTs('src/lib/leadIntake.ts');

describe('site host', () => {
  it('keeps the domain and drops the path', () => {
    assert.equal(siteHost('https://Shop.Example.com/contact'), 'shop.example.com');
    assert.equal(siteHost('miami-peptides.com'), 'miami-peptides.com');
  });

  it('rejects a value that is not a domain', () => {
    assert.equal(siteHost('not a domain'), null);
    assert.equal(siteHost('localhost'), null);
    assert.equal(siteHost(''), null);
  });
});

describe('lead form', () => {
  it('accepts a form with an email and records the site', () => {
    const parsed = parseLeadIntake({
      site: 'https://local-peptides.example/quote',
      name: 'Jane Smith',
      email: 'Jane@Lab.edu',
      message: 'Asking about a research peptide.',
    });
    assert.equal(parsed.ok, true);
    assert.equal(parsed.value.site, 'local-peptides.example');
    assert.equal(parsed.value.email, 'jane@lab.edu');
    assert.equal(parsed.value.name, 'Jane Smith');
  });

  it('accepts a phone when there is no email', () => {
    const parsed = parseLeadIntake({ site: 'shop.example.com', phone: '831-471-5559' });
    assert.equal(parsed.ok, true);
    assert.equal(parsed.value.email, null);
    assert.equal(parsed.value.phone, '831-471-5559');
  });

  it('refuses a form with no way to reply', () => {
    const parsed = parseLeadIntake({ site: 'shop.example.com', name: 'Jane Smith' });
    assert.equal(parsed.ok, false);
    assert.match(parsed.fields.email, /email address or a phone/);
  });

  it('refuses a missing site', () => {
    const parsed = parseLeadIntake({ email: 'jane@lab.edu' });
    assert.equal(parsed.ok, false);
    assert.ok(parsed.fields.site);
  });
});

describe('intake secret', () => {
  it('matches only the same secret', () => {
    assert.equal(secretMatches('a-long-shared-secret', 'a-long-shared-secret'), true);
    assert.equal(secretMatches('a-long-shared-secret', 'a-long-shared-secreT'), false);
    assert.equal(secretMatches('short', 'a-long-shared-secret'), false);
  });
});
