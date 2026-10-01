const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const test = require('node:test');
const core = require('../src/lib/productSyncCore.js');

const source = (overrides = {}) => ({
  id: 'stable-101',
  sku: 'PCR-OLD',
  name: 'Example Peptide 10mg',
  category: 'Example Category',
  descriptionEn: '**English** description',
  descriptionEs: '**Descripción** española',
  imageUrl: 'https://catalog.peptidescostarica.net/media/product.jpg',
  productUrl: 'https://catalog.peptidescostarica.net/product/example',
  priceUsd: 80,
  priceCrc: 40800,
  priceBasis: 'per vial',
  compareAtPriceUsd: null,
  discountLabel: null,
  availability: 'in_stock',
  inventoryCount: 12,
  coaUrl: 'https://catalog.peptidescostarica.net/media/coa.pdf',
  updatedAt: '2026-09-22T12:00:00.000Z',
  ...overrides,
});

test('new product creation maps only source-owned product columns', () => {
  const parsed = core.normalizeSourceProduct(source());
  assert.equal(parsed.ok, true);
  const row = core.buildProductColumns(parsed.value, { isNew: true, now: '2026-09-22T12:01:00.000Z' });
  assert.equal(row.external_product_id, 'stable-101');
  assert.equal(row.price, 80);
  assert.equal(row.stock_count, 12);
  for (const local of ['purity', 'sequence', 'cas_number', 'molar_mass', 'formula', 'storage', 'appearance', 'tags', 'is_featured', 'is_popular', 'details', 'specs']) {
    assert.equal(Object.hasOwn(row, local), false, `${local} must remain locally owned`);
  }
});

test('repeat synchronization keeps the same external identity', () => {
  assert.equal(core.productIdentity('peptides_costa_rica', source().id), 'peptides_costa_rica:stable-101');
  assert.deepEqual(
    core.buildProductColumns(source(), { isNew: false, now: 'same' }),
    core.buildProductColumns(source(), { isNew: false, now: 'same' })
  );
});

test('SKU rename does not change synchronization identity', () => {
  const before = source();
  const after = source({ sku: 'PCR-RENAMED' });
  assert.equal(core.productIdentity('peptides_costa_rica', before.id), core.productIdentity('peptides_costa_rica', after.id));
  assert.equal(core.buildProductColumns(after).sku, 'PCR-RENAMED');
});

test('sale price mirror uses compare-at as regular price', () => {
  assert.deepEqual(core.priceMirror(source({ priceUsd: 80, compareAtPriceUsd: 100 })), { price: 100, sale_price: 80 });
  assert.deepEqual(core.priceMirror(source({ priceUsd: 80, compareAtPriceUsd: 70 })), { price: 80, sale_price: null });
});

test('null inventory preserves existing stock and uses safe default for new rows', () => {
  const product = source({ inventoryCount: null, availability: 'in_stock' });
  assert.equal(Object.hasOwn(core.buildProductColumns(product, { isNew: false }), 'stock_count'), false);
  assert.equal(core.buildProductColumns(product, { isNew: true }).stock_count, 0);
  assert.equal(core.buildProductColumns(product, { isNew: true }).in_stock, true);
});

test('availability mapping is authoritative', () => {
  assert.equal(core.buildProductColumns(source({ availability: 'in_stock', inventoryCount: 0 })).in_stock, true);
  assert.equal(core.buildProductColumns(source({ availability: 'out_of_stock', inventoryCount: 12 })).in_stock, false);
  assert.equal(core.buildProductColumns(source({ availability: 'discontinued' })).in_stock, false);
});

test('category changes update primary denormalized fields', () => {
  const row = core.buildProductColumns(source({ category: 'New Category' }));
  assert.equal(row.category, 'New Category');
  assert.equal(row.category_slug, 'new-category');
});

test('Spanish and English translations are emitted', () => {
  const rows = core.buildTranslations(source(), '00000000-0000-0000-0000-000000000001', 'now');
  assert.deepEqual(rows.map((row) => row.locale), ['en', 'es']);
  assert.match(rows[1].description, /Descripción/);
});

test('source images and COAs are deliberately ignored', () => {
  const columns = core.buildProductColumns(source());
  assert.equal(Object.hasOwn(columns, 'image'), false);
  assert.equal(Object.hasOwn(columns, 'coa_url'), false);
  assert.equal(Object.hasOwn(columns, 'coa'), false);
});

test('invalid feed records reject the whole response', () => {
  assert.throws(() => core.parseFeed(JSON.stringify({ products: [{ id: 'bad' }], meta: {} })), /failed validation/);
});

test('raw response signature is verified without reserializing JSON', () => {
  const rawBody = Buffer.from('{"products":[]}');
  const timestamp = '1790080000';
  const secret = 'test-only-secret';
  const signature = createHmac('sha256', secret).update(`${timestamp}.`).update(rawBody).digest('hex');
  assert.equal(core.verifyFeedSignature({ rawBody, timestamp, signature, signed: 'true', secret, now: Number(timestamp) * 1000 }), true);
  assert.throws(() => core.verifyFeedSignature({ rawBody: Buffer.from('{ "products": [] }'), timestamp, signature, signed: 'true', secret, now: Number(timestamp) * 1000 }), /invalid/);
});

test('304 is a successful no-write response', () => {
  assert.equal(core.classifyFeedResponse(304), 'not_modified');
});

test('failed or incomplete full sync cannot deactivate products', () => {
  const complete = { total: 73, hasMore: false };
  assert.equal(core.isSafeFullResponse({ mode: 'full', requestWasFiltered: false, meta: complete, receivedCount: 73, errorsCount: 1 }), false);
  assert.equal(core.isSafeFullResponse({ mode: 'incremental', requestWasFiltered: true, meta: complete, receivedCount: 73, errorsCount: 0 }), false);
  assert.equal(core.isSafeFullResponse({ mode: 'full', requestWasFiltered: false, meta: { hasMore: true }, receivedCount: 73, errorsCount: 0 }), false);
  assert.equal(core.isSafeFullResponse({ mode: 'full', requestWasFiltered: false, meta: { total: 0, hasMore: false }, receivedCount: 0, errorsCount: 0 }), false);
});

test('successful complete full sync may reconcile missing products', () => {
  assert.equal(core.isSafeFullResponse({ mode: 'full', requestWasFiltered: false, meta: { total: 73, hasMore: false }, receivedCount: 73, errorsCount: 0 }), true);
});

test('USD and CRC price rows retain source price metadata', () => {
  const rows = core.buildPrices(source({ compareAtPriceUsd: 100, discountLabel: '20% off' }), 'product-id');
  assert.deepEqual(rows.map((row) => row.currency), ['USD', 'CRC']);
  assert.equal(rows[0].compare_at_price, 100);
  assert.equal(rows[0].discount_label, '20% off');
  assert.equal(rows[1].price, 40800);
});
