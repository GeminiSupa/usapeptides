export interface SourceProduct {
  id: string;
  sku: string | null;
  name: string;
  category: string;
  descriptionEn: string;
  descriptionEs: string;
  imageUrl: string | null;
  productUrl: string | null;
  priceUsd: number;
  priceCrc: number | null;
  priceBasis: string | null;
  compareAtPriceUsd: number | null;
  discountLabel: string | null;
  availability: 'in_stock' | 'out_of_stock' | 'discontinued';
  inventoryCount: number | null;
  coaUrl: string | null;
  updatedAt: string;
}

export class FeedValidationError extends Error {}
export function normalizeSourceProduct(input: unknown): { ok: true; value: SourceProduct } | { ok: false; errors: string[] };
export function parseFeed(rawBody: Buffer | string): { products: SourceProduct[]; meta: Record<string, unknown> };
export function slugifyProduct(value: unknown): string;
export function priceMirror(product: SourceProduct): { price: number; sale_price: number | null };
export function productIdentity(source: string, externalId: string): string;
export function buildProductColumns(product: SourceProduct, options?: { source?: string; now?: string; isNew?: boolean }): Record<string, unknown>;
export function buildTranslations(product: SourceProduct, productId: string, now?: string): Record<string, unknown>[];
export function buildPrices(product: SourceProduct, productId: string): Record<string, unknown>[];
export function verifyFeedSignature(input: { rawBody: Buffer | string; timestamp: string | null; signature: string | null; signed: string | null; secret: string; now?: number }): true;
export function isSafeFullResponse(input: { mode: string; requestWasFiltered: boolean; meta: Record<string, unknown>; receivedCount: number; errorsCount: number }): boolean;
export function classifyFeedResponse(status: number): 'not_modified' | 'body' | 'error';
export function sanitizeSyncError(error: unknown): string;
