import { requireAdmin } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { featureUnavailable } from '@/lib/env';
import { isSalesAgent } from '@/lib/permissions';
import { writeAudit } from '@/lib/audit';
import { removeCustomerLogin } from '@/lib/customerAccounts';
import { ok, badRequest, notFound, serverError, readJson } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * A client's sign-in for the shop's My account page.
 *
 *   POST   { customerId, password }  create the sign-in, or set a new password
 *   DELETE ?customerId=              remove the sign-in, keep the customer
 *
 * No email is needed: the person creating it shares the password with the
 * client, who can change it from My account. A customer sign-in opens nothing
 * in the dashboard — that needs a row in admin_users, which this never writes.
 *
 * Refused for sales agents: setting somebody's password is not a sales task.
 */

const MIN_PASSWORD = 12;

async function authorize(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return { response: unavailable } as const;
  const auth = await requireAdmin(req, { permission: 'customers' });
  if (!auth.ok) return { response: auth.response } as const;
  if (isSalesAgent(auth.admin.profile)) {
    return { response: Response.json({ error: 'forbidden', message: 'Ask an administrator to set up customer sign-ins.' }, { status: 403 }) } as const;
  }
  return { auth } as const;
}

async function findAuthUserByEmail(db: ReturnType<typeof getSupabaseAdmin>, email: string) {
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const hit = data.users.find((u) => (u.email ?? '').toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

export async function POST(req: Request) {
  const access = await authorize(req);
  if ('response' in access) return access.response;

  const body = await readJson<{ customerId?: string; password?: string }>(req);
  const password = String(body?.password ?? '');
  if (!body?.customerId) return badRequest('Choose a customer.');
  if (password.length < MIN_PASSWORD) {
    return badRequest(`Use at least ${MIN_PASSWORD} characters.`, { password: `Use at least ${MIN_PASSWORD} characters.` });
  }

  const db = getSupabaseAdmin();
  const { data: customer, error } = await db
    .from('customer_profiles')
    .select('id, email, full_name, user_id')
    .eq('id', body.customerId)
    .maybeSingle();
  if (error) return serverError(error.message);
  if (!customer) return notFound('That customer no longer exists.');

  const email = String(customer.email).trim().toLowerCase();

  // A dashboard account's password must only ever be changed by its owner.
  const { data: admin } = await db.from('admin_users').select('id').ilike('email', email).maybeSingle();
  if (admin) return badRequest('That email belongs to a dashboard user. Use a different email for the customer.');

  try {
    let userId = customer.user_id as string | null;

    if (userId) {
      const { error: updateError } = await db.auth.admin.updateUserById(userId, { password });
      if (updateError) return serverError(updateError.message);
    } else {
      const { data: createdUser, error: createError } = await db.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: customer.full_name ?? '', kind: 'customer' },
      });

      if (createError) {
        // The address may already have a sign-in (e.g. created before this
        // profile). Link it rather than failing, and set the new password.
        const existing = await findAuthUserByEmail(db, email);
        if (!existing) return serverError(createError.message);
        const { data: staff } = await db.from('admin_users').select('id').eq('user_id', existing.id).maybeSingle();
        if (staff) return badRequest('That email belongs to a dashboard user. Use a different email for the customer.');
        const { error: updateError } = await db.auth.admin.updateUserById(existing.id, { password });
        if (updateError) return serverError(updateError.message);
        userId = existing.id;
      } else {
        userId = createdUser.user.id;
      }

      const { error: linkError } = await db.from('customer_profiles').update({ user_id: userId }).eq('id', customer.id);
      if (linkError) {
        return serverError(linkError.code === '23505' ? 'That sign-in is already linked to another customer.' : linkError.message);
      }
    }

    await writeAudit(access.auth.admin, {
      action: 'customer.login_invite',
      targetType: 'customer',
      targetId: customer.id,
      targetLabel: email,
      detail: { created: !customer.user_id },
    });

    return ok({ customerId: customer.id, hasLogin: true, created: !customer.user_id });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}

export async function DELETE(req: Request) {
  const access = await authorize(req);
  if ('response' in access) return access.response;

  const customerId = new URL(req.url).searchParams.get('customerId');
  if (!customerId) return badRequest('Choose a customer.');

  const db = getSupabaseAdmin();
  const { data: customer } = await db.from('customer_profiles').select('id, email, user_id').eq('id', customerId).maybeSingle();
  if (!customer) return notFound('That customer no longer exists.');
  if (!customer.user_id) return ok({ customerId, hasLogin: false });

  const removed = await removeCustomerLogin(db, customer.user_id, customer.email);
  if (removed) return serverError(removed);

  await db.from('customer_profiles').update({ user_id: null }).eq('id', customerId);
  await writeAudit(access.auth.admin, {
    action: 'customer.login_invite',
    targetType: 'customer',
    targetId: customerId,
    targetLabel: customer.email,
    detail: { removed: true },
  });
  return ok({ customerId, hasLogin: false });
}
