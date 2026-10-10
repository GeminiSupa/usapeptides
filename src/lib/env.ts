/**
 * Central environment + business configuration.
 *
 * Every integration is optional. Anything without credentials reports itself
 * as disabled via `features` rather than throwing at import time, so the site
 * builds and runs with only the three Supabase values present.
 *
 * IMPORTANT: this project is a standalone deployment. It must never read
 * credentials belonging to any other store — its Supabase project is its own.
 */

const clean = (v: string | undefined): string => (v ?? '').trim();

/**
 * Public business identity, used in page copy, emails and order records.
 *
 * `supportEmail` is the one mailbox a human actually reads. The site is served
 * from a different domain than the mailbox, which is fine: the site domain is
 * only used to build links, and the mailbox is only used to receive replies.
 * Nothing here may be repeated anywhere else in the codebase.
 */
const supportEmail = clean(process.env.ORDER_NOTIFICATION_FROM) || 'info@usapeptides.com';

export const BUSINESS = {
  name: 'USA Peptide Depot',
  legalName: 'USA Peptide Depot',
  domain: clean(process.env.NEXT_PUBLIC_SITE_URL) || 'https://www.usapeptidedepot.com',
  supportEmail,
  /**
   * Where customers send Zelle transfers. Defaults to the support mailbox
   * because that is the only address the business monitors — it must be the
   * address actually registered with Zelle, or transfers will not arrive.
   */
  paymentsEmail: clean(process.env.PAYMENTS_EMAIL) || supportEmail,
  supportPhone: '831-471-5559',
  /** Public profiles. The footer and Organization sameAs read these. */
  instagram: 'https://www.instagram.com/usapeptidedepot',
  facebook: 'https://www.facebook.com/people/USA-Peptide-Depot/61594974061910/',
  country: 'US',
  currency: 'USD',
  /** The business day for dashboards ("today", "this week"). */
  timezone: clean(process.env.NEXT_PUBLIC_BUSINESS_TIMEZONE) || 'America/New_York',
} as const;

/** Supabase — the only integration required for the backend to function. */
export const supabaseEnv = {
  url: clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
  anonKey: clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  serviceRoleKey: clean(process.env.SUPABASE_SERVICE_ROLE_KEY),
};

export const isSupabaseConfigured = Boolean(supabaseEnv.url && supabaseEnv.anonKey);
export const isSupabaseAdminConfigured = Boolean(supabaseEnv.url && supabaseEnv.serviceRoleKey);

/** SMTP — transactional email (order confirmations, enquiry notifications). */
export const smtpEnv = {
  host: clean(process.env.SMTP_HOST),
  port: Number(clean(process.env.SMTP_PORT)) || 587,
  secure: clean(process.env.SMTP_SECURE) === 'true',
  user: clean(process.env.SMTP_USER),
  pass: clean(process.env.SMTP_PASS),
  from: clean(process.env.SMTP_FROM) || BUSINESS.supportEmail,
  orderNotificationTo: clean(process.env.ORDER_NOTIFICATION_TO),
};

/**
 * Resend HTTP API — preferred when an API key is supplied. Server-only.
 *
 * `RESEND_FROM` is a send-only address on a Resend-verified domain. It is not
 * a mailbox and nobody reads it, so it is named `noreply@` and every message
 * carries a Reply-To of `BUSINESS.supportEmail`. A customer who replies anyway
 * reaches a real person instead of a black hole.
 */
export const resendEnv = {
  apiKey: clean(process.env.RESEND_API_KEY),
  from: clean(process.env.RESEND_FROM) || 'onboarding@resend.dev',
};

/**
 * Chatwoot — live chat on the storefront.
 *
 * The base URL and website token are public by necessity: the widget runs in
 * the visitor's browser and the token identifies which inbox to open, not who
 * is allowed to write to it.
 *
 * The other two are server-only and must stay that way:
 *   hmacSecret     signs a signed-in customer's identity so somebody cannot
 *                  open the chat claiming to be another customer. Only needed
 *                  if the inbox has identity validation switched on.
 *   webhookSecret  a shared secret in the webhook URL. Chatwoot does not sign
 *                  its webhooks, so this is what stops anyone who finds the
 *                  endpoint from posting fake conversations into the CRM.
 */
