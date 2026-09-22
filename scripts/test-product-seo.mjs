import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the server page with database records deliberately different from
// bundled content. No database or customer records are changed.
function load(path, imports) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${compiled}\n})`, {})((name) => {
    if (!(name in imports)) throw new Error(`Unexpected import ${name}`);
    return imports[name];
  }, module, module.exports);
  return module.exports;
}
function page(rows) {
  const bundled = [{ slug: 'sample', name: 'Old name', price: 25 }];
  const mapper = load('../src/lib/catalogue.ts', { '@/data/products': { products: bundled } });
  const element = (type, props) => ({ type, props });
  return load('../src/app/product/[slug]/page.tsx', {
    'react': { cache: (fn) => fn },
    'react/jsx-runtime': { jsx: element, jsxs: element, Fragment: 'fragment' },
    'next/navigation': { notFound: () => { throw new Error('NOT_FOUND'); } },
    '@/data/products': { products: bundled },
    '@/lib/catalogue': mapper,
    '@/lib/siteContentServer': { publicRest: async (query) => {
      assert.ok(query.includes('is_active=eq.true'));
      return rows;
    } },
    '@/lib/seo': { siteUrl: () => 'https://example.test', jsonLd: (data) => ({ __html: JSON.stringify(data) }) },
    '@/lib/env': { BUSINESS: { name: 'Test Store', currency: 'USD' } },
    './ProductDetailClient': { __esModule: true, default: 'product-client' },
  });
}
const params = { params: Promise.resolve({ slug: 'sample' }) };
test('database name/price and stock drive metadata, HTML seed and schema together', async () => {
  const p = page([{ id: 'p1', slug: 'sample', name: 'Current database name', price: 79, sale_price: 12,
    in_stock: true, stock_count: 0, description: 'Current description', is_active: true }]);
  const metadata = await p.generateMetadata(params);
  assert.equal(metadata.title, 'Current database name');
  const tree = await p.default(params);
  const [script, client] = tree.props.children;
  const schema = JSON.parse(script.props.dangerouslySetInnerHTML.__html);
  assert.equal(client.props.initialProduct.name, metadata.title);
  assert.equal(schema.offers.price, client.props.initialProduct.price.toFixed(2));
  assert.equal(schema.offers.availability, 'https://schema.org/OutOfStock');
});
test('successful empty database lookup cannot revive a bundled product', async () => {
  await assert.rejects(page([]).default(params), /NOT_FOUND/);
});
test('bundled fallback remains available when the database is unavailable', async () => {
  const p = page(null);
  assert.equal((await p.generateMetadata(params)).title, 'Old name');
});
