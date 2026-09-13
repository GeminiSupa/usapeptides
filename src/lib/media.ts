import { supabaseEnv } from './env';

/**
 * Where uploaded files live, and how to tell a URL we issued from one somebody
 * typed in.
 *
 * Any column that stores a picture shown to other people should only hold a URL
 * from our own bucket. A pasted link could point anywhere: a tracking pixel, an
 * image swapped for something else later, or a host that logs who viewed it.
 */

export const MEDIA_BUCKET = 'product-media';

export function isOwnMediaUrl(value: string, folder?: string): boolean {
  if (!supabaseEnv.url) return false;

  let url: URL;
  let base: URL;
  try {
    url = new URL(value);
    base = new URL(supabaseEnv.url);
  } catch {
    return false;
  }

  if (url.origin !== base.origin) return false;
  if (url.pathname.includes('..')) return false;

  const prefix = `/storage/v1/object/public/${MEDIA_BUCKET}/${folder ? `${folder.replace(/\/+$/, '')}/` : ''}`;
  return url.pathname.startsWith(prefix);
}
