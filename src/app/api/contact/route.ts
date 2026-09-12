import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { featureUnavailable } from '@/lib/env';
import { created, badRequest, serverError, readJson, isEmail, isNonEmpty, clip } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** POST /api/contact - store a customer enquiry for follow-up. */
export async function POST(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const body = await readJson<Record<string, unknown>>(req);
  if (!body) return badRequest('Request body must be valid JSON.');

  const fields: Record<string, string> = {};
  if (!isNonEmpty(body.name)) fields.name = 'Name is required.';
  if (!isEmail(body.email)) fields.email = 'A valid email address is required.';
  if (!isNonEmpty(body.message)) fields.message = 'Message is required.';
  if (Object.keys(fields).length) return badRequest('Enquiry rejected.', fields);

  try {
    const { error } = await getSupabaseAdmin().from('customer_inquiries').insert({
      name: clip(body.name, 200),
      email: clip(body.email, 320).toLowerCase(),
      institution: clip(body.institution, 200) || null,
      subject: clip(body.subject, 300) || null,
      message: clip(body.message, 5000),
    });

    if (error) return serverError(error.message);
    return created({ received: true });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
