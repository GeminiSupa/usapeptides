import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
function worker({ offline = false, status = 200 } = {}) {
  const handlers = {};
  const stored = [];
  const deleted = [];
  const fallback = new Response('Offline page');
  const context = {
    URL, Request, Response,
    self: { location: { origin: 'https://store.test' }, clients: { claim: async () => {} },
      addEventListener: (name, handler) => { handlers[name] = handler; } },
    caches: {
      open: async () => ({ add: async (req) => stored.push(req.url), match: async () => fallback }),
      keys: async () => ['storefront-offline-v0', 'storefront-offline-v1', 'unrelated-cache'],
      delete: async (key) => deleted.push(key),
    },
    fetch: async () => { if (offline) throw new TypeError('Offline'); return new Response('Network', { status }); },
  };
  // Node requires an absolute Request URL; browsers resolve against worker origin.
  context.Request = class extends Request { constructor(url, opts) { super(new URL(url, 'https://store.test'), opts); } };
  vm.runInNewContext(source, context);
  return { handlers, stored, deleted };
}
function navigate(handlers, overrides = {}) {
  let response;
  handlers.fetch({ request: { url: 'https://store.test/shop', method: 'GET', mode: 'navigate', ...overrides },
    respondWith: (promise) => { response = promise; } });
  return response;
}

test('installation caches only the generic offline document', async () => {
  const w = worker(); let pending;
  w.handlers.install({ waitUntil: (p) => { pending = p; } }); await pending;
  assert.deepEqual(w.stored, ['https://store.test/offline.html']);
});
test('activation removes only obsolete caches owned by this worker', async () => {
  const w = worker(); let pending;
  w.handlers.activate({ waitUntil: (p) => { pending = p; } }); await pending;
  assert.deepEqual(w.deleted, ['storefront-offline-v0']);
});
test('online navigation uses fresh network data, including server errors', async () => {
  for (const status of [200, 401, 500]) {
    const response = await navigate(worker({ status }).handlers);
    assert.equal(response.status, status);
    assert.equal(await response.text(), 'Network');
  }
});
test('offline navigation returns the generic fallback, including private pages', async () => {
  for (const path of ['/shop', '/checkout', '/my-account', '/admin', '/order-received']) {
    const response = await navigate(worker({ offline: true }).handlers, { url: `https://store.test${path}` });
    assert.equal(await response.text(), 'Offline page');
  }
});
test('API, POST, RSC, assets and other origins are never intercepted', () => {
  const { handlers } = worker({ offline: true });
  for (const request of [
    { url: 'https://store.test/api/orders' }, { method: 'POST' },
    { mode: 'cors' }, { url: 'https://store.test/_next/static/app.js', mode: 'no-cors' },
    { url: 'https://other.test/shop' },
  ]) assert.equal(navigate(handlers, request), undefined);
});
