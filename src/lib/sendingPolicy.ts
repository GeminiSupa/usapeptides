import 'server-only';

import { getSupabaseAdmin } from './supabaseAdmin';
import { dailyCap, DEFAULT_POLICY, type CapToday, type Policy } from './emailHealth';

/**
 * The daily send limit, enforced.
 *
 * Every send - campaign or automation - asks here first and only sends what it
 * is granted. The counting happens in the database (email_reserve_sends), so
 * two workers running at once cannot both spend the last permit.
 *
 * Before 0024_email_automations.sql has been run there is no policy table. The
 * limit then reports as "not set up" and nothing is blocked: a missing warm-up
 * table must never stop the owner sending an order confirmation.
 */

type Db = ReturnType<typeof getSupabaseAdmin>;

export const POLICY_MIGRATION =
  'Sending limits need a database update. Run supabase/migrations/0024_email_automations.sql in the Supabase SQL editor.';

const missingTable = (e: { code?: string; message?: string } | null) =>
  Boolean(e && (e.code === '42P01' || e.code === 'PGRST205' || e.code === 'PGRST202' || e.code === '42703'
    || /does not exist|schema cache/i.test(e.message ?? '')));

export interface PolicyState {
  policy: Policy;
  today: CapToday;
  sentToday: number;
  remaining: number;
  /** False when 0024 has not been run. Nothing is capped in that case. */
  ready: boolean;
  notice: string | null;
}

export async function getPolicyState(db: Db = getSupabaseAdmin()): Promise<PolicyState> {
  const { data, error } = await db.from('email_sending_policy')
    .select('warmup_enabled, warmup_started_on, daily_cap_override, max_daily_cap')
    .eq('id', true).maybeSingle();

  if (error && missingTable(error)) {
    return {
      policy: DEFAULT_POLICY,
      today: { cap: Number.POSITIVE_INFINITY, reason: 'No limit is in force yet.', warmupDay: null },
      sentToday: 0, remaining: Number.POSITIVE_INFINITY, ready: false, notice: POLICY_MIGRATION,
    };
  }

  const policy: Policy = { ...DEFAULT_POLICY, ...(data ?? {}) } as Policy;
  const today = dailyCap(policy);

  const { data: counter } = await db.from('email_send_counters')
    .select('sent').eq('day', new Date().toISOString().slice(0, 10)).maybeSingle();
  const sentToday = Number(counter?.sent ?? 0);

  return {
    policy, today, sentToday,
    remaining: Math.max(0, today.cap - sentToday),
    ready: true, notice: null,
  };
}

/**
 * Ask for permission to send `want` emails. Returns how many are allowed -
 * possibly zero. Anything reserved and not used must be handed back with
 * `releaseSends`, or tomorrow's headroom is quietly eaten by today.
 */
export async function reserveSends(db: Db, want: number): Promise<{ granted: number; reason: string | null }> {
  if (want <= 0) return { granted: 0, reason: null };

  let state = await getPolicyState(db);
  if (!state.ready) return { granted: want, reason: null };

  // Start the clock on the first email ever sent.
  //
  // An unset start date reads as day one, which is correct on the first day
  // and wrong every day after it: without this the limit would sit at 25 a day
  // for ever and nobody would know why. Stamping it here rather than when the
  // row is created means the ramp measures real sending, not how long ago
  // somebody opened the screen.
  if (state.policy.warmup_enabled && !state.policy.warmup_started_on) {
    const today = new Date().toISOString().slice(0, 10);
    await db.from('email_sending_policy').update({ warmup_started_on: today }).eq('id', true).is('warmup_started_on', null);
    state = await getPolicyState(db);
  }

  const { data, error } = await db.rpc('email_reserve_sends', { p_cap: state.today.cap, p_want: want });
  if (error) {
    // The RPC is part of 0024. Without it, do not block sending.
    if (missingTable(error)) return { granted: want, reason: null };
    throw new Error(error.message);
  }

  const granted = Number(data ?? 0);
  if (granted >= want) return { granted, reason: null };
  return {
    granted,
    reason: `Today's sending limit has been reached (${state.today.cap} emails). ${state.today.reason} The rest go out tomorrow.`,
  };
}

export async function releaseSends(db: Db, count: number): Promise<void> {
  if (count <= 0) return;
  await db.rpc('email_release_sends', { p_count: count }).then(() => undefined, () => undefined);
}

/** Save the owner's warm-up settings. Returns the state as it now stands. */
export async function savePolicy(patch: Partial<Policy>): Promise<PolicyState> {
  const db = getSupabaseAdmin();
  const row: Record<string, unknown> = {};
  if ('warmup_enabled' in patch) row.warmup_enabled = Boolean(patch.warmup_enabled);
  if ('warmup_started_on' in patch) {
    const v = String(patch.warmup_started_on ?? '').slice(0, 10);
    row.warmup_started_on = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  }
  if ('daily_cap_override' in patch) {
    const n = Number(patch.daily_cap_override);
    row.daily_cap_override = Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
  }
  if ('max_daily_cap' in patch) {
    const n = Number(patch.max_daily_cap);
    row.max_daily_cap = Math.min(100_000, Math.max(1, Math.round(Number.isFinite(n) ? n : 2000)));
  }

  if (Object.keys(row).length) {
    const { error } = await db.from('email_sending_policy').upsert({ id: true, ...row }, { onConflict: 'id' });
    if (error && !missingTable(error)) throw new Error(error.message);
  }
  return getPolicyState(db);
}
