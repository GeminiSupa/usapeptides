import 'server-only';

/** Shared helpers for route handlers: consistent shapes and light validation. */

export function ok<T>(data: T, init?: ResponseInit) {
  return Response.json({ data }, { status: 200, ...init });
}

export function created<T>(data: T) {
  return Response.json({ data }, { status: 201 });
}

export function badRequest(message: string, fields?: Record<string, string>) {
  return Response.json({ error: 'bad_request', message, fields }, { status: 400 });
}

export function notFound(message = 'Not found') {
  return Response.json({ error: 'not_found', message }, { status: 404 });
}

export function serverError(message = 'Unexpected server error') {
  return Response.json({ error: 'server_error', message }, { status: 500 });
}

/** Parse a JSON body, returning null rather than throwing on malformed input. */
export async function readJson<T = Record<string, unknown>>(
  req: Request
): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isEmail = (v: unknown): v is string =>
  typeof v === 'string' && EMAIL.test(v.trim());

export const isNonEmpty = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0;

/** Trim and cap a string so a hostile payload cannot store unbounded text. */
export const clip = (v: unknown, max = 2000): string =>
  typeof v === 'string' ? v.trim().slice(0, max) : '';

/** Order numbers are human-quotable: USP-<base36 time>-<random>. */
export function generateOrderNumber(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `USP-${stamp}-${rand}`;
}
