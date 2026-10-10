'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, MessageSquare, History, Mic, AlertTriangle, Workflow } from 'lucide-react';

import type { Call, Device } from '@twilio/voice-sdk';

/**
 * Dashboard > SMS & calls.
 *
 * Three things in here are the result of the Voice SDK behaving unlike its
 * documentation, and each one is commented where it bites:
 *
 *   - the SDK is imported lazily, inside the component. Twilio's CDN build
 *     returns 403 for every version, so a <script> tag is not an option, and
 *     a top-level import would pull a WebRTC stack into every dashboard page.
 *   - there is no `ready` event in 2.x. Waiting for one hangs forever.
 *   - microphone access is requested when the tab opens, not when the first
 *     call is placed, so the browser's own prompt appears at a moment the
 *     person can understand it.
 */

interface Props {
  authedFetch: (path: string, init?: RequestInit) => Promise<Response>;
}

interface TwilioStatus {
  configured: boolean;
  sms: boolean;
  whatsapp: boolean;
  voice: boolean;
  flows: boolean;
  fromNumber: string | null;
  whatsappFrom: string | null;
  studioFlows: { label: string; sid: string }[];
  missing: Record<string, boolean>;
}

interface AccountNumber {
  phoneNumber: string;
  friendlyName: string;
  voice: boolean;
  sms: boolean;
  mms: boolean;
  incomingGoesTo: 'this dashboard' | 'a studio flow' | 'another app' | 'a webhook' | 'nothing';
}

interface RecordingSetting {
  enabled: boolean;
  changedBy: string | null;
  changedAt: string | null;
}

interface MessageRow {
  sid: string;
  direction: string;
  from: string;
  to: string;
  body: string;
  status: string;
  channel: 'sms' | 'whatsapp';
  errorMessage: string | null;
  sentAt: string | null;
}

interface CallRow {
  sid: string;
  direction: string;
  from: string;
  to: string;
  status: string;
  durationSeconds: number;
  startedAt: string | null;
  price: string | null;
}

type Tab = 'call' | 'send' | 'history';
type MicState = 'unknown' | 'prompting' | 'granted' | 'denied' | 'unsupported';

const ENV_LABELS: Record<string, string> = {
  accountSid: 'TWILIO_ACCOUNT_SID',
  authToken: 'TWILIO_AUTH_TOKEN',
  apiKey: 'TWILIO_API_KEY',
  apiSecret: 'TWILIO_API_SECRET',
  twimlAppSid: 'TWILIO_TWIML_APP_SID',
  phoneNumber: 'TWILIO_PHONE_NUMBER',
};

