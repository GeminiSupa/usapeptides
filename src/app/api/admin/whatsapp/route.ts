import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { featureUnavailable } from '@/lib/env';
import { ok, badRequest, serverError, readJson } from '@/lib/api';
import {
  WHATSAPP_SETTING_ID,
  cleanWhatsAppNumber,
  isValidWhatsAppNumber,
  normalizeWhatsApp,
} from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

/**
 * The "Order on WhatsApp" number.
 *
 *   GET  /api/admin/whatsapp
 *   POST /api/admin/whatsapp  { number, enabled }
 *
 * Stored in site_settings next to the announcement bar; the storefront reads
 * it with the anon key.
 */

export async function GET(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('site_settings')
      .select('value')
      .eq('id', WHATSAPP_SETTING_ID)
      .maybeSingle();
    if (error) return serverError(error.message);
    return ok({ whatsapp: normalizeWhatsApp(data?.value) });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}

export async function POST(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const body = await readJson<{ number?: unknown; enabled?: unknown }>(req);
  if (!body) return badRequest('Send a number and whether it is switched on.');

  const number = cleanWhatsAppNumber(body.number);
  const enabled = body.enabled === true;
  if (number && !isValidWhatsAppNumber(number)) {
    return badRequest('That does not look like a full phone number. Include the country code, e.g. +1 555 123 4567.');
  }
  if (enabled && !number) {
    return badRequest('Add a WhatsApp number before switching the button on.');
  }

  const value = { number, enabled };
  try {
    const { error } = await getSupabaseAdmin()
      .from('site_settings')
      .upsert({ id: WHATSAPP_SETTING_ID, value, updated_at: new Date().toISOString() });
    if (error) return serverError(error.message);
    return ok({ whatsapp: normalizeWhatsApp(value) });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
