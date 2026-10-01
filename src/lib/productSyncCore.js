const { createHmac, timingSafeEqual } = require('node:crypto');

const AVAILABILITIES = new Set(['in_stock', 'out_of_stock', 'discontinued']);

class FeedValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FeedValidationError';
  }
}

const stringValue = (value, max, required = false) => {
  if (value === null || value === undefined) return required ? null : null;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return required ? null : null;
  return text.slice(0, max);
};

const nullableNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

const nullableHttpsUrl = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
};

function slugifyProduct(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function normalizeSourceProduct(input) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: ['Product is not an object.'] };
  }

  const id = stringValue(input.id, 200, true);
  const name = stringValue(input.name, 300, true);
  const category = stringValue(input.category, 160, true);
  const priceUsd = nullableNumber(input.priceUsd);
  const priceCrc = nullableNumber(input.priceCrc);
  const compareAtPriceUsd = nullableNumber(input.compareAtPriceUsd);
  const inventoryCount = nullableNumber(input.inventoryCount);
  const imageUrl = nullableHttpsUrl(input.imageUrl);
  const productUrl = nullableHttpsUrl(input.productUrl);
  const coaUrl = nullableHttpsUrl(input.coaUrl);
  const availability = stringValue(input.availability, 40, true);
  const updated = typeof input.updatedAt === 'string' ? new Date(input.updatedAt) : null;

  if (!id) errors.push('id is required.');
  if (!name) errors.push('name is required.');
  if (!category) errors.push('category is required.');
  if (priceUsd === undefined || priceUsd === null || priceUsd < 0) errors.push('priceUsd must be a non-negative number.');
  if (priceCrc === undefined || (priceCrc !== null && priceCrc < 0)) errors.push('priceCrc must be null or a non-negative number.');
  if (compareAtPriceUsd === undefined || (compareAtPriceUsd !== null && compareAtPriceUsd < 0)) errors.push('compareAtPriceUsd must be null or a non-negative number.');
  if (inventoryCount === undefined || (inventoryCount !== null && (!Number.isInteger(inventoryCount) || inventoryCount < 0))) {
    errors.push('inventoryCount must be null or a non-negative integer.');
  }
  if (!availability || !AVAILABILITIES.has(availability)) errors.push('availability is invalid.');
  if (input.productUrl != null && productUrl === undefined) errors.push('productUrl must be null or an HTTPS URL.');
  if (!updated || Number.isNaN(updated.getTime())) errors.push('updatedAt must be a valid timestamp.');

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    value: {
      id,
      sku: stringValue(input.sku, 120),
      name,
      category,
      descriptionEn: typeof input.descriptionEn === 'string' ? input.descriptionEn.slice(0, 50000) : '',
      descriptionEs: typeof input.descriptionEs === 'string' ? input.descriptionEs.slice(0, 50000) : '',
      imageUrl: imageUrl === undefined ? null : imageUrl,
      productUrl,
      priceUsd: Math.round(priceUsd * 100) / 100,
      priceCrc: priceCrc === null ? null : Math.round(priceCrc * 100) / 100,
      priceBasis: stringValue(input.priceBasis, 100),
      compareAtPriceUsd: compareAtPriceUsd === null ? null : Math.round(compareAtPriceUsd * 100) / 100,
      discountLabel: stringValue(input.discountLabel, 200),
      availability,
      inventoryCount,
      coaUrl: coaUrl === undefined ? null : coaUrl,
      updatedAt: updated.toISOString(),
    },
  };
}

function parseFeed(rawBody) {
  let parsed;
  try {
    parsed = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody));
  } catch {
    throw new FeedValidationError('Partner feed did not contain valid JSON.');
  }

  const products = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.products)
      ? parsed.products
      : Array.isArray(parsed?.data)
        ? parsed.data
        : null;
  if (!products) throw new FeedValidationError('Partner feed did not contain a product array.');

  const normalized = [];
  const invalid = [];
  products.forEach((product, index) => {
    const result = normalizeSourceProduct(product);
    if (result.ok) normalized.push(result.value);
    else invalid.push({ index, errors: result.errors });
  });
  if (invalid.length) {
    throw new FeedValidationError(`${invalid.length} partner product record(s) failed validation.`);
  }

  const meta = !Array.isArray(parsed) && parsed.meta && typeof parsed.meta === 'object' && !Array.isArray(parsed.meta)
    ? parsed.meta
    : {};
  return { products: normalized, meta };
}

function priceMirror(product) {
  if (product.compareAtPriceUsd !== null && product.compareAtPriceUsd > product.priceUsd) {
    return { price: product.compareAtPriceUsd, sale_price: product.priceUsd };
  }
  return { price: product.priceUsd, sale_price: null };
}

function productIdentity(source, externalId) {
  return `${source}:${externalId}`;
}