export const chatwootEnv = {
  baseUrl: clean(process.env.NEXT_PUBLIC_CHATWOOT_BASE_URL).replace(/\/+$/, ''),
  websiteToken: clean(process.env.NEXT_PUBLIC_CHATWOOT_WEBSITE_TOKEN),
  hmacSecret: clean(process.env.CHATWOOT_HMAC_SECRET),
  webhookSecret: clean(process.env.CHATWOOT_WEBHOOK_SECRET),
};

/**
 * Twilio - SMS, WhatsApp, Studio Flows and calls placed from the dashboard.
 *
 * Six values, and they do not all come from the same place:
 *
 *   accountSid + authToken   identify the Twilio account itself. One account
 *                            has exactly one pair, so a business running two
 *                            projects on one account shares these. The auth
 *                            token is also what signs webhooks, which is why
 *                            the voice webhook can verify a request without
 *                            any other credential.
 *   apiKey + apiSecret       this deployment's own credential. Revoking it
 *                            stops this project and nothing else, and browser
 *                            call tokens MUST be signed with it - Twilio
 *                            rejects a token signed with the auth token.
 *   twimlAppSid              holds the one webhook address Twilio calls when
 *                            the browser dials. It carries a single URL, so
 *                            two deployments cannot share one: the second
 *                            would hand its calls to the first's server.
 *   phoneNumber              the caller ID, and the "from" on every message.
 *
 * `studioFlows` is a comma-separated list of `Label:FWxxxx` pairs rather than
 * named variables, so flows stay per-business configuration instead of
 * something hardcoded here.
 */
const parseStudioFlows = (raw: string): { label: string; sid: string }[] =>
  raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const at = entry.lastIndexOf(':');
      const sid = (at === -1 ? entry : entry.slice(at + 1)).trim();
      const label = at === -1 ? sid : entry.slice(0, at).trim();
      return { label: label || sid, sid };
    })
    .filter((f) => /^FW[0-9a-f]{32}$/i.test(f.sid));

export const twilioEnv = {
  accountSid: clean(process.env.TWILIO_ACCOUNT_SID),
  authToken: clean(process.env.TWILIO_AUTH_TOKEN),
  apiKey: clean(process.env.TWILIO_API_KEY),
  apiSecret: clean(process.env.TWILIO_API_SECRET),
  twimlAppSid: clean(process.env.TWILIO_TWIML_APP_SID),
  /**
   * The DEFAULT sender and caller ID, not the only one. The dashboard offers
   * every number the account owns and the choice is validated per send, so
   * this may be left blank.
   */
  phoneNumber: clean(process.env.TWILIO_PHONE_NUMBER),
  /**
   * The WhatsApp sender, which is NOT the voice number. Twilio issues it
   * separately and it is written `whatsapp:+1...`; the prefix is added when
   * sending, so this holds the bare number. Falls back to the sandbox number
   * being unset, which simply means WhatsApp is off.
   */
  whatsappFrom: clean(process.env.TWILIO_WHATSAPP_FROM),
  studioFlows: parseStudioFlows(clean(process.env.TWILIO_STUDIO_FLOWS)),
};

/**
 * Maps for the Prospector. All free OpenStreetMap services by default; each can
 * be pointed at a paid or self-hosted mirror if the business outgrows the
 * public servers' fair-use limits. No key is needed, so the feature is always on.
 */
