import 'server-only';

import { supabaseEnv } from './env';
import { SITE_CONTENT_ID, mergeContent, type SiteContent } from './siteContent';

/**
 * Website content for server-rendered pages and metadata.
 *
 * Read with the public key, exactly as a visitor could, and cached for a
 * minute. Saving in the dashboard clears the cache through the tag, so a change
 * shows on the next page load rather than a minute later.
 */

export const SITE_CONTENT_TAG = 'site-content';

export async function getSiteContent(): Promise<SiteContent> {
  if (!supabaseEnv.url || !supabaseEnv.anonKey) return mergeContent(null);
  try {
    const res = await fetch(
      `${supabaseEnv.url}/rest/v1/site_settings?id=eq.${SITE_CONTENT_ID}&select=value`,
      {
        headers: { apikey: supabaseEnv.anonKey, Authorization: `Bearer ${supabaseEnv.anonKey}` },
        next: { revalidate: 60, tags: [SITE_CONTENT_TAG] },
      }
    );
    if (!res.ok) return mergeContent(null);
    const rows = (await res.json()) as { value: unknown }[];
    return mergeContent(rows[0]?.value);
  } catch {
    return mergeContent(null);
  }
}

/** Published articles for the sitemap and blog metadata, same caching. */
export const ARTICLES_TAG = 'articles';

export async function publicRest<T>(path: string, tags: string[]): Promise<T | null> {
  if (!supabaseEnv.url || !supabaseEnv.anonKey) return null;
  try {
    const res = await fetch(`${supabaseEnv.url}/rest/v1/${path}`, {
      headers: { apikey: supabaseEnv.anonKey, Authorization: `Bearer ${supabaseEnv.anonKey}` },
      next: { revalidate: 300, tags },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