export default function TwilioPanel({ authedFetch }: Props) {
  const [tab, setTab] = useState<Tab>('call');
  const [status, setStatus] = useState<TwilioStatus | null>(null);
  const [recording, setRecording] = useState<RecordingSetting | null>(null);
  const [numbers, setNumbers] = useState<AccountNumber[]>([]);
  const [sender, setSender] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    authedFetch('/api/admin/twilio')
      .then((res) => res.json())
      .then((p) => {
        setStatus(p?.data?.twilio ?? null);
        setRecording(p?.data?.recording ?? null);
      })
      .catch(() => setLoadError('Could not load the Twilio settings.'))
      .finally(() => setLoading(false));

    // Fetched once and shared by both tabs: this account holds hundreds of
    // numbers, so pulling the list per tab would be several seconds wasted
    // every time somebody switches.
    authedFetch('/api/admin/twilio/numbers')
      .then((res) => res.json())
      .then((p) => {
        setNumbers(p?.data?.numbers ?? []);
        if (p?.data?.defaultNumber) setSender(p.data.defaultNumber);
      })
      .catch(() => { /* the picker simply shows nothing to choose from */ });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return <div className="border border-brand-border bg-brand-card p-4 text-xs text-brand-textMuted">Loading...</div>;
  }

  if (loadError || !status) {
    return (
      <div className="border border-brand-border bg-brand-card p-4 text-[0.8125rem] text-red-600">
        {loadError || 'Could not load the Twilio settings.'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <StatusStrip status={status} />

      <div className="flex flex-wrap gap-1 border-b border-brand-border">
        <TabButton active={tab === 'call'} onClick={() => setTab('call')} icon={<Phone className="h-3.5 w-3.5" />} label="Call" />
        <TabButton active={tab === 'send'} onClick={() => setTab('send')} icon={<MessageSquare className="h-3.5 w-3.5" />} label="Send a message" />
        <TabButton active={tab === 'history'} onClick={() => setTab('history')} icon={<History className="h-3.5 w-3.5" />} label="History" />
      </div>

      {tab === 'call' && (
        <CallTab
          authedFetch={authedFetch}
          status={status}
          recording={recording}
          onRecordingChange={setRecording}
          numbers={numbers}
          sender={sender}
          onSenderChange={setSender}
        />
      )}
      {tab === 'send' && (
        <SendTab
          authedFetch={authedFetch}
          status={status}
          numbers={numbers}
          sender={sender}
          onSenderChange={setSender}
        />
      )}
      {tab === 'history' && <HistoryTab authedFetch={authedFetch} />}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 border-b-2 px-3 py-2 font-display text-[0.75rem] font-extrabold uppercase tracking-[0.1em] transition-colors ${
        active ? 'border-brand-accent text-brand-heading' : 'border-transparent text-brand-textMuted hover:text-brand-heading'
      }`}
    >
      {icon} {label}
    </button>
  );
}

function StatusStrip({ status }: { status: TwilioStatus }) {
  const missing = Object.entries(status.missing).filter(([, isMissing]) => isMissing).map(([key]) => ENV_LABELS[key] ?? key);

  return (
    <div className="border border-brand-border bg-brand-card p-4">
      <h2 className="eyebrow mb-2">Twilio</h2>
      {status.configured ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[0.8125rem] text-brand-body">
          <span>
            {status.fromNumber
              ? <>Default number <span className="font-mono text-brand-heading">{status.fromNumber}</span></>
              : 'Pick a number below before sending'}
          </span>
          <Pill on={status.sms} label="Texts" />
          <Pill on={status.whatsapp} label="WhatsApp" />
          <Pill on={status.voice} label="Browser calls" />
          {status.studioFlows.length > 0 && <Pill on label={`${status.studioFlows.length} flow${status.studioFlows.length === 1 ? '' : 's'}`} />}
        </div>
      ) : (
        <p className="text-[0.8125rem] leading-relaxed text-brand-textMuted">
          Twilio is not set up on this deployment yet. Add these to the environment and redeploy:{' '}
          <span className="font-mono text-brand-heading">{missing.join(', ')}</span>
        </p>
      )}
    </div>
  );
}

const Pill = ({ on, label }: { on: boolean; label: string }) => (
  <span className={`font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.1em] ${on ? 'text-brand-success' : 'text-brand-textMuted'}`}>
    {on ? '' : 'no '}{label}
  </span>
);

/* ------------------------------------------------------------- the sender */

/**
 * Which of the account's numbers this goes out from.
 *
 * The account holds hundreds, so the list is filterable rather than a plain
 * dropdown. Each option says where an incoming call to that number currently
 * lands, because choosing a sender does not change that: text somebody from
 * a number wired to another phone system and their reply goes there, not
 * here. The warning under the picker says so for the chosen number.
 */
function NumberPicker({
  numbers,
  value,
  onChange,
  authedFetch,
  need,
}: {
  numbers: AccountNumber[];
  value: string;
  onChange: (next: string) => void;
  authedFetch: Props['authedFetch'];
  need: 'sms' | 'voice';
}) {
  const [filter, setFilter] = useState('');
  const [savedNote, setSavedNote] = useState('');

  const usable = numbers.filter((n) => (need === 'sms' ? n.sms : n.voice));
  const digits = filter.replace(/[^\d]/g, '');
  const shown = digits ? usable.filter((n) => n.phoneNumber.includes(digits)) : usable;

  const chosen = usable.find((n) => n.phoneNumber === value) ?? null;

  const remember = async () => {
    setSavedNote('');
    try {
      const res = await authedFetch('/api/admin/twilio', {
        method: 'POST',
        body: JSON.stringify({ action: 'sending_number', number: value }),
      });
      setSavedNote(res.ok ? 'Saved as the default' : 'Could not save that as the default');
    } catch {
      setSavedNote('Could not save that as the default');
    }
  };

  if (numbers.length === 0) {
    return (
      <p className="text-[0.8125rem] text-brand-textMuted">
        No phone numbers on this Twilio account yet.
      </p>
    );
  }

  return (
    <div>
      <span className="eyebrow mb-1.5 block">
        {need === 'voice' ? 'Call from' : 'Send from'}
      </span>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter, e.g. 214"
          inputMode="numeric"
          className="w-28 border border-brand-border bg-brand-dark px-3 py-2 font-mono text-xs text-brand-heading placeholder-brand-textMuted focus:border-brand-accent focus:outline-none"
        />

        <select
          value={value}
          onChange={(e) => { onChange(e.target.value); setSavedNote(''); }}
          className="min-w-[14rem] border border-brand-border bg-brand-dark px-3 py-2 font-mono text-xs text-brand-heading focus:border-brand-accent focus:outline-none"
        >
          <option value="">Choose a number...</option>
          {shown.map((n) => (
            <option key={n.phoneNumber} value={n.phoneNumber}>
              {n.phoneNumber}
            </option>
          ))}
        </select>

        {value && (
          <button
            onClick={() => void remember()}
            className="border border-brand-border px-3 py-2 font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.1em] text-brand-textMuted transition-colors hover:text-brand-heading"
          >
            Make default
          </button>
        )}

        {savedNote && (
          <span className="font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.1em] text-brand-success">
            {savedNote}
          </span>
        )}
      </div>

      <p className="mt-1 text-[0.75rem] leading-relaxed text-brand-textMuted">
        {shown.length} of {usable.length} numbers shown.
        {chosen && chosen.incomingGoesTo !== 'this dashboard' && (
          <span className="text-brand-heading">
            {' '}Heads up: if someone calls {chosen.phoneNumber} back, they reach{' '}
            {chosen.incomingGoesTo === 'nothing' ? 'nothing - the call goes nowhere' : chosen.incomingGoesTo}
            , not this dashboard.
          </span>
        )}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- the calls */

function CallTab({
  authedFetch,
  status,
  recording,
  onRecordingChange,
  numbers,
  sender,
  onSenderChange,
}: {
  authedFetch: Props['authedFetch'];
  status: TwilioStatus;
  recording: RecordingSetting | null;
  onRecordingChange: (r: RecordingSetting) => void;
  numbers: AccountNumber[];
  sender: string;
  onSenderChange: (next: string) => void;
}) {
  const [number, setNumber] = useState('');
  const [mic, setMic] = useState<MicState>('unknown');
  const [device, setDevice] = useState<Device | null>(null);
  const [deviceError, setDeviceError] = useState('');
  const [call, setCall] = useState<Call | null>(null);
  const [callState, setCallState] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [savingRecording, setSavingRecording] = useState(false);

  const deviceRef = useRef<Device | null>(null);

  /** Fetches a fresh voice token. Used at start-up and on tokenWillExpire. */
  const fetchToken = useCallback(async (): Promise<string> => {
    const res = await authedFetch('/api/admin/twilio/token');
    const payload = await res.json();
    const token = payload?.data?.token;
    if (!token) throw new Error(payload?.message ?? 'No call token came back.');
    return token as string;
  }, [authedFetch]);

  /**
   * Ask for the microphone as soon as the tab opens.
   *
   * Leaving this until the first call means the call fails with Twilio error
   * 31401 — "unable to acquire input audio" — which tells the person nothing.
   * The tracks are stopped immediately: this is a permission prompt, not a
   * recording.
   */
  useEffect(() => {
    if (!status.voice) return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setMic('unsupported');
      return;
    }

    let cancelled = false;
    setMic('prompting');

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        stream.getTracks().forEach((t) => t.stop());
        if (!cancelled) setMic('granted');
      })
      .catch(() => {
        if (!cancelled) setMic('denied');
      });

    return () => { cancelled = true; };
  }, [status.voice]);

  /**
   * Build the Device once the microphone is available.
   *
   * There is no `ready` event in Voice SDK 2.x — the events it actually emits
   * are error, incoming, destroyed, unregistered, registering, registered and
   * tokenWillExpire. Outgoing calls need no registration, so the device is
   * usable the moment it is constructed, and waiting for anything else hangs.
   */
  useEffect(() => {
    if (!status.voice || mic !== 'granted') return;

    let cancelled = false;

    (async () => {
      try {
        // Lazy, and inside the component: Twilio's CDN build is dead (403 on
        // every version), so this has to come from the npm package, and it is
        // too large to load on dashboard pages that never place a call.
        const { Device: VoiceDevice } = await import('@twilio/voice-sdk');
        const token = await fetchToken();
        if (cancelled) return;

        const next = new VoiceDevice(token, { closeProtection: true });

        next.on('error', (err: { message?: string; code?: number }) => {
          setDeviceError(`${err?.message ?? 'Call failed.'}${err?.code ? ` (Twilio error ${err.code})` : ''}`);
        });

        // Without this the device stops working an hour in, mid-shift, with
        // no visible cause.
        next.on('tokenWillExpire', () => {
          fetchToken()
            .then((fresh) => next.updateToken(fresh))
            .catch(() => setDeviceError('Could not refresh the call token. Reload the page.'));
        });

        deviceRef.current = next;
        setDevice(next);
      } catch (err) {
        if (!cancelled) setDeviceError(err instanceof Error ? err.message : 'Could not start the calling device.');
      }
    })();

    return () => {
      cancelled = true;
      deviceRef.current?.destroy();
      deviceRef.current = null;
    };
  }, [status.voice, mic, fetchToken]);

  /** Call timer. */
  useEffect(() => {
    if (!call) { setSeconds(0); return; }
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [call]);

  const dial = async () => {
    if (!device) return;
    setDeviceError('');
    setCallState('Connecting...');

    try {
      // CallerId travels to our voice webhook with the call, where it is
      // checked against the numbers the account owns before being used.
      const outgoing = await device.connect({ params: { To: number.trim(), CallerId: sender } });

      outgoing.on('accept', () => setCallState('In call'));
      outgoing.on('ringing', () => setCallState('Ringing...'));
      outgoing.on('disconnect', () => { setCall(null); setCallState(''); });
      outgoing.on('cancel', () => { setCall(null); setCallState(''); });
      outgoing.on('reject', () => { setCall(null); setCallState('Rejected'); });
      outgoing.on('error', (err: { message?: string }) => {
        setDeviceError(err?.message ?? 'The call failed.');
        setCall(null);
        setCallState('');
      });

      setCall(outgoing);
    } catch (err) {
      setDeviceError(err instanceof Error ? err.message : 'Could not place the call.');
      setCallState('');
    }
  };

  const hangUp = () => {
    device?.disconnectAll();
    setCall(null);
    setCallState('');
  };

  const toggleRecording = async (enabled: boolean) => {
    setSavingRecording(true);
    try {
      const res = await authedFetch('/api/admin/twilio', {
        method: 'POST',
        body: JSON.stringify({ action: 'recording', enabled }),
      });
      const payload = await res.json();
      if (res.ok && payload?.data?.recording) onRecordingChange(payload.data.recording);
    } catch {
      /* the switch simply stays where it was */
    } finally {
      setSavingRecording(false);
    }
  };

  if (!status.voice) {
    return (
      <div className="border border-brand-border bg-brand-card p-4 text-[0.8125rem] leading-relaxed text-brand-textMuted">
        Calling from the browser needs the account values, the API key and the TwiML app.
        Add the missing ones listed above and redeploy. The caller ID is picked per call, so no
        phone number needs setting here.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {mic === 'denied' && (
        <div className="border border-brand-border bg-brand-card p-4">
          <h3 className="eyebrow mb-1.5 flex items-center gap-1.5 text-red-600">
            <AlertTriangle className="h-3.5 w-3.5" /> The microphone is blocked
          </h3>
          <p className="text-[0.8125rem] leading-relaxed text-brand-body">
            Calls cannot work until the browser is allowed to use the microphone, and once it is set to block,
            no page can ask again. Click the padlock in the address bar, set Microphone to Allow, then reload this page.
          </p>
        </div>
      )}

      {mic === 'unsupported' && (
        <div className="border border-brand-border bg-brand-card p-4 text-[0.8125rem] text-brand-body">
          This browser cannot place calls. Use Chrome, Edge or Safari over https.
        </div>
      )}

      <div className="border border-brand-border bg-brand-card p-4">
        <h3 className="eyebrow mb-2 flex items-center gap-1.5">
          <Phone className="h-3.5 w-3.5" /> Call a number
        </h3>
        <p className="mb-3 text-[0.8125rem] leading-relaxed text-brand-textMuted">
          Pick which of your numbers to ring from. A local area code is answered far more often than
          an out-of-state one.
        </p>

        <div className="mb-3">
          <NumberPicker
            numbers={numbers}
            value={sender}
            onChange={onSenderChange}
            authedFetch={authedFetch}
            need="voice"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="+1 555 123 4567"
            inputMode="tel"
            disabled={Boolean(call)}
            className="w-full max-w-xs border border-brand-border bg-brand-dark px-3 py-2 font-mono text-xs text-brand-heading placeholder-brand-textMuted focus:border-brand-accent focus:outline-none disabled:opacity-60"
          />

          {call ? (
            <button onClick={hangUp} className="flex items-center gap-1.5 bg-red-700 px-3 py-2 font-display text-[0.75rem] font-extrabold uppercase tracking-[0.1em] text-white">
              <PhoneOff className="h-3.5 w-3.5" /> Hang up
            </button>
          ) : (
            <button
              onClick={() => void dial()}
              disabled={!device || !number.trim() || !sender || mic !== 'granted'}
              className="btn-primary flex items-center gap-1.5 disabled:opacity-60"
            >
              <Phone className="h-3.5 w-3.5" /> Call
            </button>
          )}

          {callState && (
            <span className="font-display text-[0.75rem] font-extrabold uppercase tracking-[0.1em] text-brand-heading">
              {callState}{call ? ` · ${formatDuration(seconds)}` : ''}
            </span>
          )}

          {mic === 'prompting' && (
            <span className="flex items-center gap-1.5 text-[0.75rem] text-brand-textMuted">
              <Mic className="h-3.5 w-3.5" /> Allow the microphone when the browser asks
            </span>
          )}
        </div>

        {deviceError && <p className="mt-2 text-[0.8125rem] text-red-600">{deviceError}</p>}
      </div>

      <div className="border border-brand-border bg-brand-card p-4">
        <h3 className="eyebrow mb-2">Record calls</h3>
        <label className="flex items-center gap-2 text-[0.8125rem] text-brand-body">
          <input
            type="checkbox"
            checked={Boolean(recording?.enabled)}
            disabled={savingRecording}
            onChange={(e) => void toggleRecording(e.target.checked)}
            className="h-4 w-4 accent-[#1f4233]"
          />
          Record calls placed from here
        </label>
        <p className="mt-1.5 text-[0.75rem] leading-relaxed text-brand-textMuted">
          Costs about $0.0025 a minute to record plus $0.0005 a minute each month to store, with the first 10,000
          minutes of storage free. Many places require you to tell the other person they are being recorded — check
          what applies where you and they are.
          {recording?.changedBy && (
            <> Last changed by {recording.changedBy}{recording.changedAt ? ` on ${formatDate(recording.changedAt)}` : ''}.</>
          )}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- the messages */

function SendTab({
  authedFetch,
  status,
  numbers,
  sender,
  onSenderChange,
}: {
  authedFetch: Props['authedFetch'];
  status: TwilioStatus;
  numbers: AccountNumber[];
  sender: string;
  onSenderChange: (next: string) => void;
}) {
  const [mode, setMode] = useState<'sms' | 'bulk_sms' | 'whatsapp' | 'flow'>('sms');
  const [to, setTo] = useState('');
  const [recipients, setRecipients] = useState('');
  const [body, setBody] = useState('');
  const [flowSid, setFlowSid] = useState(status.studioFlows[0]?.sid ?? '');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const send = async () => {
    setBusy(true); setNotice(''); setError('');
    try {
      const payload: Record<string, unknown> = { action: mode, from: sender };
      if (mode === 'bulk_sms') { payload.recipients = recipients; payload.body = body; }
      else if (mode === 'flow') { payload.to = to; payload.flowSid = flowSid; }
      else { payload.to = to; payload.body = body; }

      const res = await authedFetch('/api/admin/twilio', { method: 'POST', body: JSON.stringify(payload) });
      const p = await res.json().catch(() => null);

      if (!res.ok) { setError(p?.message ?? 'Could not send.'); return; }

      if (mode === 'bulk_sms') {
        const skipped = (p.data.skipped as string[]) ?? [];
        setNotice(
          `Sent to ${p.data.sent} of ${p.data.sent + p.data.failed}.` +
          (skipped.length ? ` ${skipped.length} entries were not phone numbers and were skipped.` : '')
        );
      } else {
        setNotice(mode === 'flow' ? 'Flow started.' : 'Sent.');
        setBody('');
      }
    } catch {
      setError('Could not send.');
    } finally {
      setBusy(false);
    }
  };

  const modes: { id: typeof mode; label: string; available: boolean }[] = [
    { id: 'sms', label: 'One text', available: status.sms },
    { id: 'bulk_sms', label: 'Many texts', available: status.sms },
    { id: 'whatsapp', label: 'WhatsApp', available: status.whatsapp },
    { id: 'flow', label: 'Studio flow', available: status.flows },
  ];

  return (
    <div className="border border-brand-border bg-brand-card p-4">
      <div className="mb-3 flex flex-wrap gap-2">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => { setMode(m.id); setNotice(''); setError(''); }}
            disabled={!m.available}
            title={m.available ? undefined : 'Not configured on this deployment'}
            className={`border px-3 py-1.5 font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.1em] transition-colors disabled:opacity-40 ${
              mode === m.id ? 'border-brand-accent text-brand-heading' : 'border-brand-border text-brand-textMuted hover:text-brand-heading'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode !== 'whatsapp' && (
        <div className="mb-3">
          <NumberPicker
            numbers={numbers}
            value={sender}
            onChange={onSenderChange}
            authedFetch={authedFetch}
            need="sms"
          />
        </div>
      )}

      {mode === 'bulk_sms' ? (
        <label className="block">
          <span className="eyebrow mb-1.5 block">Numbers</span>
          <textarea
            value={recipients}
            onChange={(e) => setRecipients(e.target.value)}
            rows={5}
            placeholder={'+1 555 123 4567\n+1 555 987 6543'}
            className="w-full border border-brand-border bg-brand-dark px-3 py-2 font-mono text-xs text-brand-heading placeholder-brand-textMuted focus:border-brand-accent focus:outline-none"
          />
          <span className="mt-1 block text-[0.75rem] text-brand-textMuted">
            One per line, or separated by commas. Up to 200 at a time; they go out one after another, not all at once.
          </span>
        </label>
      ) : (
        <label className="block">
          <span className="eyebrow mb-1.5 block">To</span>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="+1 555 123 4567"
            inputMode="tel"
            className="w-full max-w-xs border border-brand-border bg-brand-dark px-3 py-2 font-mono text-xs text-brand-heading placeholder-brand-textMuted focus:border-brand-accent focus:outline-none"
          />
        </label>
      )}

      {mode === 'flow' ? (
        <label className="mt-3 block">
          <span className="eyebrow mb-1.5 block">Flow</span>
          <select
            value={flowSid}
            onChange={(e) => setFlowSid(e.target.value)}
            className="w-full max-w-xs border border-brand-border bg-brand-dark px-3 py-2 text-xs text-brand-heading focus:border-brand-accent focus:outline-none"
          >
            {status.studioFlows.map((f) => (
              <option key={f.sid} value={f.sid}>{f.label}</option>
            ))}
          </select>
          <span className="mt-1 flex items-center gap-1.5 text-[0.75rem] text-brand-textMuted">
            <Workflow className="h-3.5 w-3.5" /> The flow decides what is said or sent from here on.
          </span>
        </label>
      ) : (
        <label className="mt-3 block">
          <span className="eyebrow mb-1.5 block">Message</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            maxLength={1600}
            className="w-full border border-brand-border bg-brand-dark px-3 py-2 text-[0.8125rem] text-brand-heading placeholder-brand-textMuted focus:border-brand-accent focus:outline-none"
          />
          <span className="mt-1 block text-[0.75rem] text-brand-textMuted">{body.length} of 1600 characters</span>
        </label>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={() => void send()} disabled={busy} className="btn-primary disabled:opacity-60">
          {busy ? 'Sending...' : mode === 'flow' ? 'Start flow' : 'Send'}
        </button>
        {notice && <span className="font-display text-[0.75rem] font-extrabold uppercase tracking-[0.1em] text-brand-success">{notice}</span>}
        {error && <span className="text-[0.8125rem] text-red-600">{error}</span>}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- the logs */

function HistoryTab({ authedFetch }: { authedFetch: Props['authedFetch'] }) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true); setError('');
    Promise.all([
      authedFetch('/api/admin/twilio/messages').then((r) => r.json()),
      authedFetch('/api/admin/twilio/calls').then((r) => r.json()),
    ])
      .then(([m, c]) => {
        setMessages(m?.data?.messages ?? []);
        setCalls(c?.data?.calls ?? []);
      })
      .catch(() => setError('Could not load the history.'))
      .finally(() => setLoading(false));
  }, [authedFetch]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="border border-brand-border bg-brand-card p-4 text-xs text-brand-textMuted">Loading...</div>;
  if (error) return <div className="border border-brand-border bg-brand-card p-4 text-[0.8125rem] text-red-600">{error}</div>;

  return (
    <div className="space-y-4">
      <div className="border border-brand-border bg-brand-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="eyebrow">Messages</h3>
          <button onClick={load} className="font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.1em] text-brand-textMuted hover:text-brand-heading">
            Refresh
          </button>
        </div>
        {messages.length === 0 ? (
          <p className="text-[0.8125rem] text-brand-textMuted">Nothing sent or received yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[0.8125rem]">
              <thead>
                <tr className="eyebrow border-b border-brand-border text-brand-textMuted">
                  <th className="py-2 pr-3">When</th>
                  <th className="py-2 pr-3">Direction</th>
                  <th className="py-2 pr-3">Number</th>
                  <th className="py-2 pr-3">Message</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((m) => {
                  const outbound = m.direction.startsWith('outbound');
                  return (
                    <tr key={m.sid} className="border-b border-brand-border/50 align-top">
                      <td className="py-2 pr-3 whitespace-nowrap text-brand-textMuted">{formatDate(m.sentAt)}</td>
                      <td className="py-2 pr-3 whitespace-nowrap text-brand-textMuted">
                        {outbound ? 'Sent' : 'Received'}{m.channel === 'whatsapp' ? ' · WhatsApp' : ''}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap font-mono text-xs text-brand-heading">{outbound ? m.to : m.from}</td>
                      <td className="py-2 pr-3 text-brand-body">{m.body}</td>
                      <td className="py-2 whitespace-nowrap">
                        <span className={m.errorMessage ? 'text-red-600' : 'text-brand-textMuted'}>
                          {m.errorMessage ?? m.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="border border-brand-border bg-brand-card p-4">
        <h3 className="eyebrow mb-3">Calls</h3>
        {calls.length === 0 ? (
          <p className="text-[0.8125rem] text-brand-textMuted">No calls yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[0.8125rem]">
              <thead>
                <tr className="eyebrow border-b border-brand-border text-brand-textMuted">
                  <th className="py-2 pr-3">When</th>
                  <th className="py-2 pr-3">Direction</th>
                  <th className="py-2 pr-3">Number</th>
                  <th className="py-2 pr-3">Length</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((c) => {
                  const outbound = c.direction.startsWith('outbound');
                  return (
                    <tr key={c.sid} className="border-b border-brand-border/50">
                      <td className="py-2 pr-3 whitespace-nowrap text-brand-textMuted">{formatDate(c.startedAt)}</td>
                      <td className="py-2 pr-3 whitespace-nowrap text-brand-textMuted">{outbound ? 'Outgoing' : 'Incoming'}</td>
                      <td className="py-2 pr-3 whitespace-nowrap font-mono text-xs text-brand-heading">{outbound ? c.to : c.from}</td>
                      <td className="py-2 pr-3 whitespace-nowrap text-brand-textMuted">{formatDuration(c.durationSeconds)}</td>
                      <td className="py-2 whitespace-nowrap text-brand-textMuted">{c.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ format */

function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
