import { requireAdmin } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { featureUnavailable } from '@/lib/env';
import { slugify } from '@/lib/adminResources';
import { isOwnMediaUrl } from '@/lib/media';
import { writeAudit } from '@/lib/audit';
import { ok, badRequest, serverError, readJson, clip } from '@/lib/api';
import { PRODUCT_IMPORT_LIMIT, PRODUCT_SHEET_FIELDS, readBoolean, readMoney } from '@/lib/productSheet';

export const dynamic = 'force-dynamic';

/**
 * Bulk product import and full export.
 *
 *   GET  /api/admin/products/import
 *        -> every product, for the CSV / Excel / PDF export
 *   POST /api/admin/products/import  { rows, mode: 'upsert'|'create', dryRun }
 *        -> one result per row: create, update, skip or error
 *
 * The browser reads the file and maps its headings; this route trusts none of
 * it. Every value is re-validated here, and the dry run uses exactly the same
 * code as the real import, so the preview cannot promise something the import
 * then refuses.
 *
 * A row matches an existing product by SKU first, then by web address. Blank
 * cells leave an existing product's value alone, so a sheet with only SKU and
 * Stock is a stock update and nothing else.
 */

const SELECT =
  'id, slug, name, category, category_slug, price, sale_price, sku, purity, sequence, cas_number,' +
  ' molar_mass, formula, storage, appearance, description, tags, image, coa_url, coa_lot,' +
  ' coa_tested_at, stock_count, in_stock, is_featured, is_popular, is_active, sort_order';

type Row = Record<string, unknown>;

interface RowResult {
  line: number;
  action: 'create' | 'update' | 'skip' | 'error';
  name: string;
  sku: string | null;
  messages: string[];
}

const blank = (v: unknown) => v === undefined || v === null || String(v).trim() === '';

/** Links must be files we host; anything else is dropped with a warning. */
const storableLink = (v: string) => v.startsWith('/') && !v.startsWith('//') ? !v.includes('..') : isOwnMediaUrl(v);

async function authorize(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return { response: unavailable } as const;
  const auth = await requireAdmin(req, { permission: 'products' });
  return auth.ok ? ({ auth } as const) : ({ response: auth.response } as const);
}

async function allProducts(db: ReturnType<typeof getSupabaseAdmin>) {
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('products').select(SELECT).order('name').range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < 1000) return rows;
  }
}

