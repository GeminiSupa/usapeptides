import 'server-only';

import { randomInt } from 'node:crypto';
import type { getSupabaseAdmin } from './supabaseAdmin';

/**
 * Referral codes for sales agents and sub-users.
 *
 * `crypto.randomInt`, never `Math.random`: a code is money, and a predictable
 * one lets somebody attribute their own orders to an agent who never referred
 * them. Same alphabet as affiliate codes — no O/0, I/1 or L, because codes get
 * read aloud and typed off a phone screen.
 */

type Db = ReturnType<typeof getSupabaseAdmin>;

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

export function randomReferralCode(): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return out;
}

/** What a `?ref=` value may look like. Anything else is ignored, not guessed at. */
export function normalizeReferralCode(value: unknown): string | null {
  const raw = String(value ?? '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 32);
  return raw.length >= 4 ? raw : null;
}

/**
 * A code nobody holds yet. Checked against affiliates as well as admin_users,
 * because both answer the same `?ref=` link.
 */
export async function uniqueReferralCode(db: Db): Promise<string | null> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = randomReferralCode();
    const [agents, affiliates] = await Promise.all([
      db.from('admin_users').select('id').ilike('referral_code', candidate).limit(1),
      db.from('affiliates').select('id').ilike('referral_code', candidate).limit(1),
    ]);
    if (agents.error || affiliates.error) return null;
    if (!agents.data?.length && !affiliates.data?.length) return candidate;
  }
  // 31^8 is about 850 billion. Eight collisions means something is wrong.
  return null;
}
