import 'server-only';

import { getSupabaseAdmin } from './supabaseAdmin';

/**
 * Whether calls placed from the dashboard are recorded.
 *
 * A setting rather than an environment variable on purpose. Recording costs
 * money per minute, and the moment somebody wants it off is not a moment to
 * wait for a deploy.
 *
 * Stored in `site_settings` beside the announcement bar and the WhatsApp
 * number — no migration needed, the row appears on first save. It also records
 * who changed it and when, because "who turned recording on" is a question
 * that eventually gets asked.
 *
 * Off by default. Recording a call without telling the other person is
 * illegal in a good part of the world, so a fresh deployment must not do it
 * until somebody decides to.
 */

export const CALL_RECORDING_SETTING_ID = 'twilio_call_recording';

export interface CallRecordingSetting {
  enabled: boolean;
  changedBy: string | null;
  changedAt: string | null;
}

export const DEFAULT_CALL_RECORDING: CallRecordingSetting = {
  enabled: false,
  changedBy: null,
  changedAt: null,
};

/** Accepts whatever is in the column, including rows written by hand. */
export function normalizeCallRecording(value: unknown): CallRecordingSetting {
  if (!value || typeof value !== 'object') return { ...DEFAULT_CALL_RECORDING };

  const row = value as Record<string, unknown>;
  return {
    enabled: row.enabled === true,
    changedBy: typeof row.changed_by === 'string' ? row.changed_by : null,
    changedAt: typeof row.changed_at === 'string' ? row.changed_at : null,
  };
}

export async function readCallRecording(): Promise<CallRecordingSetting> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('site_settings')
      .select('value')
      .eq('id', CALL_RECORDING_SETTING_ID)
      .maybeSingle();

    // A read failure must not turn recording on by accident, and must not stop
    // the call either: fall through to the default, which is off.
    if (error) {
      console.warn('[twilio] could not read the recording setting:', error.message);
      return { ...DEFAULT_CALL_RECORDING };
    }

    return normalizeCallRecording(data?.value);
  } catch (err) {
    console.warn('[twilio] could not read the recording setting:', err);
    return { ...DEFAULT_CALL_RECORDING };
  }
}

export async function writeCallRecording(
  enabled: boolean,
  changedBy: string
): Promise<CallRecordingSetting> {
  const value = {
    enabled,
    changed_by: changedBy,
    changed_at: new Date().toISOString(),
  };

  const { error } = await getSupabaseAdmin()
    .from('site_settings')
    .upsert({ id: CALL_RECORDING_SETTING_ID, value, updated_at: new Date().toISOString() });

  if (error) throw new Error(error.message);

  return normalizeCallRecording(value);
}

/**
 * The `record` attribute for `<Dial>`.
 *
 * `record-from-ringing-dual` keeps the two sides on separate channels, which
 * is the difference between a recording you can transcribe and one where
 * everybody talks over each other. Returning undefined — rather than "false"
 * or "do-not-record" — leaves the attribute off the element entirely.
 */
export const dialRecordAttribute = (enabled: boolean): string | undefined =>
  enabled ? 'record-from-ringing-dual' : undefined;
