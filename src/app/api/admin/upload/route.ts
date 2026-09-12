import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { featureUnavailable } from '@/lib/env';
import { ok, badRequest, serverError } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Product images and certificate PDFs, uploaded through the server.
 *
 * The browser cannot put files in the bucket itself: that would need the anon
 * key to hold write access, and the anon key ships inside every page, so the
 * bucket would be writable by anyone on the internet. Uploading here with the
 * service role keeps writes behind an administrator session while the bucket
 * stays publicly *readable*, which is what lets a customer open a certificate.
 *
 *   POST /api/admin/upload   multipart form: file=<File>  kind=image|coa
 *   -> { url, path, bytes }
 */

const BUCKET = 'product-media';

/** Matches the bucket's own file_size_limit set in 0004_storefront.sql. */
const MAX_MB = 2;
const MAX_BYTES = MAX_MB * 1024 * 1024;

const KINDS = {
  image: {
    folder: 'products',
    types: new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/svg+xml']),
    label: 'a JPG, PNG, WEBP, AVIF, GIF or SVG image',
  },
  coa: {
    folder: 'coa',
    types: new Set(['application/pdf']),
    label: 'a PDF certificate',
  },
} as const;

type Kind = keyof typeof KINDS;

/**
 * A year. Supabase defaults to an hour, which makes every visitor re-download
 * every product image hourly. Safe to cache this hard because each upload gets
 * a fresh timestamped path, so a replacement is a new URL and nobody is ever
 * served a stale file. Never reuse a path for different content.
 */
const CACHE_SECONDS = '31536000';

const slugifyName = (name: string) =>
  name
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'file';

export async function POST(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return badRequest('Send the file as multipart form data.');
  }

  const file = form.get('file');
  const kind = String(form.get('kind') ?? 'image') as Kind;

  if (!(file instanceof File)) return badRequest('No file was received.');
  if (!(kind in KINDS)) return badRequest('Upload kind must be "image" or "coa".');

  const rules = KINDS[kind];

  if (file.type && !rules.types.has(file.type)) {
    return badRequest(`${file.type || 'That file'} will not work here. Upload ${rules.label}.`);
  }

  if (file.size === 0) return badRequest('That file is empty.');

  if (file.size > MAX_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return badRequest(
      `That file is ${mb} MB and the limit is ${MAX_MB} MB. Compress or resize it and try again.`
    );
  }

  const extension = (file.name.split('.').pop() ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const path = `${rules.folder}/${slugifyName(file.name)}-${stamp}${extension ? `.${extension}` : ''}`;

  try {
    const db = getSupabaseAdmin();

    const { error } = await db.storage
      .from(BUCKET)
      .upload(path, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type || (kind === 'coa' ? 'application/pdf' : 'image/jpeg'),
        cacheControl: CACHE_SECONDS,
        upsert: false,
      });

    if (error) {
      // Passed through as-is. A guessed message is what makes storage problems
      // hard to diagnose - "bucket not found" needs to say exactly that.
      const missing = /bucket/i.test(error.message) && /not found/i.test(error.message);
      return serverError(
        missing
          ? `The "${BUCKET}" storage bucket does not exist yet. Run supabase/migrations/0004_storefront.sql.`
          : error.message
      );
    }

    const { data } = db.storage.from(BUCKET).getPublicUrl(path);
    return ok({ url: data.publicUrl, path, bytes: file.size });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}

// There is deliberately no DELETE. Replacing a file leaves the old one in
// storage: a delete button next to a product grid means one mis-click destroys
// an image for good, including for anything else still pointing at that URL.