export async function GET(req: Request) {
  const access = await authorize(req);
  if ('response' in access) return access.response;
  try {
    return ok({ products: await allProducts(getSupabaseAdmin()) });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}

export async function POST(req: Request) {
  const access = await authorize(req);
  if ('response' in access) return access.response;

  const body = await readJson<{ rows?: unknown; mode?: string; dryRun?: boolean }>(req);
  if (!body || !Array.isArray(body.rows)) return badRequest('Send the rows to import.');
  if (body.rows.length === 0) return badRequest('The file has no product rows.');
  if (body.rows.length > PRODUCT_IMPORT_LIMIT) {
    return badRequest(`A file can hold up to ${PRODUCT_IMPORT_LIMIT} products. Split it and import each part.`);
  }
  const mode = body.mode === 'create' ? 'create' : 'upsert';
  const dryRun = body.dryRun !== false;

  const db = getSupabaseAdmin();

  let existing: Row[];
  try {
    existing = await allProducts(db);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }

  const { data: categoryRows, error: categoryError } = await db
    .from('product_categories')
    .select('id, name, slug');
  if (categoryError) return serverError('Run migration 0011_product_categories.sql, then try again.');

  const categories = new Map<string, { name: string; slug: string }>();
  for (const c of categoryRows ?? []) {
    categories.set(String(c.name).toLowerCase(), { name: c.name, slug: c.slug });
    categories.set(String(c.slug).toLowerCase(), { name: c.name, slug: c.slug });
  }
  const newCategories = new Map<string, { name: string; slug: string }>();

  const bySku = new Map(existing.filter((p) => p.sku).map((p) => [String(p.sku).toLowerCase(), p]));
  const bySlug = new Map(existing.map((p) => [String(p.slug).toLowerCase(), p]));
  const takenSlugs = new Set(bySlug.keys());
  const takenSkus = new Set(bySku.keys());
  const seenInFile = new Set<string>();

  const results: RowResult[] = [];
  const inserts: { line: number; row: Row }[] = [];
  const updates: { line: number; id: string; row: Row }[] = [];

  body.rows.forEach((input, index) => {
    const line = index + 2; // row 1 is the heading
    const raw = (input && typeof input === 'object' ? input : {}) as Row;
    const messages: string[] = [];
    const errors: string[] = [];

    const name = clip(raw.name, 200);
    const sku = clip(raw.sku, 80) || null;
    const givenSlug = slugify(clip(raw.slug, 120));

    const match =
      (sku && bySku.get(sku.toLowerCase())) ||
      (givenSlug && bySlug.get(givenSlug)) ||
      (name && bySlug.get(slugify(name))) ||
      null;

    const identity = (sku || givenSlug || slugify(name)).toLowerCase();
    if (identity && seenInFile.has(identity)) {
      results.push({ line, action: 'error', name, sku, messages: ['This product appears twice in the file. Keep one row.'] });
      return;
    }
    if (identity) seenInFile.add(identity);

    if (match && mode === 'create') {
      results.push({ line, action: 'skip', name: name || String(match.name), sku, messages: ['Already in the catalogue — left unchanged.'] });
      return;
    }

    const row: Row = {};

    if (name) row.name = name;
    else if (!match) errors.push('Name is missing.');

    if (sku && (!match || String(match.sku ?? '').toLowerCase() !== sku.toLowerCase())) {
      if (takenSkus.has(sku.toLowerCase())) errors.push(`SKU ${sku} already belongs to another product.`);
      else row.sku = sku;
    }

    for (const field of PRODUCT_SHEET_FIELDS) {
      const value = raw[field.key];
      if (blank(value) || ['name', 'sku', 'slug', 'category'].includes(field.key)) continue;

      switch (field.type) {
        case 'money': {
          const n = readMoney(value);
          if (n === undefined || n < 0) errors.push(`${field.header} "${value}" is not a price.`);
          else row[field.key] = Math.round(n * 100) / 100;
          break;
        }
        case 'integer': {
          const n = Number(String(value).replace(/,/g, ''));
          if (!Number.isInteger(n) || (field.key === 'stock_count' && n < 0)) errors.push(`${field.header} "${value}" is not a whole number.`);
          else row[field.key] = n;
          break;
        }
        case 'boolean': {
          const b = readBoolean(value);
          if (b === undefined) messages.push(`${field.header} "${value}" is not yes or no — ignored.`);
          else row[field.key] = b;
          break;
        }
        case 'date': {
          const text = String(value).trim();
          const parsed = /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : (() => {
            const d = new Date(text);
            return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
          })();
          if (!parsed) messages.push(`${field.header} "${text}" is not a date — ignored.`);
          else row[field.key] = parsed;
          break;
        }
        case 'list':
          row[field.key] = String(value).split(/[,;|]/).map((t) => t.trim()).filter(Boolean).slice(0, 30);
          break;
        default: {
          const text = clip(String(value), field.key === 'description' ? 10000 : 2000);
          if (field.key === 'image' || field.key === 'coa_url') {
            if (!storableLink(text)) {
              messages.push(`${field.header} is on another website, so it was not copied. Upload the file on the product instead.`);
              break;
            }
          }
          row[field.key] = text;
        }
      }
    }

    if (!match && row.price === undefined) errors.push('Price is missing.');

    const categoryText = clip(raw.category, 120);
    if (categoryText) {
      const key = categoryText.toLowerCase();
      let category = categories.get(key) ?? newCategories.get(key);
      if (!category) {
        const slug = slugify(categoryText);
        category = categories.get(slug) ?? { name: categoryText, slug };
        if (!categories.has(slug)) {
          newCategories.set(key, category);
          messages.push(`New category "${categoryText}" will be created.`);
        }
      }
      row.category = category.name;
      row.category_slug = category.slug;
    } else if (!match) {
      messages.push('No category — it will not appear on any category page until one is set.');
    }

    if (row.stock_count !== undefined) row.in_stock = Number(row.stock_count) > 0;

    if (errors.length) {
      results.push({ line, action: 'error', name, sku, messages: [...errors, ...messages] });
      return;
    }

    if (match) {
      if (givenSlug && givenSlug !== match.slug) {
        if (takenSlugs.has(givenSlug)) messages.push('That web address is taken — kept the current one.');
        else { row.slug = givenSlug; takenSlugs.add(givenSlug); }
      }
      if (row.sku) takenSkus.add(String(row.sku).toLowerCase());
      if (Object.keys(row).length === 0) {
        results.push({ line, action: 'skip', name: String(match.name), sku, messages: ['Nothing to change.'] });
        return;
      }
      updates.push({ line, id: String(match.id), row });
      results.push({ line, action: 'update', name: name || String(match.name), sku, messages });
      return;
    }

    let slug = givenSlug || slugify(name);
    for (let n = 2; takenSlugs.has(slug); n += 1) slug = `${givenSlug || slugify(name)}-${n}`;
    takenSlugs.add(slug);
    if (sku) takenSkus.add(sku.toLowerCase());
    row.slug = slug;
    if (row.is_active === undefined) row.is_active = true;
    if (row.stock_count === undefined) row.in_stock = true;

    inserts.push({ line, row });
    results.push({ line, action: 'create', name, sku, messages });
  });

  const summary = {
    create: results.filter((r) => r.action === 'create').length,
    update: results.filter((r) => r.action === 'update').length,
    skip: results.filter((r) => r.action === 'skip').length,
    error: results.filter((r) => r.action === 'error').length,
    newCategories: Array.from(newCategories.values()).map((c) => c.name),
  };

  if (dryRun) return ok({ dryRun: true, mode, summary, results });

  // Categories first, so no product lands pointing at one that does not exist.
  if (newCategories.size) {
    const { error } = await db
      .from('product_categories')
      .upsert(Array.from(newCategories.values()).map((c, i) => ({ ...c, sort_order: 1000 + i })), { onConflict: 'slug', ignoreDuplicates: true });
    if (error) return serverError(`Could not create the new categories: ${error.message}`);
  }

  const fail = (line: number, message: string) => {
    const r = results.find((x) => x.line === line);
    if (r) { r.action = 'error'; r.messages = [message, ...r.messages]; }
  };

  for (let i = 0; i < inserts.length; i += 200) {
    const chunk = inserts.slice(i, i + 200);
    const { error } = await db.from('products').insert(chunk.map((c) => c.row));
    if (error) {
      // One bad row fails the whole chunk; retry singly to find it.
      for (const item of chunk) {
        const { error: single } = await db.from('products').insert(item.row);
        if (single) fail(item.line, single.code === '23505' ? 'A product with that SKU or web address already exists.' : single.message);
      }
    }
  }

  for (let i = 0; i < updates.length; i += 10) {
    await Promise.all(updates.slice(i, i + 10).map(async (u) => {
      const { error } = await db.from('products').update(u.row).eq('id', u.id);
      if (error) fail(u.line, error.code === '23505' ? 'That SKU or web address already belongs to another product.' : error.message);
    }));
  }

  const done = {
    ...summary,
    create: results.filter((r) => r.action === 'create').length,
    update: results.filter((r) => r.action === 'update').length,
    error: results.filter((r) => r.action === 'error').length,
  };

  await writeAudit(access.auth.admin, {
    action: 'product.import',
    targetType: 'product',
    targetLabel: `${done.create} added, ${done.update} updated`,
    detail: { mode, ...done },
  });

  return ok({ dryRun: false, mode, summary: done, results });
}
