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

/** Public business identity, used in page copy, emails and order records. */
export const BUSINESS = {
  name: 'USA Peptides',
  legalName: 'USA Peptides',
  domain: clean(process.env.NEXT_PUBLIC_SITE_URL) || 'https://usapeptides-six.vercel.app',
  supportEmail: clean(process.env.ORDER_NOTIFICATION_FROM) || 'info@usapeptides.com',
  country: 'US',
  currency: 'USD',
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
  email: Boolean(smtpEnv.host && smtpEnv.user && smtpEnv.pass),
  paypal: Boolean(paymentEnv.paypal.clientId && paymentEnv.paypal.secret),
  cardCheckout: paymentEnv.cardCheckoutEnabled,
  liveChat: Boolean(chatwootEnv.baseUrl && chatwootEnv.websiteToken),
  /** The webhook that turns a chat into a lead, separate from the widget. */
  liveChatWebhook: Boolean(chatwootEnv.webhookSecret),
} as const;

export type FeatureName = keyof typeof features;

/** Names of the env vars backing each feature, for the health endpoint. */
export const featureRequirements: Record<FeatureName, string[]> = {
  database: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
  adminDatabase: ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
  email: ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'],
  paypal: ['NEXT_PUBLIC_PAYPAL_CLIENT_ID', 'PAYPAL_SECRET'],
  cardCheckout: ['NEXT_PUBLIC_ENABLE_CARD_CHECKOUT'],
  liveChat: ['NEXT_PUBLIC_CHATWOOT_BASE_URL', 'NEXT_PUBLIC_CHATWOOT_WEBSITE_TOKEN'],
  liveChatWebhook: ['CHATWOOT_WEBHOOK_SECRET'],
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
