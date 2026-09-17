import { requireAdmin } from '@/lib/adminAuth';
import { BUSINESS, mapsEnv } from '@/lib/env';
import { badRequest, readJson } from '@/lib/api';
import {
  MAX_BBOX_DEGREES, fromNominatim, fromOverpass, normalizeBbox, profileFor, rankPlaces,
  type Bbox, type ProspectPlace, type SearchProfile,
} from '@/lib/prospector';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/admin/prospects/search  { query, location?, bbox? }
 *
 * Finds businesses on OpenStreetMap. Two lookups run side by side:
 *   Nominatim  places whose name matches ("Acme Compounding Pharmacy")
 *   Overpass   every place tagged as that kind of business inside the area
 *
 * The answer is newline-delimited JSON so the list can fill in as each half
 * arrives: Nominatim answers in a second, Overpass can take twenty.
 * Nothing is saved here — saving is a separate, deliberate step.
 */

const USER_AGENT = `${BUSINESS.name.replace(/[^\w ]/g, '')}Prospector/1.0 (${BUSINESS.domain})`;
const OVERPASS_BUDGET_MS = 40_000;

/* Nominatim allows one request a second. Queue them per server instance. */
let nominatimQueue: Promise<unknown> = Promise.resolve();

function nominatim(params: Record<string, string>): Promise<Record<string, any>[]> {
  const url = new URL(mapsEnv.nominatimUrl);
  for (const [k, v] of Object.entries({ format: 'jsonv2', addressdetails: '1', extratags: '1', namedetails: '1', dedupe: '1', ...params })) {
    url.searchParams.set(k, v);
  }
  const run = async () => {
    await new Promise((r) => setTimeout(r, 1050));
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
      headers: { Accept: 'application/json', 'Accept-Language': 'en', 'User-Agent': USER_AGENT },
    });
    if (!res.ok) throw new Error(`Nominatim returned ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  };
  const next = nominatimQueue.then(run, run);
  nominatimQueue = next.catch(() => undefined);
  return next;
}

const escapeRegex = (v: string) => v.replace(/["\\\n\r]/g, ' ').replace(/[.*+?^${}()|[\]]/g, '\\$&').trim();

function overpassQuery(profile: SearchProfile | null, query: string, box: Bbox): string | null {
  const scope = `(${box.south},${box.west},${box.north},${box.east})`;
  const clauses: string[] = [];
  for (const [key, values] of profile?.tags ?? []) {
    for (const value of values) clauses.push(`nwr["${key}"="${value}"]${scope};`);
  }
  // Name matching is a regex scan, so only inside a city-sized box.
  const area = (box.north - box.south) * (box.east - box.west);
  const names = profile ? profile.names : escapeRegex(query);
  if (names && area <= MAX_BBOX_DEGREES / 4) clauses.push(`nwr["name"~"${names}",i]${scope};`);
  if (!clauses.length) return null;
  return `[out:json][timeout:40];(${clauses.join('')});out tags center 150;`;
}

async function overpass(query: string): Promise<Record<string, any>[]> {
  const deadline = Date.now() + OVERPASS_BUDGET_MS;
  let lastError: Error = new Error('Overpass could not be reached');
  for (const endpoint of mapsEnv.overpassUrls) {
    const remaining = deadline - Date.now();
    if (remaining < 5_000) break;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        cache: 'no-store',
        signal: AbortSignal.timeout(Math.min(remaining, 27_000)),
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', 'User-Agent': USER_AGENT },
        body: new URLSearchParams({ data: query }),
      });
      if (!res.ok) {
        lastError = new Error(`Overpass returned ${res.status}`);
        // A malformed query fails on every mirror; only busy/down is worth retrying.
        if (![429, 502, 503, 504].includes(res.status)) break;
        continue;
      }
      const payload = await res.json();
      return Array.isArray(payload.elements) ? payload.elements : [];
    } catch (err) {
      lastError = err instanceof Error ? err : lastError;
    }
  }
  throw lastError;
}

interface Area { box: Bbox; label: string | null; region: string | null; country: string | null; tooLarge: boolean }

function areaFromPlace(place: Record<string, any>): Area | null {
  const b = (place.boundingbox ?? []).map(Number);
  if (b.length !== 4 || !b.every(Number.isFinite)) return null;
  const box = { south: b[0], north: b[1], west: b[2], east: b[3] };
  const size = (box.north - box.south) * (box.east - box.west);
  return {
    box,
    label: place.display_name ?? null,
    region: place.address?.state ?? null,
    country: place.address?.country ?? null,
    tooLarge: size > MAX_BBOX_DEGREES,
  };
}

async function* search(query: string, location: string, bbox: Bbox | null): AsyncGenerator<Record<string, unknown>> {
  const profile = profileFor(query);
  const warnings: string[] = [];
  let area: Area | null = bbox ? { box: bbox, label: 'the visible map area', region: null, country: null, tooLarge: false } : null;

  if (!area && location) {
    try {
      const [place] = await nominatim({ q: location, limit: '1' });
      area = place ? areaFromPlace(place) : null;
      if (!area) warnings.push(`We could not find "${location}". Showing matches from anywhere.`);
    } catch {
      warnings.push('The location lookup is busy. Showing matches from anywhere.');
    }
  }

  const center = area ? { latitude: (area.box.north + area.box.south) / 2, longitude: (area.box.east + area.box.west) / 2 } : null;
  const categorySearch = Boolean(area && !area.tooLarge && (profile || query));
  if (area?.tooLarge) warnings.push('That area is very large, so only businesses matching by name are shown. Search a city or zoom the map in for everything.');

  yield { type: 'meta', profile: profile?.label ?? null, area: area?.label ?? null, center, box: area?.box ?? null, categorySearch };

  const namedParams: Record<string, string> = { q: area ? query : [query, location].filter(Boolean).join(' '), limit: '40' };
  if (area) {
    namedParams.viewbox = [area.box.west, area.box.north, area.box.east, area.box.south].join(',');
    namedParams.bounded = '1';
  }
  const named = nominatim(namedParams);
  const oq = categorySearch && area ? overpassQuery(profile, query, area.box) : null;
  const tagged = oq ? overpass(oq) : Promise.resolve([]);
  // Observe both now, so a failure that lands while the other is awaited is
  // not an unhandled rejection.
  named.catch(() => undefined);
  tagged.catch(() => undefined);

  let places: ProspectPlace[] = [];
  try {
    places = (await named).filter((i) => i.category !== 'boundary' && i.category !== 'place' && i.type !== 'parking').map((i) => fromNominatim(i, profile));
    if (places.length) yield { type: 'partial', prospects: rankPlaces(places, query) };
  } catch {
    warnings.push('The name search is busy right now.');
  }

  try {
    const elements = await tagged;
    places = places.concat(elements.map((el) => fromOverpass(el, profile, { region: area?.region, country: area?.country })));
  } catch {
    if (oq) warnings.push('The business-type search is busy on every server. Showing name matches only — try again in a minute.');
  }

  yield { type: 'complete', prospects: rankPlaces(places, query), warnings };
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const body = await readJson<{ query?: string; location?: string; bbox?: unknown }>(req);
  const query = String(body?.query ?? '').trim().slice(0, 120);
  const location = String(body?.location ?? '').trim().slice(0, 120);
  if (query.length < 2) return badRequest('Type the kind of business to look for.');
  const bbox = body?.bbox ? normalizeBbox(body.bbox) : null;
  if (body?.bbox && !bbox) return badRequest('That map area is too large. Zoom in and try again.');
  if (!bbox && !location) return badRequest('Type a city or area, or search the visible map.');

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of search(query, location, bbox)) {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        }
      } catch (err) {
        console.error('[prospector] search failed', err);
        controller.enqueue(encoder.encode(`${JSON.stringify({ type: 'error', message: 'The map search failed. Try a smaller area or try again shortly.' })}\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store, no-transform' },
  });
}
