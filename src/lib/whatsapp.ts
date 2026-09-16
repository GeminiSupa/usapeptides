/**
 * Order on WhatsApp.
 *
 * The number lives in site_settings (row `whatsapp`), set in
 * Dashboard > Storefront, so each business using this template sets its own
 * without a redeploy. No number, or switched off, means no button anywhere.
 *
 * Shared by the admin API and the storefront, so it imports nothing.
 */

export const WHATSAPP_SETTING_ID = 'whatsapp';

export interface WhatsAppSettings {
  /** Digits only, international format without the plus: 15551234567. */
  number: string;
  enabled: boolean;
}

export const EMPTY_WHATSAPP: WhatsAppSettings = { number: '', enabled: false };

/**
 * Digits only. A 10-digit number is taken as US/Canada and gets the 1; any
 * other length must already carry its country code.
 */
export function cleanWhatsAppNumber(raw: unknown): string {
  let digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 10) digits = `1${digits}`;
  return digits;
}

/** wa.me accepts 8 to 15 digits (E.164). Anything else would open a dead chat. */
export const isValidWhatsAppNumber = (digits: string): boolean => /^\d{8,15}$/.test(digits);

export function normalizeWhatsApp(value: unknown): WhatsAppSettings {
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const number = cleanWhatsAppNumber(v.number);
  return {
    number: isValidWhatsAppNumber(number) ? number : '',
    enabled: v.enabled === true && isValidWhatsAppNumber(number),
  };
}

export interface WhatsAppOrderLine {
  name: string;
  quantity: number;
  unitPrice: number;
}

/** The message the customer sends, pre-filled so staff can quote straight away. */
export function buildOrderMessage(lines: WhatsAppOrderLine[], total?: number): string {
  const items = lines.map(
    (l) => `- ${l.quantity} x ${l.name} ($${l.unitPrice.toFixed(2)} each)`
  );
  const sum = total ?? lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  return [
    "Hi, I'd like to place an order:",
    ...items,
    `Total: $${sum.toFixed(2)} (before shipping)`,
    '',
    'These are for in-vitro research use only.',
  ].join('\n');
}

export const whatsAppLink = (number: string, message: string): string =>
  `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