export const mapsEnv = {
  nominatimUrl: clean(process.env.NOMINATIM_BASE_URL) || 'https://nominatim.openstreetmap.org/search',
  overpassUrls: (clean(process.env.OVERPASS_BASE_URL)
    ? [clean(process.env.OVERPASS_BASE_URL)]
    : ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter']),
  tileUrl: clean(process.env.NEXT_PUBLIC_MAP_TILE_URL) || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
};

/** Payment providers. None are wired until their credentials are supplied. */
export const paymentEnv = {
  paypal: {
    clientId: clean(process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID),
    secret: clean(process.env.PAYPAL_SECRET),
    env: clean(process.env.NEXT_PUBLIC_PAYPAL_ENV) || 'sandbox',
  },
  cardCheckoutEnabled: clean(process.env.NEXT_PUBLIC_ENABLE_CARD_CHECKOUT) === 'true',
};

/**
 * Feature flags derived from what is actually configured. Route handlers check
 * these and return a clean 503 instead of failing on a missing key.
 */
export const features = {
  database: isSupabaseConfigured,
  adminDatabase: isSupabaseAdminConfigured,
  email: Boolean(resendEnv.apiKey || (smtpEnv.host && smtpEnv.user && smtpEnv.pass)),
  paypal: Boolean(paymentEnv.paypal.clientId && paymentEnv.paypal.secret),
  cardCheckout: paymentEnv.cardCheckoutEnabled,
  liveChat: Boolean(chatwootEnv.baseUrl && chatwootEnv.websiteToken),
  /** The webhook that turns a chat into a lead, separate from the widget. */
  liveChatWebhook: Boolean(chatwootEnv.webhookSecret),
  /** Reading Twilio's own logs and sending from the dashboard. */
  twilio: Boolean(twilioEnv.accountSid && twilioEnv.apiKey && twilioEnv.apiSecret),
  /**
   * Sending needs a number to send FROM, but not this env var: the dashboard
   * lists the numbers the account actually owns and the sender is picked at
   * send time, validated server-side against that list. TWILIO_PHONE_NUMBER
   * is only the default pick, so a deployment with numbers but no default
   * still works.
   */
  twilioSms: Boolean(twilioEnv.accountSid && twilioEnv.apiKey && twilioEnv.apiSecret),
  twilioWhatsApp: Boolean(twilioEnv.accountSid && twilioEnv.apiKey && twilioEnv.apiSecret && twilioEnv.whatsappFrom),
  /**
   * Calling from the browser. Needs the API key to sign the token and the
   * TwiML app to route the call. The auth token is in there because the
   * webhook proves itself with it - without it the call connects to a route
   * that refuses every request. The caller ID, like the SMS sender, is
   * chosen per call rather than fixed here.
   */
  twilioVoice: Boolean(
    twilioEnv.accountSid &&
    twilioEnv.authToken &&
    twilioEnv.apiKey &&
    twilioEnv.apiSecret &&
    twilioEnv.twimlAppSid
  ),
  twilioFlows: Boolean(twilioEnv.accountSid && twilioEnv.apiKey && twilioEnv.apiSecret && twilioEnv.studioFlows.length),
  /** Other domains posting forms into Leads. Off until the secret is long enough. */
} as const;

export type FeatureName = keyof typeof features;

/** Names of the env vars backing each feature, for the health endpoint. */
export const featureRequirements: Record<FeatureName, string[]> = {
  database: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
  adminDatabase: ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
  email: ['RESEND_API_KEY (preferred) or SMTP_HOST + SMTP_USER + SMTP_PASS'],
  paypal: ['NEXT_PUBLIC_PAYPAL_CLIENT_ID', 'PAYPAL_SECRET'],
  cardCheckout: ['NEXT_PUBLIC_ENABLE_CARD_CHECKOUT'],
  liveChat: ['NEXT_PUBLIC_CHATWOOT_BASE_URL', 'NEXT_PUBLIC_CHATWOOT_WEBSITE_TOKEN'],
  liveChatWebhook: ['CHATWOOT_WEBHOOK_SECRET'],
  twilio: ['TWILIO_ACCOUNT_SID', 'TWILIO_API_KEY', 'TWILIO_API_SECRET'],
  twilioSms: ['TWILIO_ACCOUNT_SID', 'TWILIO_API_KEY', 'TWILIO_API_SECRET'],
  twilioWhatsApp: ['TWILIO_ACCOUNT_SID', 'TWILIO_API_KEY', 'TWILIO_API_SECRET', 'TWILIO_WHATSAPP_FROM'],
  twilioVoice: [
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_API_KEY',
    'TWILIO_API_SECRET',
    'TWILIO_TWIML_APP_SID',
  ],
  twilioFlows: ['TWILIO_STUDIO_FLOWS'],
};

/** Guard for routes that need a feature. Returns null when available. */
export function featureUnavailable(name: FeatureName): Response | null {
  if (features[name]) return null;
  return Response.json(
    {
      error: 'feature_unavailable',
      feature: name,
      message: `${name} is not configured for this deployment.`,
      missing: featureRequirements[name],
    },
    { status: 503 }
  );
}
