import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from './supabaseAdmin';
import {
  buildPrices,
  buildProductColumns,
  buildTranslations,
  classifyFeedResponse,
  isSafeFullResponse,
  parseFeed,
  sanitizeSyncError,
  slugifyProduct,
  verifyFeedSignature,
  type SourceProduct,
} from './productSyncCore.js';

export const PRODUCT_SYNC_SOURCE = 'peptides_costa_rica';
const FEED_URL = 'https://catalog.peptidescostarica.net/api/partner/products';
const FEED_LIMIT = 500;
const MAX_FEED_BYTES = 10 * 1024 * 1024;
const STALE_RUN_MINUTES = 30;

export type ProductSyncMode = 'incremental' | 'full';

export interface ProductSyncResult {
  status: 'succeeded' | 'no_change' | 'failed' | 'busy';
  mode: ProductSyncMode;
  productsReceived: number;
  productsCreated: number;
  productsUpdated: number;
  productsDeactivated: number;
  errorsCount: number;
  message?: string;
}

type DbRow = Record<string, any>;

interface RunState {
  id: string;
  productsReceived: number;
  productsCreated: number;
  productsUpdated: number;
  productsDeactivated: number;
  errors: string[];
  responseEtag: string | null;
  incrementalSupported: boolean | null;
}

const emptyResult = (mode: ProductSyncMode, status: ProductSyncResult['status'], message?: string): ProductSyncResult => ({
  status,
  mode,
  productsReceived: 0,
  productsCreated: 0,
  productsUpdated: 0,
  productsDeactivated: 0,
  errorsCount: status === 'failed' ? 1 : 0,
  ...(message ? { message } : {}),
});

const chunks = <T,>(values: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
};

async function readLimitedBody(response: Response, maximum: number): Promise<Buffer> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maximum) throw new Error('Partner response exceeded the allowed size.');
  if (!response.body) return Buffer.alloc(0);

  const reader = response.body.getReader();
  const pieces: Buffer[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maximum) {
      await reader.cancel();
      throw new Error('Partner response exceeded the allowed size.');
    }
    pieces.push(Buffer.from(value));
  }
  return Buffer.concat(pieces, length);
}

async function loadAll(db: SupabaseClient, table: string, select: string): Promise<DbRow[]> {
  const rows: DbRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(select).range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as DbRow[]));
    if (!data || data.length < 1000) return rows;
  }
}

async function beginRun(db: SupabaseClient, mode: ProductSyncMode): Promise<string | null> {
  const staleBefore = new Date(Date.now() - STALE_RUN_MINUTES * 60000).toISOString();
  await db
    .from('product_sync_runs')
    .update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      errors_count: 1,
      sanitized_error_summary: 'Previous synchronization exceeded its execution lease.',
    })
    .eq('source', PRODUCT_SYNC_SOURCE)
    .eq('status', 'running')
    .lt('started_at', staleBefore);

  const { data, error } = await db
    .from('product_sync_runs')
    .insert({ source: PRODUCT_SYNC_SOURCE, mode, status: 'running' })
    .select('id')
    .single();
  if (error?.code === '23505') return null;
  if (error) {
    if (/product_sync_runs|schema cache|does not exist/i.test(error.message)) {
      throw new Error('Run migration 0022_product_partner_sync.sql before enabling product synchronization.');
    }
    throw new Error(error.message);
  }
  return data.id;
}

async function completeRun(db: SupabaseClient, run: RunState, status: 'succeeded' | 'no_change' | 'failed'): Promise<void> {
  const summary = run.errors.length ? Array.from(new Set(run.errors)).slice(0, 8).join(' | ').slice(0, 2000) : null;
  const { error } = await db.from('product_sync_runs').update({
    completed_at: new Date().toISOString(),
    status,
    products_received: run.productsReceived,
    products_created: run.productsCreated,
    products_updated: run.productsUpdated,
    products_deactivated: run.productsDeactivated,
    errors_count: run.errors.length,
    sanitized_error_summary: summary,
    response_etag: run.responseEtag,
    incremental_supported: run.incrementalSupported,
  }).eq('id', run.id);
  if (error) throw new Error(`Could not finish synchronization audit record: ${error.message}`);
}

