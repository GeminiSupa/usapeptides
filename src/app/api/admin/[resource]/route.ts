import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { RESOURCES, isResource } from '@/lib/adminResources';
import { featureUnavailable } from '@/lib/env';
import { ok, created, badRequest, notFound, serverError, readJson } from '@/lib/api';

import { supabaseEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

/**
 * Turn "column products.coa_url does not exist" into an instruction.
 *
 * The whitelist asks for columns that a migration adds. If the database is a
 * version behind, PostgREST reports an undefined column (42703) or a stale
 * schema cache (PGRST204), and the raw message sends people looking for a bug
 * in the code instead of running the SQL.
 */
function migrationHint(error: { code?: string; message?: string } | null): string | null {
  if (!error) return null;
  const code = error.code ?? '';
  const message = error.message ?? '';
  const missingColumn =
    code === '42703' ||
    code === 'PGRST204' ||
    /column .* does not exist|could not find the .* column/i.test(message);

  if (!missingColumn) return null;

  return (
    'This section needs a database update that has not been run yet. Open the ' +
    'Supabase SQL editor and run supabase/migrations/0004_storefront.sql, then ' +
    `reload. (${message})`
  );
}

/**
 * True for a URL inside our own Supabase storage, which is where the upload
 * route puts files. Keeping image and certificate columns pointed at our own
 * bucket means a product page cannot be made to load or link somewhere else.
 */
function isStorableUrl(value: string): boolean {
  if (value.startsWith('/')) return true; // bundled artwork, e.g. /vials/x.svg
  if (!supabaseEnv.url) return false;
  try {
    return new URL(value).origin === new URL(supabaseEnv.url).origin;
  } catch {
    return false;
  }
}

/**
 * Generic admin CRUD over a fixed whitelist of tables.
 *
 *   GET    /api/admin/<resource>?q=&status=&limit=&offset=
 *   PATCH  /api/admin/<resource>   { id, changes: {...} }
 *   DELETE /api/admin/<resource>?id=<uuid>
 *
 * Every request is gated on requireAdmin, and both the table and the columns
 * being written are resolved from the whitelist rather than from the request.
 */

export async function GET(req: Request, { params }: { params: { resource: string } }) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  if (!isResource(params.resource)) return notFound('Unknown admin resource.');
  const config = RESOURCES[params.resource];

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim();
  const status = url.searchParams.get('status')?.trim();
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);

  try {
    let query = getSupabaseAdmin()
      .from(config.table)
      .select(config.select, { count: 'exact' })
      .order(config.orderBy, { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && config.statusColumn) {
      query = query.eq(config.statusColumn, status);
    }

    if (q && config.searchable.length) {
      // PostgREST OR filter across the resource's searchable columns.
      query = query.or(config.searchable.map((c) => `${c}.ilike.%${q}%`).join(','));
    }

    const { data, error, count } = await query;
    if (error) return serverError(migrationHint(error) ?? error.message);

    return ok({
      rows: data ?? [],
      total: count ?? 0,
      limit,
      offset,
      title: config.title,
      blurb: config.blurb,
      editable: config.editable,
      deletable: config.deletable,
      createFields: config.createFields,
      columns: config.columns ?? null,
      statusColumn: config.statusColumn ?? null,
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}

/** POST /api/admin/<resource> - create a row from the resource's createFields. */
export async function POST(req: Request, { params }: { params: { resource: string } }) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  if (!isResource(params.resource)) return notFound('Unknown admin resource.');
  const config = RESOURCES[params.resource];

  if (config.createFields.length === 0) {
    return badRequest(`${config.title} records are created by the system, not by hand.`);
  }

  const body = await readJson<Record<string, unknown>>(req);
  if (!body) return badRequest('Request body must be valid JSON.');

  const row: Record<string, unknown> = {};
  const fields: Record<string, string> = {};

  for (const field of config.createFields) {
    const raw = body[field.name];
    const empty = raw === undefined || raw === null || raw === '';

    if (empty) {
      if (field.required) fields[field.name] = `${field.label} is required.`;
      continue;
    }

    switch (field.type) {
      case 'number':
      case 'money': {
        const n = Number(raw);
        if (!Number.isFinite(n)) {
          fields[field.name] = `${field.label} must be a number.`;
        } else {
          row[field.name] = n;
        }
        break;
      }
      case 'boolean':
        row[field.name] = Boolean(raw);
        break;
      case 'select':
        if (field.options && !field.options.includes(String(raw))) {
          fields[field.name] = `${field.label} must be one of: ${field.options.join(', ')}`;
        } else {
          row[field.name] = String(raw);
        }
        break;
      case 'date': {
        const text = String(raw).trim();
        // A date input gives YYYY-MM-DD. Passing it through unchanged keeps it
        // the day the person picked; converting to an ISO instant first can
        // land on the day before once the timezone is applied.
        if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
          row[field.name] = text;
        } else {
          const parsed = new Date(text);
          if (Number.isNaN(parsed.getTime())) {
            fields[field.name] = `${field.label} is not a date we can read.`;
          } else {
            row[field.name] = parsed.toISOString();
          }
        }
        break;
      }
      case 'image':
      case 'file': {
        // Set by the upload route, which returns a URL in our own storage
        // bucket. Anything else is refused rather than stored, so a product
        // image cannot be pointed at a third-party host from a crafted post.
        const url = String(raw).trim();
        if (!isStorableUrl(url)) {
          fields[field.name] = 'Upload the file using the button rather than pasting a link.';
        } else {
          row[field.name] = url;
        }
        break;
      }
      default:
        row[field.name] = String(raw).trim().slice(0, 5000);
    }
  }

  if (Object.keys(fields).length) return badRequest('Could not save.', fields);
  if (Object.keys(row).length === 0) return badRequest('Nothing to save.');

  const insert = config.derive ? config.derive(row) : row;

  try {
    const { data, error } = await getSupabaseAdmin()
      .from(config.table)
      .insert(insert)
      .select(config.select)
      .single();

    if (error) {
      // Surface the common ones in language that means something to the user.
      if (error.code === '23505') return badRequest('A record with that unique value already exists.');
      if (error.code === '23503') return badRequest('A referenced record does not exist.');
      return serverError(migrationHint(error) ?? error.message);
    }

    return created({ row: data });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}

export async function PATCH(req: Request, { params }: { params: { resource: string } }) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  if (!isResource(params.resource)) return notFound('Unknown admin resource.');
  const config = RESOURCES[params.resource];

  if (config.editable.length === 0) {
    return badRequest(`${params.resource} is read-only.`);
  }

  const body = await readJson<{ id?: string; changes?: Record<string, unknown> }>(req);
  if (!body?.id || !body.changes || typeof body.changes !== 'object') {
    return badRequest('Both "id" and "changes" are required.');
  }

  // Keep only columns this resource allows to be written.
  const changes: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body.changes)) {
    if (config.editable.includes(key)) changes[key] = value;
  }

  const rejected = Object.keys(body.changes).filter((k) => !config.editable.includes(k));
  if (Object.keys(changes).length === 0) {
    return badRequest('No editable fields supplied.', {
      fields: `Allowed: ${config.editable.join(', ')}`,
    });
  }

  const update = config.deriveUpdate ? config.deriveUpdate(changes) : changes;

  try {
    const { data, error } = await getSupabaseAdmin()
      .from(config.table)
      .update(update)
      .eq('id', body.id)
      .select(config.select)
      .maybeSingle();

    if (error) return serverError(migrationHint(error) ?? error.message);
    if (!data) return notFound('No row with that id.');

    return ok({ row: data, applied: Object.keys(update), ignored: rejected });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}

export async function DELETE(req: Request, { params }: { params: { resource: string } }) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  if (!isResource(params.resource)) return notFound('Unknown admin resource.');
  const config = RESOURCES[params.resource];

  if (!config.deletable) {
    return badRequest(
      `${params.resource} cannot be deleted. Records are kept for audit purposes.`
    );
  }

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return badRequest('An "id" is required.');

  try {
    const { error } = await getSupabaseAdmin().from(config.table).delete().eq('id', id);
    if (error) return serverError(error.message);
    return ok({ deleted: true, id });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
