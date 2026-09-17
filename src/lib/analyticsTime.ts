/**
 * Date ranges for the Dashboard and Analytics, in the business's own time zone
 * (BUSINESS.timezone), so "today" means the same day for everyone reading it,
 * wherever their laptop is.
 *
 * Shared by the browser and the server.
 */

import { BUSINESS } from './env';

export const RANGES = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: '90d', label: 'Last 90 days' },
  { id: '12m', label: 'Last 12 months' },
  { id: 'all', label: 'All time' },
  { id: 'custom', label: 'Custom dates' },
] as const;

export type RangeId = (typeof RANGES)[number]['id'];
export const RANGE_IDS = new Set<string>(RANGES.map((r) => r.id));
export const rangeLabel = (id: string) => RANGES.find((r) => r.id === id)?.label ?? id;

export interface Window {
  /** ISO instant, inclusive. Null means "since the beginning". */
  start: string | null;
  /** ISO instant, exclusive. */
  end: string;
  /** Day buckets for charts: 'day' up to ~120 days, then 'month'. */
  bucket: 'hour' | 'day' | 'month';
  label: string;
}

const DAY = 86_400_000;

/** Minutes the zone is ahead of UTC at that instant (negative in the Americas). */
function offsetMinutes(at: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** The calendar date (y, m, d) at that instant in the zone. */
export function zonedParts(at: Date, tz = BUSINESS.timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get('year'), m: get('month'), d: get('day') };
}

/** Midnight at the start of that calendar day in the zone, as a real instant. */
export function zonedMidnight(y: number, m: number, d: number, tz = BUSINESS.timezone): Date {
  const guess = new Date(Date.UTC(y, m - 1, d));
  const first = new Date(guess.getTime() - offsetMinutes(guess, tz) * 60_000);
  // Correct once more in case the offset changed across that day (DST).
  return new Date(guess.getTime() - offsetMinutes(first, tz) * 60_000);
}

/** YYYY-MM-DD of an instant in the zone — the key charts group by. */
export function dayKey(at: Date | string, tz = BUSINESS.timezone): string {
  const { y, m, d } = zonedParts(new Date(at), tz);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export const monthKey = (at: Date | string, tz = BUSINESS.timezone) => dayKey(at, tz).slice(0, 7);

export function resolveWindow(range: string, from?: string | null, to?: string | null, now = new Date()): Window {
  const { y, m, d } = zonedParts(now);
  const today = zonedMidnight(y, m, d);
  const tomorrow = zonedMidnight(y, m, d + 1);
  const end = now.toISOString();

  switch (range) {
    case 'today':
      return { start: today.toISOString(), end, bucket: 'hour', label: 'today' };
    case 'yesterday':
      return { start: zonedMidnight(y, m, d - 1).toISOString(), end: today.toISOString(), bucket: 'hour', label: 'yesterday' };
    case '7d':
      return { start: zonedMidnight(y, m, d - 6).toISOString(), end, bucket: 'day', label: 'the last 7 days' };
    case '30d':
      return { start: zonedMidnight(y, m, d - 29).toISOString(), end, bucket: 'day', label: 'the last 30 days' };
    case 'month':
      return { start: zonedMidnight(y, m, 1).toISOString(), end, bucket: 'day', label: 'this month' };
    case 'last_month':
      return { start: zonedMidnight(y, m - 1, 1).toISOString(), end: zonedMidnight(y, m, 1).toISOString(), bucket: 'day', label: 'last month' };
    case '90d':
      return { start: zonedMidnight(y, m, d - 89).toISOString(), end, bucket: 'day', label: 'the last 90 days' };
    case '12m':
      return { start: zonedMidnight(y - 1, m, d + 1).toISOString(), end, bucket: 'month', label: 'the last 12 months' };
    case 'custom': {
      const a = /^\d{4}-\d{2}-\d{2}$/.test(String(from)) ? String(from).split('-').map(Number) : null;
      const b = /^\d{4}-\d{2}-\d{2}$/.test(String(to)) ? String(to).split('-').map(Number) : null;
      if (a && b) {
        const start = zonedMidnight(a[0], a[1], a[2]);
        const stop = zonedMidnight(b[0], b[1], b[2] + 1);
        if (stop > start) {
          const days = (stop.getTime() - start.getTime()) / DAY;
          return {
            start: start.toISOString(),
            end: (stop < tomorrow ? stop : now).toISOString(),
            bucket: days <= 2 ? 'hour' : days > 120 ? 'month' : 'day',
            label: `${from} to ${to}`,
          };
        }
      }
      return resolveWindow('30d', null, null, now);
    }
    case 'all':
    default:
      return { start: null, end, bucket: 'month', label: 'all time' };
  }
}

/** The same length of time immediately before, for "vs previous period". */
export function previousWindow(w: Window): Window | null {
  if (!w.start) return null;
  const start = new Date(w.start).getTime();
  const length = new Date(w.end).getTime() - start;
  return {
    start: new Date(start - length).toISOString(),
    end: new Date(start).toISOString(),
    bucket: w.bucket,
    label: 'the period before',
  };
}

/** Every bucket key from start to end, so a chart shows empty days as zero. */
export function bucketKeys(w: Window, fallbackStart?: string | null): string[] {
  const startIso = w.start ?? fallbackStart;
  if (!startIso) return [];
  const keys: string[] = [];
  const end = new Date(w.end).getTime();
  if (w.bucket === 'hour') {
    for (let t = new Date(startIso).getTime(); t < end && keys.length < 72; t += 3_600_000) keys.push(hourKey(new Date(t)));
    return keys;
  }
  let { y, m, d } = zonedParts(new Date(startIso));
  for (let i = 0; i < 1000; i += 1) {
    const at = zonedMidnight(y, m, d);
    if (at.getTime() >= end) break;
    const key = w.bucket === 'month' ? monthKey(at) : dayKey(at);
    if (keys[keys.length - 1] !== key) keys.push(key);
    if (w.bucket === 'month') { m += 1; d = 1; } else d += 1;
    ({ y, m, d } = zonedParts(zonedMidnight(y, m, d)));
  }
  return keys;
}

export function hourKey(at: Date | string, tz = BUSINESS.timezone): string {
  const date = new Date(at);
  const hour = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(date);
  return `${dayKey(date, tz)}T${hour.padStart(2, '0')}`;
}

export function bucketOf(at: Date | string, bucket: Window['bucket']): string {
  return bucket === 'hour' ? hourKey(at) : bucket === 'month' ? monthKey(at) : dayKey(at);
}

/** How a bucket key reads on a chart axis. */
export function bucketLabel(key: string, bucket: Window['bucket']): string {
  if (bucket === 'hour') {
    const h = Number(key.slice(11, 13));
    return `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;
  }
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d || 1, 12));
  return bucket === 'month'
    ? date.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** Percentage change, or null when there is nothing to compare with. */
export function change(current: number, previous: number | null | undefined): number | null {
  if (previous === null || previous === undefined) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}
