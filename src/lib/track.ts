'use client';

/**
 * The storefront's side of visitor analytics. Anonymous random ids only —
 * a visitor id kept for a year, and a visit id that lasts until the visitor
 * has been idle for 30 minutes.
 */

const VISITOR_KEY = 'upd_vid';
const SESSION_KEY = 'upd_sid';
const IDLE_MS = 30 * 60_000;

const newId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9]/g, '');

function store(key: string, make: () => string, session = false): string {
  try {
    const box = session ? sessionStorage : localStorage;
    let value = box.getItem(key);
    if (!value) { value = make(); box.setItem(key, value); }
    return value;
  } catch {
    return make();
  }
}

export function visitorId() {
  return store(VISITOR_KEY, newId);
}

/** The visit id, renewed after 30 minutes of nothing. */
export function sessionId() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    const [id, last] = (raw ?? '').split('.');
    const now = Date.now();
    const fresh = id && Number(last) && now - Number(last) < IDLE_MS ? id : newId();
    localStorage.setItem(SESSION_KEY, `${fresh}.${now}`);
    return fresh;
  } catch {
    return store(SESSION_KEY, newId, true);
  }
}

export function track(type: 'page_view' | 'heartbeat' | 'add_to_cart' | 'cart' | 'interaction', data: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return;
  if (location.pathname.startsWith('/admin')) return;
  const params = new URLSearchParams(location.search);
  try {
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        type,
        visitorId: visitorId(),
        sessionId: sessionId(),
        path: `${location.pathname}${location.search}`.slice(0, 300),
        title: document.title,
        referrer: document.referrer,
        utmSource: params.get('utm_source') ?? '',
        utmMedium: params.get('utm_medium') ?? '',
        utmCampaign: params.get('utm_campaign') ?? '',
        ...data,
      }),
    }).catch(() => undefined);
  } catch {
    // never let analytics break a page
  }
}