async function latestSuccessfulRun(db: SupabaseClient, mode: ProductSyncMode): Promise<DbRow | null> {
  const { data, error } = await db
    .from('product_sync_runs')
    .select('completed_at, response_etag, incremental_supported')
    .eq('source', PRODUCT_SYNC_SOURCE)
    .eq('mode', mode)
    .in('status', ['succeeded', 'no_change'])
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function ensureCategories(db: SupabaseClient, products: SourceProduct[]): Promise<Map<string, { name: string; slug: string }>> {
  const existing = await loadAll(db, 'product_categories', 'id, name, slug');
  const byName = new Map(existing.map((row) => [String(row.name).toLowerCase(), row]));
  const bySlug = new Map(existing.map((row) => [String(row.slug).toLowerCase(), row]));
  const result = new Map<string, { name: string; slug: string }>();

  for (const sourceName of Array.from(new Set(products.map((product) => product.category)))) {
    const key = sourceName.toLowerCase();
    const wantedSlug = slugifyProduct(sourceName);
    let category = byName.get(key) ?? bySlug.get(wantedSlug);
    if (!category) {
      const { data, error } = await db
        .from('product_categories')
        .insert({ name: sourceName, slug: wantedSlug, sort_order: 1000 })
        .select('id, name, slug')
        .single();
      if (error) throw new Error(`Could not create category: ${error.message}`);
      category = data;
      byName.set(String(category.name).toLowerCase(), category);
      bySlug.set(String(category.slug).toLowerCase(), category);
    }
    result.set(key, { name: String(category.name), slug: String(category.slug) });
  }
  return result;
}

async function getPartnerResponse(mode: ProductSyncMode, previous: DbRow | null): Promise<{
  response: Response;
  raw: Buffer;
  requestWasFiltered: boolean;
}> {
  const token = String(process.env.PRODUCT_API_TOKEN ?? '').trim();
  const signingSecret = String(process.env.PRODUCT_API_SIGNING_SECRET ?? '').trim();
  if (!token || !signingSecret) throw new Error('Product API credentials are not configured.');

  const url = new URL(FEED_URL);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', String(FEED_LIMIT));
  let requestWasFiltered = false;
  if (mode === 'incremental' && previous?.incremental_supported === true && previous.completed_at) {
    url.searchParams.set('updated_since', String(previous.completed_at));
    requestWasFiltered = true;
  }

  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  if (previous?.response_etag) headers['If-None-Match'] = String(previous.response_etag);
  const response = await fetch(url, {
    method: 'GET',
    headers,
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(30000),
  });
  if (classifyFeedResponse(response.status) === 'not_modified') return { response, raw: Buffer.alloc(0), requestWasFiltered };
  if (!response.ok) throw new Error(`Partner catalogue request returned HTTP ${response.status}.`);

  const raw = await readLimitedBody(response, MAX_FEED_BYTES);
  verifyFeedSignature({
    rawBody: raw,
    timestamp: response.headers.get('x-feed-timestamp'),
    signature: response.headers.get('x-feed-signature'),
    signed: response.headers.get('x-feed-signed'),
    secret: signingSecret,
  });
  const contentType = String(response.headers.get('content-type') ?? '').toLowerCase();
  if (!contentType.includes('application/json')) throw new Error('Partner catalogue did not return JSON.');
  return { response, raw, requestWasFiltered };
}

function publicResult(mode: ProductSyncMode, run: RunState, status: ProductSyncResult['status'], message?: string): ProductSyncResult {
  return {
    status,
    mode,
    productsReceived: run.productsReceived,
    productsCreated: run.productsCreated,
    productsUpdated: run.productsUpdated,
    productsDeactivated: run.productsDeactivated,
    errorsCount: run.errors.length,
    ...(message ? { message } : {}),
  };
}

export async function synchronizeProducts(mode: ProductSyncMode): Promise<ProductSyncResult> {
  const db = getSupabaseAdmin();
  let runId: string | null;
  try {
    runId = await beginRun(db, mode);
  } catch (error) {
    return emptyResult(mode, 'failed', sanitizeSyncError(error));
  }
  if (!runId) return emptyResult(mode, 'busy', 'A product synchronization is already running.');

  const run: RunState = {
    id: runId,
    productsReceived: 0,
    productsCreated: 0,
    productsUpdated: 0,
    productsDeactivated: 0,
    errors: [],
    responseEtag: null,
    incrementalSupported: null,
  };

  try {
    const previous = await latestSuccessfulRun(db, mode);
    const feedResponse = await getPartnerResponse(mode, previous);
    run.responseEtag = feedResponse.response.headers.get('etag') ?? previous?.response_etag ?? null;
    if (feedResponse.response.status === 304) {
      run.incrementalSupported = previous?.incremental_supported ?? null;
      await completeRun(db, run, 'no_change');
      return publicResult(mode, run, 'no_change');
    }

    const feed = parseFeed(feedResponse.raw);
    run.productsReceived = feed.products.length;
    run.incrementalSupported = typeof feed.meta.incrementalSync === 'boolean'
      ? feed.meta.incrementalSync
      : typeof feed.meta.incremental_sync === 'boolean'
        ? feed.meta.incremental_sync
        : null;

    const categoryMap = await ensureCategories(db, feed.products);
    const existing = await loadAll(
      db,
      'products',
      'id, slug, sku, external_source, external_product_id'
    );
    const byExternalId = new Map(
      existing
        .filter((row) => row.external_source === PRODUCT_SYNC_SOURCE && row.external_product_id)
        .map((row) => [String(row.external_product_id), row])
    );
    const legacySkuCandidates = new Map<string, DbRow[]>();
    for (const row of existing) {
      if (row.external_source || !row.sku) continue;
      const key = String(row.sku).trim().toLowerCase();
      legacySkuCandidates.set(key, [...(legacySkuCandidates.get(key) ?? []), row]);
    }
    const takenSlugs = new Set(existing.map((row) => String(row.slug).toLowerCase()));
    const presentExternalIds = new Set<string>();

    for (const sourceProduct of feed.products) {
      presentExternalIds.add(sourceProduct.id);
      let current = byExternalId.get(sourceProduct.id) ?? null;
      // One-time adoption avoids duplicating the catalogue that predates the
      // external ID columns. After adoption every update is external-ID-only.
      if (!current && sourceProduct.sku) {
        const candidates = legacySkuCandidates.get(sourceProduct.sku.toLowerCase()) ?? [];
        if (candidates.length === 1) current = candidates[0];
      }

      const now = new Date().toISOString();
      const columns = buildProductColumns(sourceProduct, {
        source: PRODUCT_SYNC_SOURCE,
        now,
        isNew: !current,
      });
      const category = categoryMap.get(sourceProduct.category.toLowerCase());
      if (!category) {
        run.errors.push(`Product ${sourceProduct.id}: category could not be resolved.`);
        continue;
      }
      columns.category = category.name;
      columns.category_slug = category.slug;

      if (!current) {
        const base = slugifyProduct(sourceProduct.name) || `product-${slugifyProduct(sourceProduct.id)}`;
        let slug = base;
        for (let suffix = 2; takenSlugs.has(slug); suffix += 1) slug = `${base}-${suffix}`;
        takenSlugs.add(slug);
        columns.slug = slug;
      }

      let productId: string;
      if (current) {
        const { error } = await db.from('products').update(columns).eq('id', current.id);
        if (error) {
          run.errors.push(`Product ${sourceProduct.id}: ${sanitizeSyncError(error)}`);
          continue;
        }
        productId = String(current.id);
        run.productsUpdated += 1;
      } else {
        const { data, error } = await db.from('products').insert(columns).select('id, slug').single();
        if (error) {
          run.errors.push(`Product ${sourceProduct.id}: ${sanitizeSyncError(error)}`);
          continue;
        }
        productId = String(data.id);
        current = { id: productId, slug: data.slug, ...columns };
        byExternalId.set(sourceProduct.id, current);
        run.productsCreated += 1;
      }

      const { error: translationError } = await db
        .from('product_translations')
        .upsert(buildTranslations(sourceProduct, productId, now), { onConflict: 'product_id,locale' });
      if (translationError) run.errors.push(`Product ${sourceProduct.id} translations: ${sanitizeSyncError(translationError)}`);

      const { error: priceError } = await db
        .from('product_prices')
        .upsert(buildPrices(sourceProduct, productId), { onConflict: 'product_id,currency' });
      if (priceError) run.errors.push(`Product ${sourceProduct.id} prices: ${sanitizeSyncError(priceError)}`);
      if (sourceProduct.priceCrc === null) {
        const { error: deletePriceError } = await db.from('product_prices').delete().eq('product_id', productId).eq('currency', 'CRC');
        if (deletePriceError) run.errors.push(`Product ${sourceProduct.id} CRC price: ${sanitizeSyncError(deletePriceError)}`);
      }
    }

    const canDeactivate = isSafeFullResponse({
      mode,
      requestWasFiltered: feedResponse.requestWasFiltered,
      meta: feed.meta,
      receivedCount: feed.products.length,
      errorsCount: run.errors.length,
    });
    if (canDeactivate) {
      const missingIds = existing
        .filter((row) => row.external_source === PRODUCT_SYNC_SOURCE)
        .filter((row) => row.external_product_id && !presentExternalIds.has(String(row.external_product_id)))
        .map((row) => String(row.id));
      for (const group of chunks(missingIds, 200)) {
        const { data, error } = await db
          .from('products')
          .update({ is_active: false, in_stock: false, last_synced_at: new Date().toISOString() })
          .in('id', group)
          .select('id');
        if (error) run.errors.push(`Removal reconciliation: ${sanitizeSyncError(error)}`);
        else run.productsDeactivated += data?.length ?? 0;
      }
    }

    const status = run.errors.length ? 'failed' : 'succeeded';
    await completeRun(db, run, status);
    return publicResult(mode, run, status, run.errors.length ? 'Synchronization completed with errors; removals were not reconciled.' : undefined);
  } catch (error) {
    run.errors.push(sanitizeSyncError(error));
    try {
      await completeRun(db, run, 'failed');
    } catch (auditError) {
      run.errors.push(sanitizeSyncError(auditError));
    }
    return publicResult(mode, run, 'failed', run.errors[0]);
  }
}
