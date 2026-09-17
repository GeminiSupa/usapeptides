import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin, type AdminIdentity } from '@/lib/adminAuth';
import { RESOURCES, isResource } from '@/lib/adminResources';
import { featureUnavailable, supabaseEnv } from '@/lib/env';
import { isSalesAgent } from '@/lib/permissions';
import { generateCommissionsForOrder } from '@/lib/commissions';
import { isCreditable } from '@/lib/attribution';
import { writeAudit } from '@/lib/audit';
import { removeCustomerLogin } from '@/lib/customerAccounts';
import { ok, created, badRequest, notFound, serverError, readJson } from '@/lib/api';

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
  if (!isMissingColumn(error)) return null;

  return (
    'This section needs a database update that has not been run yet. Open the ' +
    'Supabase SQL editor and run the files in supabase/migrations you have not ' +
    `applied yet, in number order, then reload. (${error.message ?? ''})`
  );
}

const isMissingColumn = (error: { code?: string; message?: string }): boolean =>
  error.code === '42703' ||
  error.code === 'PGRST204' ||
  /column .* does not exist|could not find the .* column/i.test(error.message ?? '');

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

/* ------------------------------------------------------- sales agents ----- */

/**
 * Records that belong to somebody. A sales agent sees their own plus the
 * unclaimed ones they can claim, never a colleague's.
 *
 * The extra columns come from 0006/0007. They are asked for when present and
 * dropped when not, so staff on an older database still see the table.
 * Nobody can be a sales agent before 0007, so an agent's query never needs the
 * fallback.
 */
const OWNERSHIP: Record<string, { column: string; extraSelect: string }> = {
  orders: { column: 'referred_by', extraSelect: 'referred_by, agent_source, agent_claimed_at' },
  leads: { column: 'owner_id', extraSelect: 'owner_id' },
};

/** Columns an agent may not write even on their own record: who it belongs to. */
const AGENT_BLOCKED_COLUMNS = new Set(['assigned_to', 'owner', 'owner_id', 'referred_by']);

const NOT_YOURS = 'You can only change records that are yours. Claim it first.';

/**
 * An agent's customers are the people whose orders are theirs. Derived rather
 * than stored so a customer and their orders can never belong to two people.
 */
async function agentCustomerEmails(db: ReturnType<typeof getSupabaseAdmin>, agentId: string): Promise<string[]> {
  const { data } = await db.from('orders').select('email').eq('referred_by', agentId).limit(5000);
  return Array.from(
    new Set((data ?? []).map((r: { email?: string }) => String(r.email ?? '').toLowerCase()).filter(Boolean))
  );
}

