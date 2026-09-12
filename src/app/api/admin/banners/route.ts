import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { featureUnavailable } from '@/lib/env';
import { ok, badRequest, serverError, readJson } from '@/lib/api';
import { normalizeBanners } from '@/lib/banner';

export const dynamic = 'force-dynamic';

const SETTING_ID = 'announcement_banners';

/** site_settings arrives with 0004. Say that rather than "relation does not exist". */
const missingTable = (error: { code?: string; message?: string }): boolean =>
  error.code === '42P01' ||
  error.code === 'PGRST205' ||
  /does not exist|schema cache/i.test(error.message ?? '');

const SETUP_MESSAGE =
  'The announcement banner needs a database update that has not been run yet. ' +
  'Open the Supabase SQL editor and run supabase/migrations/0004_storefront.sql, then reload.';

/**
 * The announcement strip shown above the storefront header.
 *
 *   GET  /api/admin/banners           what is currently saved
 *   POST /api/admin/banners  { banners: Banner[] }
 *
 * Stored as one JSON array in site_settings, which the public site reads with
 * the anon key. Writes come through here so only an administrator can change
 * what every visitor sees.
 */

export async function GET(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('site_settings')
      .select('value, updated_at')
      .eq('id', SETTING_ID)
      .maybeSingle();

    if (error) return serverError(missingTable(error) ? SETUP_MESSAGE : error.message);

    return ok({
      banners: normalizeBanners(data?.value),
      updatedAt: data?.updated_at ?? null,
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}

export async function POST(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const body = await readJson<{ banners?: unknown }>(req);
  if (!body || !Array.isArray(body.banners)) {
    return badRequest('Send a "banners" array.');
  }

  // Normalising here rather than trusting the form means a banner can only
  // ever carry plain text and a safe link, whatever was posted.
  const banners = normalizeBanners(body.banners);

  try {
    const { error } = await getSupabaseAdmin()
      .from('site_settings')
      .upsert({ id: SETTING_ID, value: banners, updated_at: new Date().toISOString() });

    if (error) return serverError(missingTable(error) ? SETUP_MESSAGE : error.message);

    return ok({ banners });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
