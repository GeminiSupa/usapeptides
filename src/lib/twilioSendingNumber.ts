import 'server-only';

import { getSupabaseAdmin } from './supabaseAdmin';
import { twilioEnv } from './env';

/**
 * Which of the account's numbers the dashboard sends from by default.
 *
 * This account holds hundreds of numbers, so "the from number" is a choice
 * rather than a constant. The choice is still validated against the live
 * account on every send — this only remembers what to preselect, so each
 * admin does not have to hunt down the same number every time.
 *
 * Stored in `site_settings`, so no migration is needed and all admins see
 * the same default. `TWILIO_PHONE_NUMBER` is the fallback when nothing has
 * been chosen, which keeps a single-number deployment working untouched.
 */

export const SENDING_NUMBER_SETTING_ID = 'twilio_sending_number';

export interface SendingNumberSetting {
  number: string | null;
  changedBy: string | null;
  changedAt: string | null;
}

export function normalizeSendingNumber(value: unknown): SendingNumberSetting {
  if (!value || typeof value !== 'object') return { number: null, changedBy: null, changedAt: null };

  const row = value as Record<string, unknown>;
  const number = typeof row.number === 'string' && /^\+[1-9]\d{7,14}$/.test(row.number) ? row.number : null;

  return {
    number,
    changedBy: typeof row.changed_by === 'string' ? row.changed_by : null,
    changedAt: typeof row.changed_at === 'string' ? row.changed_at : null,
  };
}

export async function readSendingNumber(): Promise<SendingNumberSetting> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('site_settings')
      .select('value')
      .eq('id', SENDING_NUMBER_SETTING_ID)
      .maybeSingle();

    if (error) {
      console.warn('[twilio] could not read the sending number:', error.message);
      return { number: null, changedBy: null, changedAt: null };
    }

    return normalizeSendingNumber(data?.value);
  } catch (err) {
    console.warn('[twilio] could not read the sending number:', err);
    return { number: null, changedBy: null, changedAt: null };
  }
}

export async function writeSendingNumber(
  number: string,
  changedBy: string
): Promise<SendingNumberSetting> {
  const value = { number, changed_by: changedBy, changed_at: new Date().toISOString() };

  const { error } = await getSupabaseAdmin()
    .from('site_settings')
    .upsert({ id: SENDING_NUMBER_SETTING_ID, value, updated_at: new Date().toISOString() });

  if (error) throw new Error(error.message);

  return normalizeSendingNumber(value);
}

/**
 * The number to preselect: whatever was last chosen, else the one in the
 * environment, else nothing — at which point the dashboard asks for a choice
 * rather than guessing one out of hundreds.
 */
export async function defaultSender(): Promise<string | null> {
  const saved = await readSendingNumber();
  return saved.number ?? (twilioEnv.phoneNumber || null);
}