function buildProductColumns(product, options = {}) {
  const now = options.now ?? new Date().toISOString();
  const columns = {
    external_source: options.source ?? 'peptides_costa_rica',
    external_product_id: product.id,
    external_product_url: product.productUrl,
    external_updated_at: product.updatedAt,
    external_availability: product.availability,
    last_synced_at: now,
    sku: product.sku,
    name: product.name,
    category: product.category,
    category_slug: slugifyProduct(product.category),
    description: product.descriptionEn,
    in_stock: product.availability === 'in_stock',
    is_active: true,
    ...priceMirror(product),
  };
  if (product.inventoryCount !== null) columns.stock_count = product.inventoryCount;
  else if (options.isNew) columns.stock_count = 0;
  return columns;
}

function buildTranslations(product, productId, now = new Date().toISOString()) {
  return [
    { product_id: productId, locale: 'en', name: product.name, description: product.descriptionEn, updated_at: now },
    { product_id: productId, locale: 'es', name: product.name, description: product.descriptionEs, updated_at: now },
  ];
}

function buildPrices(product, productId) {
  const common = {
    product_id: productId,
    price_basis: product.priceBasis,
    discount_label: product.discountLabel,
    external_updated_at: product.updatedAt,
  };
  const rows = [{ ...common, currency: 'USD', price: product.priceUsd, compare_at_price: product.compareAtPriceUsd }];
  if (product.priceCrc !== null) rows.push({ ...common, currency: 'CRC', price: product.priceCrc, compare_at_price: null });
  return rows;
}

function signatureBytes(signature) {
  const clean = String(signature ?? '').trim().replace(/^sha256=/i, '');
  if (/^[a-f0-9]{64}$/i.test(clean)) return Buffer.from(clean, 'hex');
  try {
    const decoded = Buffer.from(clean, 'base64');
    return decoded.length === 32 ? decoded : null;
  } catch {
    return null;
  }
}

function verifyFeedSignature({ rawBody, timestamp, signature, signed, secret, now = Date.now() }) {
  if (!secret) throw new FeedValidationError('Partner feed signing secret is not configured.');
  if (!['1', 'true', 'yes'].includes(String(signed ?? '').toLowerCase())) {
    throw new FeedValidationError('Partner feed was not marked as signed.');
  }

  const numeric = Number(timestamp);
  const timestampMs = Number.isFinite(numeric)
    ? (numeric > 1e12 ? numeric : numeric * 1000)
    : Date.parse(String(timestamp ?? ''));
  if (!Number.isFinite(timestampMs) || Math.abs(now - timestampMs) > 300000) {
    throw new FeedValidationError('Partner feed signature timestamp is outside the allowed window.');
  }

  const provided = signatureBytes(signature);
  if (!provided) throw new FeedValidationError('Partner feed signature has an invalid format.');
  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.`)
    .update(Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody))
    .digest();
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new FeedValidationError('Partner feed signature is invalid.');
  }
  return true;
}

function isSafeFullResponse({ mode, requestWasFiltered, meta, receivedCount, errorsCount }) {
  // An empty response is never allowed to hide the entire catalogue, even if
  // its metadata claims completeness. A deliberate empty catalogue needs a
  // separate, human-approved operation.
  if (mode !== 'full' || requestWasFiltered || errorsCount > 0 || receivedCount === 0) return false;
  if (meta?.hasMore === true || meta?.has_more === true) return false;
  if (meta?.nextCursor || meta?.next_cursor || meta?.nextPage || meta?.next_page) return false;
  if (meta?.filtered === true || meta?.isFiltered === true) return false;

  const total = Number(meta?.total ?? meta?.totalCount ?? meta?.total_count);
  const explicitlyComplete = meta?.complete === true || meta?.isComplete === true || meta?.is_complete === true;
  const terminalPage = meta?.hasMore === false || meta?.has_more === false;
  const matchingTotal = Number.isFinite(total) && total === receivedCount;
  return explicitlyComplete || terminalPage || matchingTotal;
}

function classifyFeedResponse(status) {
  if (status === 304) return 'not_modified';
  if (status >= 200 && status < 300) return 'body';
  return 'error';
}

function sanitizeSyncError(error) {
  const message = error instanceof Error ? error.message : String(error ?? 'Unknown synchronization failure.');
  return message
    .replace(/Bearer\s+[^\s]+/gi, 'Bearer [redacted]')
    .replace(/([?&](?:token|key|secret|signature)=)[^&\s]+/gi, '$1[redacted]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 500);
}

module.exports = {
  FeedValidationError,
  buildPrices,
  buildProductColumns,
  buildTranslations,
  classifyFeedResponse,
  isSafeFullResponse,
  normalizeSourceProduct,
  parseFeed,
  priceMirror,
  productIdentity,
  sanitizeSyncError,
  slugifyProduct,
  verifyFeedSignature,
};