/** Who can be shown as, or assigned as, the owner of a record. */
async function creditablePeople(db: ReturnType<typeof getSupabaseAdmin>, viewer: AdminIdentity) {
  if (isSalesAgent(viewer.profile)) {
    return [{ id: viewer.id, name: viewer.profile.full_name || viewer.email }];
  }
  const { data, error } = await db.from('admin_users').select('id, full_name, email, role, tier, status');
  if (error) return [];
  return (data ?? [])
    .filter(isCreditable)
    .map((p: any) => ({ id: p.id as string, name: (p.full_name || p.email) as string }));
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

  const db = getSupabaseAdmin();
  const agent = isSalesAgent(auth.admin.profile);
  const own = OWNERSHIP[params.resource];
  let createFields = config.createFields;
  if (params.resource === 'products') {
    const { data: categoryRows } = await db.from('product_categories').select('name').eq('is_active', true).order('sort_order').order('name');
    if (categoryRows?.length) {
      createFields = config.createFields.map((field) => field.name === 'category'
        ? { ...field, options: categoryRows.map((category) => category.name) }
        : field);
    }
  }

  const respond = (rows: unknown[], total: number, hasOwnership: boolean, people: { id: string; name: string }[]) =>
    ok({
      rows,
      total,
      limit,
      offset,
      title: config.title,
      blurb: config.blurb,
      editable: agent ? config.editable.filter((c) => !AGENT_BLOCKED_COLUMNS.has(c)) : config.editable,
      deletable: agent ? false : config.deletable,
      createFields: agent
        ? params.resource === 'customers'
          ? []
          : config.createFields.filter((f) => !AGENT_BLOCKED_COLUMNS.has(f.name))
        : createFields,
      columns: config.columns ?? null,
      statusColumn: config.statusColumn ?? null,
      ownership: hasOwnership && own
        ? {
            column: own.column,
            you: auth.admin.id,
            canClaim: agent,
            canAssign: auth.admin.profile.is_superadmin,
            people,
          }
        : null,
    });

  try {
    let emails: string[] | null = null;
    if (agent && params.resource === 'customers') {
      emails = await agentCustomerEmails(db, auth.admin.id);
      if (emails.length === 0) return respond([], 0, false, []);
    }

    const build = (select: string) => {
      let query = db
        .from(config.table)
        .select(select, { count: 'exact' })
        .order(config.orderBy, { ascending: false })
        .range(offset, offset + limit - 1);

      if (status && config.statusColumn) {
        query = query.eq(config.statusColumn, status);
      }

      if (q && config.searchable.length) {
        // PostgREST OR filter across the resource's searchable columns.
        query = query.or(config.searchable.map((c) => `${c}.ilike.%${q}%`).join(','));
      }

      // A second or() is ANDed with the search above, not merged into it.
      if (agent && own) {
        query = query.or(`${own.column}.is.null,${own.column}.eq.${auth.admin.id}`);
      }
      if (emails) query = query.in('email', emails);

      return query;
    };

    let hasOwnership = Boolean(own);
    let result = await build(own ? `${config.select}, ${own.extraSelect}` : config.select);

    if (result.error && own && !agent && isMissingColumn(result.error)) {
      hasOwnership = false;
      result = await build(config.select);
    }

    const { data, error, count } = result;
    if (error) return serverError(migrationHint(error) ?? error.message);

    const people = hasOwnership ? await creditablePeople(db, auth.admin) : [];
    return respond(data ?? [], count ?? 0, hasOwnership, people);
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
  const agent = isSalesAgent(auth.admin.profile);

  if (config.createFields.length === 0) {
    return badRequest(`${config.title} records are created by the system, not by hand.`);
  }
  if (agent && params.resource === 'customers') {
    return badRequest('A customer becomes yours when their order does. Claim the order instead.');
  }

  let writeFields = config.createFields;
  if (params.resource === 'products') {
    const { data: categories } = await getSupabaseAdmin().from('product_categories').select('name').eq('is_active', true);
    if (categories?.length) {
      writeFields = config.createFields.map((field) => field.name === 'category'
        ? { ...field, options: categories.map((category) => category.name) }
        : field);
    }
  }

  const body = await readJson<Record<string, unknown>>(req);
  if (!body) return badRequest('Request body must be valid JSON.');

  const row: Record<string, unknown> = {};
  const fields: Record<string, string> = {};

  for (const field of writeFields) {
    if (agent && AGENT_BLOCKED_COLUMNS.has(field.name)) continue;

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
  if (params.resource === 'products' && insert.category) {
    const { data: category } = await getSupabaseAdmin().from('product_categories').select('slug').eq('name', String(insert.category)).maybeSingle();
    if (category?.slug) insert.category_slug = category.slug;
  }

  // A lead an agent types in is theirs.
  const own = OWNERSHIP[params.resource];
  if (agent && own) insert[own.column] = auth.admin.id;

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
  const agent = isSalesAgent(auth.admin.profile);

  const editable = agent ? config.editable.filter((c) => !AGENT_BLOCKED_COLUMNS.has(c)) : config.editable;

  if (editable.length === 0) {
    return badRequest(`${params.resource} is read-only.`);
  }

  const body = await readJson<{ id?: string; changes?: Record<string, unknown> }>(req);
  if (!body?.id || !body.changes || typeof body.changes !== 'object') {
    return badRequest('Both "id" and "changes" are required.');
  }

  // Keep only columns this resource allows to be written.
  const changes: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body.changes)) {
    if (editable.includes(key)) changes[key] = value;
  }

  const rejected = Object.keys(body.changes).filter((k) => !editable.includes(k));
  if (Object.keys(changes).length === 0) {
    return badRequest('No editable fields supplied.', {
      fields: `Allowed: ${editable.join(', ')}`,
    });
  }

  const update = config.deriveUpdate ? config.deriveUpdate(changes) : changes;
  const db = getSupabaseAdmin();
  if (params.resource === 'products' && update.category) {
    const { data: category } = await db.from('product_categories').select('slug').eq('name', String(update.category)).maybeSingle();
    if (category?.slug) update.category_slug = category.slug;
  }
  const own = OWNERSHIP[params.resource];

  try {
    if (agent && params.resource === 'customers') {
      const { data: customer } = await db.from(config.table).select('email').eq('id', body.id).maybeSingle();
      const emails = await agentCustomerEmails(db, auth.admin.id);
      if (!customer || !emails.includes(String((customer as { email?: string }).email ?? '').toLowerCase())) {
        return notFound(NOT_YOURS);
      }
    }

    let query = db.from(config.table).update(update).eq('id', body.id);
    // Unclaimed and colleagues' records are refused the same way: not found.
    if (agent && own) query = query.eq(own.column, auth.admin.id);

    const { data, error } = await query.select(config.select).maybeSingle();

    if (error) return serverError(migrationHint(error) ?? error.message);
    if (!data) return notFound(agent && own ? NOT_YOURS : 'No row with that id.');

    if (params.resource === 'orders' && update.status === 'paid') {
      const commissionError = await generateCommissionsForOrder(db, body.id);
      if (commissionError) {
        return serverError(
          /sales_commissions|schema cache|does not exist/i.test(commissionError)
            ? 'The order was marked paid, but earnings need migration 0008_commissions.sql. Run it in Supabase, then mark the order paid again.'
            : `The order was marked paid, but its commission could not be recorded: ${commissionError}`
        );
      }
    }

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

  // An agent deleting a lead would also delete the evidence it was theirs.
  if (isSalesAgent(auth.admin.profile)) {
    return badRequest('Only a super admin can delete records.');
  }

  if (!config.deletable) {
    return badRequest(
      `${params.resource} cannot be deleted. Records are kept for audit purposes.`
    );
  }

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return badRequest('An "id" is required.');

  try {
    const db = getSupabaseAdmin();

    // A customer's shop sign-in goes with them, or it would outlive the
    // record and still open My account.
    let customer: { email: string; user_id: string | null } | null = null;
    if (params.resource === 'customers') {
      const { data } = await db.from('customer_profiles').select('email, user_id').eq('id', id).maybeSingle();
      if (!data) return notFound('That customer no longer exists.');
      customer = data as { email: string; user_id: string | null };
    }

    const { error } = await db.from(config.table).delete().eq('id', id);
    if (error) return serverError(error.message);

    if (customer) {
      if (customer.user_id) {
        const loginError = await removeCustomerLogin(db, customer.user_id, customer.email);
        if (loginError) console.warn('[customers] sign-in not removed', loginError);
      }
      await writeAudit(auth.admin, { action: 'customer.delete', targetType: 'customer', targetId: id, targetLabel: customer.email });
    }
    return ok({ deleted: true, id });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
