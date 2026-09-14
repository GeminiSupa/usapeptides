/** Shared checkout pricing rules used by the storefront and order API. */

export const FREE_SHIPPING_THRESHOLD = 100;
export const FLAT_SHIPPING = 12;

/** Volume tiers, mirroring the storefront's bulk pricing table. */
export function tierDiscount(quantity: number): number {
  if (quantity >= 10) return 0.2;
  if (quantity >= 5) return 0.15;
  if (quantity >= 3) return 0.1;
  return 0;
}

export const roundMoney = (n: number) => Math.round(n * 100) / 100;
