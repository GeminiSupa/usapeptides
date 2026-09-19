import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) return Response.json({ error: 'unauthorized', message: 'Sign in again.' }, { status: 401 });

  const db = getSupabaseAdmin();
  const { data: auth, error: authError } = await db.auth.getUser(token);
  const user = auth.user;
  const email = user?.email?.trim().toLowerCase();
  if (authError || !user || !email) return Response.json({ error: 'unauthorized', message: 'Sign in again.' }, { status: 401 });

  const staffByUser = await db.from('admin_users').select('id').eq('user_id', user.id).maybeSingle();
  const staffByEmail = await db.from('admin_users').select('id').eq('email', email).maybeSingle();
  if (staffByUser.data || staffByEmail.data) {
    return Response.json({ error: 'forbidden', message: 'Dashboard accounts cannot be used as customer accounts.' }, { status: 403 });
  }

  const { data: existing, error: lookupError } = await db
    .from('customer_profiles').select('id, user_id, full_name, phone').eq('email', email).maybeSingle();
  if (lookupError) return Response.json({ error: 'server_error', message: 'Could not finish setting up this account.' }, { status: 500 });
  if (existing?.user_id && existing.user_id !== user.id) {
    return Response.json({ error: 'conflict', message: 'This customer record is linked to another account.' }, { status: 409 });
  }

  const metadata = user.user_metadata ?? {};
  const fullName = String(metadata.full_name ?? '').trim().slice(0, 160) || null;
  const phone = String(metadata.phone ?? '').trim().slice(0, 50) || null;
  if (existing) {
    const { error } = await db.from('customer_profiles').update({
      user_id: user.id,
      full_name: fullName || existing.full_name,
      phone: phone || existing.phone,
      marketing_opt_in: Boolean(metadata.marketing_opt_in),
    }).eq('id', existing.id);
    if (error) return Response.json({ error: 'server_error', message: 'Could not finish setting up this account.' }, { status: 500 });
    return Response.json({ data: { customerId: existing.id, linked: true } });
  }

  const { data: created, error } = await db.from('customer_profiles').insert({
    user_id: user.id,
    email,
    full_name: fullName,
    phone,
    marketing_opt_in: Boolean(metadata.marketing_opt_in),
  }).select('id').single();
  if (error) return Response.json({ error: 'server_error', message: 'Could not finish setting up this account.' }, { status: 500 });
  return Response.json({ data: { customerId: created.id, linked: false } });
}
