import { leadIntakeEnv } from '@/lib/env';
import { badRequest, created, readJson, serverError } from '@/lib/api';
import { parseLeadIntake, secretMatches } from '@/lib/leadIntake';
import { recordInboundLead } from '@/lib/inboundLead';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/leads/intake
 *
 * Other peptide sites post a contact form here. It becomes a lead in this CRM.
 * The caller must send LEAD_INTAKE_SECRET. Without that, anybody who found
 * the address could fill the lead list with junk.
 *
 *   Authorization: Bearer <secret>
 *
 * The secret belongs on the other site's server, never in browser code.
 */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, number[]>();

function tooMany(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

function suppliedSecret(req: Request): string {
  const header = req.headers.get('authorization') ?? '';
  const bearer = /^Bearer\s+(.+)$/i.exec(header)?.[1]?.trim();
  if (bearer) return bearer;
  const key = req.headers.get('x-lead-key')?.trim();
  if (key) return key;
  return new URL(req.url).searchParams.get('token')?.trim() ?? '';
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || 'unknown';
}

export async function POST(req: Request) {
  if (leadIntakeEnv.secret.length < 16) {
    return Response.json(
      {
        error: 'feature_unavailable',
        feature: 'leadIntake',
        message: 'Lead intake is not configured for this deployment.',
        missing: ['LEAD_INTAKE_SECRET (at least 16 characters)'],
      },
      { status: 503 }
    );
  }

  const supplied = suppliedSecret(req);
  if (!supplied || !secretMatches(supplied, leadIntakeEnv.secret)) {
    return Response.json({ error: 'unauthorised', message: 'Unauthorised.' }, { status: 401 });
  }

  if (tooMany(clientIp(req))) {
    return Response.json(
      { error: 'rate_limited', message: 'Too many leads from this address. Wait ten minutes and try again.' },
      { status: 429 }
    );
  }

  const body = await readJson<Record<string, unknown>>(req);
  if (!body || Array.isArray(body)) return badRequest('Request body must be a JSON object.');

  const parsed = parseLeadIntake(body);
  if (!parsed.ok) return badRequest(parsed.message, parsed.fields);

  try {
    const saved = await recordInboundLead(parsed.value);
    return created({ received: true, created: saved.created });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
