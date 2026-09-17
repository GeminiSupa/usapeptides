/**
 * Prospector: turning a map search into businesses worth contacting.
 *
 * Ported from the reference project's approach, rewritten for a US research
 * supplier. Searches use OpenStreetMap — Nominatim for names and places,
 * Overpass for "every pharmacy in this area" — which is free, unlike Google
 * Places. Shared by the search route and the dashboard, so it imports nothing
 * server-only.
 */

export const PROSPECT_STAGES = [
  { id: 'identified', label: 'New' },
  { id: 'qualified', label: 'Qualified' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'responded', label: 'Replied' },
  { id: 'meeting', label: 'Meeting' },
  { id: 'proposal', label: 'Proposal sent' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' },
  { id: 'do_not_contact', label: 'Do not contact' },
] as const;

export type ProspectStage = (typeof PROSPECT_STAGES)[number]['id'];
export const STAGE_IDS = new Set<string>(PROSPECT_STAGES.map((s) => s.id));
export const stageLabel = (id: string) => PROSPECT_STAGES.find((s) => s.id === id)?.label ?? id;

/** A business as the search returns it and the pipeline stores it. */
export interface ProspectPlace {
  source_provider: string;
  source_external_id: string | null;
  company: string;
  category: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  formatted_address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  map_url: string | null;
  fit_score: number;
  fit_reasons: string[];
  relevance?: number;
}

/* ------------------------------------------------------------ searches --- */

export interface SearchProfile {
  id: string;
  label: string;
  /** Words people type that mean this profile. */
  match: RegExp;
  /** OpenStreetMap tags: [key, exact values]. */
  tags: [string, string[]][];
  /** Regex on the business name, used inside a city-sized area only. */
  names: string;
  /** Points added to the fit score for this kind of business. */
  fit: number;
}

/**
 * Ordered from most specific to broadest: the first match wins.
 *
 * Fit points follow the storefront's own terms of sale — laboratory research
 * buyers — so research institutions score highest. Other business types can
 * still be searched; they simply rank lower.
 */
export const SEARCH_PROFILES: SearchProfile[] = [
  { id: 'compounding', label: 'Compounding pharmacies', match: /compound/, fit: 35,
    tags: [['healthcare', ['pharmacy']], ['amenity', ['pharmacy']]], names: 'compounding|apothecary' },
  { id: 'research_lab', label: 'Research labs', match: /(laborator|research|lab\b|labs\b)/, fit: 65,
    tags: [['amenity', ['research_institute', 'laboratory']], ['healthcare', ['laboratory']], ['office', ['research']]], names: 'laborator|research|biolog|scien' },
  { id: 'university', label: 'Universities', match: /(universit|college|campus)/, fit: 60,
    tags: [['amenity', ['university', 'college']]], names: 'university|college|institute' },
  { id: 'biotech', label: 'Biotech companies', match: /(biotech|pharmaceutic|life science|biopharm)/, fit: 60,
    tags: [['office', ['research', 'company']], ['industrial', ['pharmaceutical']]], names: 'bio|pharma|therapeutic|scien' },
  { id: 'medspa', label: 'Med spas & aesthetics', match: /(med ?spa|aesthetic|esthetic|botox|cosmetic|beauty)/, fit: 25,
    tags: [['healthcare', ['clinic']], ['shop', ['beauty', 'cosmetics']], ['leisure', ['spa']]], names: 'med ?spa|aesthetic|esthetic|laser|skin|botox' },
  { id: 'longevity', label: 'Longevity & anti-aging clinics', match: /(longevity|anti.?aging|hormone|trt|iv therapy|regenerative|functional medicine)/, fit: 25,
    tags: [['healthcare', ['clinic', 'alternative']]], names: 'longevity|anti.?aging|hormone|regenerative|wellness|vitality|iv |optimal' },
  { id: 'weight_loss', label: 'Weight-loss clinics', match: /(weight|slim|obesity|bariatric|diet)/, fit: 25,
    tags: [['healthcare', ['clinic', 'dietitian', 'nutrition_counselling']]], names: 'weight|slim|bariatric|diet|medical weight' },
  { id: 'sports_medicine', label: 'Sports medicine & physio', match: /(sports? med|physio|physical therap|chiropract|rehab|recovery)/, fit: 25,
    tags: [['healthcare', ['physiotherapist', 'rehabilitation']], ['healthcare:speciality', ['sports_medicine', 'chiropractic']]], names: 'sports|physio|physical therapy|chiropractic|rehab|recovery' },
  { id: 'pharmacy', label: 'Pharmacies', match: /(pharmac|drugstore|chemist)/, fit: 30,
    tags: [['amenity', ['pharmacy']], ['healthcare', ['pharmacy']], ['shop', ['chemist', 'medical_supply']]], names: 'pharmacy|drug|apothecary' },
  { id: 'supplements', label: 'Supplement & nutrition stores', match: /(supplement|nutrition|vitamin|health food)/, fit: 25,
    tags: [['shop', ['nutrition_supplements', 'health_food', 'herbalist']]], names: 'supplement|nutrition|vitamin|gnc' },
  { id: 'gym', label: 'Gyms & fitness', match: /(gym|fitness|crossfit|personal train|bodybuild)/, fit: 15,
    tags: [['leisure', ['fitness_centre']], ['sport', ['fitness', 'bodybuilding', 'weightlifting', 'crossfit']]], names: 'gym|fitness|crossfit|barbell|strength' },
  { id: 'veterinary', label: 'Veterinary practices', match: /(veterinar|animal hospital|\bvet\b)/, fit: 40,
    tags: [['amenity', ['veterinary']], ['healthcare', ['veterinary']]], names: 'veterinar|animal hospital|pet clinic' },
  { id: 'wellness', label: 'Wellness centers', match: /(wellness|holistic|spa\b|naturopath)/, fit: 20,
    tags: [['leisure', ['spa']], ['healthcare', ['alternative']]], names: 'wellness|holistic|naturopath|integrative' },
  { id: 'clinic', label: 'Medical clinics', match: /(clinic|doctor|medical|physician|urgent care)/, fit: 25,
    tags: [['amenity', ['clinic', 'doctors']], ['healthcare', ['clinic', 'doctor', 'centre']]], names: 'clinic|medical|health|family practice' },
];

export const profileFor = (query: string): SearchProfile | null => {
  const q = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return SEARCH_PROFILES.find((p) => p.match.test(q)) ?? null;
};

/* ------------------------------------------------------------- scoring --- */

const TARGET_WORDS = [
  'compounding', 'apothecary', 'laborator', 'research', 'universit', 'college', 'biotech', 'pharma', 'scien',
  'med spa', 'medspa', 'aesthetic', 'esthetic', 'longevity', 'anti aging', 'hormone', 'regenerative', 'wellness',
  'weight', 'bariatric', 'sports', 'physio', 'chiropract', 'rehab', 'pharmacy', 'supplement', 'nutrition',
  'fitness', 'gym', 'crossfit', 'clinic', 'medical', 'doctor', 'veterinar', 'spa', 'integrative', 'functional',
];

const flat = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Commercial fit only, 0–100. Whether we are allowed or able to contact them
 * is a separate question and never raises this number.
 */
export function scorePlace(p: Partial<ProspectPlace>, profile?: SearchProfile | null): { score: number; reasons: string[] } {
  let score = 5;
  const reasons: string[] = [];
  const text = `${flat(p.category)} ${flat(p.company)}`;

  const byProfile = SEARCH_PROFILES.find((sp) => sp.id === profile?.id) ?? SEARCH_PROFILES.find((sp) => sp.match.test(text));
  if (byProfile) {
    score += byProfile.fit;
    reasons.push(byProfile.label);
  } else if (TARGET_WORDS.some((w) => text.includes(w))) {
    score += 35;
    reasons.push('Related business');
  }
  if (p.website) { score += 10; reasons.push('Has a website'); }
  if (p.phone || p.whatsapp) { score += 8; reasons.push('Phone listed'); }
  if (p.email) { score += 10; reasons.push('Email listed'); }
  if (p.city || p.formatted_address) { score += 5; reasons.push('Address known'); }

  return { score: Math.min(100, score), reasons: reasons.slice(0, 5) };
}

export const FIT_BANDS = [
  { min: 70, label: 'Strong fit', tone: 'high' },
  { min: 45, label: 'Good fit', tone: 'medium' },
  { min: 0, label: 'Weak fit', tone: 'low' },
] as const;

export const fitBand = (score: number) => FIT_BANDS.find((b) => Number(score || 0) >= b.min) ?? FIT_BANDS[2];

/* --------------------------------------------------------- normalising --- */

const clean = (v: unknown, max = 500) => String(v ?? '').trim().slice(0, max);

export function normalizeUrl(value: unknown): string | null {
  const raw = clean(value, 1000);
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

const coordinate = (v: unknown, limit: number) => {
  const n = Number(v);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
};

export const osmLink = (lat: number | null, lon: number | null) =>
  lat != null && lon != null ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=18/${lat}/${lon}` : null;

type Tags = Record<string, string | undefined>;

function fromTags(tags: Tags, base: {
  id: string | null; name: unknown; lat: unknown; lon: unknown; address: string; city?: unknown; region?: unknown; country?: unknown;
}, profile: SearchProfile | null): ProspectPlace {
  const latitude = coordinate(base.lat, 90);
  const longitude = coordinate(base.lon, 180);
  const category = clean(
    [tags['healthcare:speciality'], tags.healthcare, tags.amenity, tags.leisure, tags.shop, tags.office, tags.sport, tags.industrial]
      .find((v) => v && v !== 'yes'),
    160
  ).replace(/_/g, ' ') || null;
  const place: ProspectPlace = {
    source_provider: 'openstreetmap',
    source_external_id: base.id,
    company: clean(base.name, 240),
    category,
    website: normalizeUrl(tags.website || tags['contact:website'] || tags.url),
    phone: clean(tags.phone || tags['contact:phone'] || tags['contact:mobile'], 80) || null,
    email: clean(tags.email || tags['contact:email'], 240).toLowerCase() || null,
    whatsapp: clean(tags['contact:whatsapp'] || tags.whatsapp, 80) || null,
    formatted_address: clean(base.address, 500) || null,
    city: clean(base.city, 140) || null,
    region: clean(base.region, 140) || null,
    country: clean(base.country, 140) || null,
    latitude,
    longitude,
    map_url: osmLink(latitude, longitude),
    fit_score: 0,
    fit_reasons: [],
  };
  const scored = scorePlace(place, profile);
  place.fit_score = scored.score;
  place.fit_reasons = scored.reasons;
  return place;
}

/** One Nominatim search result. */
export function fromNominatim(item: Record<string, any>, profile: SearchProfile | null): ProspectPlace {
  const a = item.address ?? {};
  const tags: Tags = { ...(item.extratags ?? {}) };
  if (!tags.amenity && !tags.shop && !tags.healthcare && item.type && item.type !== 'yes') tags.amenity = String(item.type);
  return fromTags(tags, {
    id: item.osm_type && item.osm_id ? `${item.osm_type}:${item.osm_id}` : item.place_id ? `place:${item.place_id}` : null,
    name: item.namedetails?.name || item.name || String(item.display_name ?? '').split(',')[0],
    lat: item.lat,
    lon: item.lon,
    address: item.display_name,
    city: a.city || a.town || a.village || a.hamlet || a.county,
    region: a.state,
    country: a.country,
  }, profile);
}

/** One Overpass element. */
export function fromOverpass(el: Record<string, any>, profile: SearchProfile | null, area?: { region?: string | null; country?: string | null }): ProspectPlace {
  const t: Tags = el.tags ?? {};
  const city = t['addr:city'] || t['addr:town'] || t['addr:village'];
  const street = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ');
  return fromTags(t, {
    id: el.type && el.id ? `${el.type}:${el.id}` : null,
    name: t.name || t.brand || t.operator,
    lat: el.lat ?? el.center?.lat,
    lon: el.lon ?? el.center?.lon,
    address: [street, city, t['addr:state'] || area?.region, t['addr:postcode']].filter(Boolean).join(', '),
    city,
    region: t['addr:state'] || area?.region,
    country: t['addr:country'] || area?.country,
  }, profile);
}

/** Merge duplicates (the two searches often find the same place) and rank. */
export function rankPlaces(places: ProspectPlace[], query: string, limit = 100): ProspectPlace[] {
  const tokens = flat(query).split(' ').filter((t) => t.length >= 3);
  const byKey = new Map<string, ProspectPlace>();
  for (const p of places) {
    if (!p.company || p.latitude == null || p.longitude == null) continue;
    const key = p.source_external_id ?? `${flat(p.company)}:${p.latitude.toFixed(4)}:${p.longitude.toFixed(4)}`;
    const text = `${flat(p.company)} ${flat(p.category)}`;
    const relevance = tokens.reduce((s, t) => s + (text.includes(t) ? 12 : 0), 0)
      + (p.website ? 6 : 0) + (p.phone ? 5 : 0) + (p.email ? 8 : 0) + p.fit_score;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...p, relevance });
    } else {
      // Keep the richer record, but never lose a contact detail either had.
      const better = relevance > (existing.relevance ?? 0) ? p : existing;
      const other = better === p ? existing : p;
      byKey.set(key, {
        ...better,
        website: better.website ?? other.website,
        phone: better.phone ?? other.phone,
        email: better.email ?? other.email,
        whatsapp: better.whatsapp ?? other.whatsapp,
        relevance: Math.max(relevance, existing.relevance ?? 0),
      });
    }
  }
  return Array.from(byKey.values())
    .sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0) || a.company.localeCompare(b.company))
    .slice(0, limit);
}

/** A bounding box the map can ask for. Too large an area is refused. */
export interface Bbox { south: number; west: number; north: number; east: number }
export const MAX_BBOX_DEGREES = 4; // about a large metro area; a whole state is too much for Overpass

export function normalizeBbox(input: unknown): Bbox | null {
  if (!input || typeof input !== 'object') return null;
  const b = input as Record<string, unknown>;
  const south = coordinate(b.south, 90);
  const north = coordinate(b.north, 90);
  const west = coordinate(b.west, 180);
  const east = coordinate(b.east, 180);
  if (south == null || north == null || west == null || east == null) return null;
  if (south >= north || west >= east) return null;
  if ((north - south) * (east - west) > MAX_BBOX_DEGREES) return null;
  return { south, west, north, east };
}

/* ------------------------------------------------------------ outreach --- */

export const OUTREACH_TEMPLATES = [
  {
    id: 'intro',
    label: 'Introduction',
    subject: 'Research peptides for {company}',
    body:
      'Hi {company} team,\n\nI am {sender} from {business}. We supply HPLC-tested peptides for in-vitro laboratory research, with a certificate of analysis for every lot, shipped from the US.\n\nWould it help if I sent over our catalogue and wholesale pricing?\n\nThanks,\n{sender}\n{business}',
  },
  {
    id: 'wholesale',
    label: 'Wholesale offer',
    subject: 'Wholesale pricing for {company}',
    body:
      'Hi {company} team,\n\n{business} offers tiered pricing for laboratories buying research peptides in volume, with test reports published for every batch. All products are sold for in-vitro research use only. I would be glad to set up a trade account for you.\n\nWhat is the best way to share the price list?\n\n{sender}',
  },
  {
    id: 'follow_up',
    label: 'Follow-up',
    subject: 'Following up — {business}',
    body: 'Hi {company} team,\n\nJust following up on my earlier message about research peptides from {business}. Happy to answer any questions.\n\n{sender}',
  },
];

export function fillTemplate(text: string, values: Record<string, string>) {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');
}
