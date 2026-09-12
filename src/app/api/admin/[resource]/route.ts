import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { RESOURCES, isResource } from '@/lib/adminResources';
import { featureUnavailable } from '@/lib/env';
import { ok, created, badRequest, notFound, serverError, readJson } from '@/lib/api';

export const dynamic = 'force-dynamic';

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
    if (error) return serverError(error.message);

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
      case 'date':
        row[field.name] = new Date(String(raw)).toISOString();
        break;
      default:
        row[field.name] = String(raw).trim().slice(0, 5000);
    }
  }

  if (Object.keys(fields).length) return badRequest('Could not save.', fields);
  if (Object.keys(row).length === 0) return badRequest('Nothing to save.');

  try {
    const { data, error } = await getSupabaseAdmin()
      .from(config.table)
      .insert(row)
      .select(config.select)
      .single();

    if (error) {
      // Surface the common ones in language that means something to the user.
      if (error.code === '23505') return badRequest('A record with that unique value already exists.');
      if (error.code === '23503') return badRequest('A referenced record does not exist.');
      return serverError(error.message);
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

  try {
    const { data, error } = await getSupabaseAdmin()
      .from(config.table)
      .update(changes)
      .eq('id', body.id)
      .select(config.select)
      .maybeSingle();

    if (error) return serverError(error.message);
    if (!data) return notFound('No row with that id.');

    return ok({ row: data, applied: Object.keys(changes), ignored: rejected });
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
