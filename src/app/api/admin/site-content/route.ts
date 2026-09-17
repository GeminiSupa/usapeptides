import { revalidateTag } from 'next/cache';
import { requireAdmin } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { featureUnavailable } from '@/lib/env';
import { isOwnMediaUrl } from '@/lib/media';
import { writeAudit } from '@/lib/audit';
import { ok, badRequest, serverError, readJson } from '@/lib/api';
import { CONTENT_FIELDS, DEFAULT_CONTENT, SITE_CONTENT_ID, mergeContent, sanitizeContent } from '@/lib/siteContent';
import { SITE_CONTENT_TAG } from '@/lib/siteContentServer';

export const dynamic = 'force-dynamic';

/**
 * Website text, contact details, FAQ and SEO.
 *
 *   GET  /api/admin/site-content            saved values merged over defaults
 *   POST /api/admin/site-content  { values }  save the changed keys
 *
 * Only keys the registry knows are stored, links must be safe, and images must
 * be files we host. Saving clears the site's cached copy.
 */

async function authorize(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return { response: unavailable } as const;
  const auth = await requireAdmin(req, { permission: 'storefront' });
  return auth.ok ? ({ auth } as const) : ({ response: auth.response } as const);
}

async function readStored() {
  const { data, error } = await getSupabaseAdmin().from('site_settings').select('value, updated_at').eq('id', SITE_CONTENT_ID).maybeSingle();
  if (error) throw new Error(/does not exist|schema cache/i.test(error.message) ? 'Run migration 0004_storefront.sql, then reload.' : error.message);
  return { stored: (data?.value ?? {}) as Record<string, string>, updatedAt: data?.updated_at ?? null };
}

export async function GET(req: Request) {
  const access = await authorize(req);
  if ('response' in access) return access.response;
  try {
    const { stored, updatedAt } = await readStored();
    return ok({ values: mergeContent(stored), defaults: DEFAULT_CONTENT, customised: Object.keys(stored), updatedAt });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}

export async function POST(req: Request) {
  const access = await authorize(req);
  if ('response' in access) return access.response;

  const body = await readJson<{ values?: unknown; reset?: string[] }>(req);
  if (!body) return badRequest('Send the values to save.');

  const { values, errors } = sanitizeContent(body.values);
  for (const [key, value] of Object.entries(values)) {
    if (CONTENT_FIELDS.get(key)?.type === 'image' && value && !value.startsWith('/') && !isOwnMediaUrl(value)) {
      errors[key] = 'Upload the image with the button.';
      delete values[key];
    }
  }
  if (Object.keys(errors).length) return badRequest('Some fields need fixing.', errors);

  try {
    const { stored } = await readStored();
    const next: Record<string, string> = { ...stored, ...values };
    // A value equal to the default is not stored, so a later change to the
    // default (a new template version) still reaches this site.
    for (const key of Object.keys(next)) {
      if (!(key in DEFAULT_CONTENT) || next[key] === DEFAULT_CONTENT[key]) delete next[key];
    }
    for (const key of Array.isArray(body.reset) ? body.reset : []) delete next[String(key)];

    const { error } = await getSupabaseAdmin()
      .from('site_settings')
      .upsert({ id: SITE_CONTENT_ID, value: next }, { onConflict: 'id' });
    if (error) return serverError(error.message);

    revalidateTag(SITE_CONTENT_TAG);

    const changed = Object.keys(values).filter((k) => (stored[k] ?? DEFAULT_CONTENT[k]) !== values[k]);
    if (changed.length || body.reset?.length) {
      await writeAudit(access.auth.admin, {
        action: 'content.update',
        targetType: 'site_content',
        targetLabel: `${changed.length} field(s) changed`,
        detail: { changed: changed.slice(0, 50), reset: body.reset ?? [] },
      });
    }

    return ok({ values: mergeContent(next), customised: Object.keys(next) });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
