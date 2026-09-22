export const PAID_ORDER_STATUSES = new Set(['paid', 'processing', 'shipped', 'delivered', 'completed']);
const DAY = 86400000;

/** Purchase cadence only. Same-day split orders count as one buying occasion. */
export function reorderEstimate(dates: string[], override?: number | null, now = Date.now()) {
  const days = Array.from(new Set(dates.map(d => Date.parse(d.slice(0, 10))).filter(Number.isFinite))).sort((a, b) => a - b);
  const gaps = days.slice(1).map((d, i) => (d - days[i]) / DAY).slice(-6).sort((a, b) => a - b);
  const middle = Math.floor(gaps.length / 2);
  const typical = gaps.length ? (gaps.length % 2 ? gaps[middle] : (gaps[middle - 1] + gaps[middle]) / 2) : null;
  const interval = override ?? (gaps.length >= 2 ? typical : null);
  if (!days.length || interval == null) return null;
  const due = days[days.length - 1] + Math.round(interval) * DAY;
  const daysUntil = Math.ceil((due - Date.parse(new Date(now).toISOString().slice(0, 10))) / DAY);
  return { intervalDays: Math.round(interval), dueAt: new Date(due).toISOString().slice(0, 10), daysUntil,
    basis: override ? 'Staff schedule' : `${gaps.length} recent purchase intervals`,
    confidence: override ? 'Manual' : gaps.length >= 4 && gaps[gaps.length - 1] - gaps[0] <= typical! * .5 ? 'Higher' : 'Limited',
    status: daysUntil < 0 ? 'Overdue' : daysUntil <= 7 ? 'Due soon' : 'Upcoming' };
}
