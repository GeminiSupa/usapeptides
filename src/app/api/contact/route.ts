import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { featureUnavailable } from '@/lib/env';
import { created, badRequest, serverError, readJson } from '@/lib/api';
import { cleanMultiline, cleanText, isEmail, isPersonName, isPhone, normaliseEmail } from '@/lib/validate';

export const dynamic = 'force-dynamic';

/** POST /api/contact - store a customer enquiry for follow-up. */
export async function POST(req: Request) {
  const unavailable = featureUnavailable('adminDatabase');
  if (unavailable) return unavailable;

  const body = await readJson<Record<string, unknown>>(req);
  if (!body) return badRequest('Request body must be valid JSON.');

  const name = cleanText(body.name, 200);
  const email = normaliseEmail(body.email);
  const phone = cleanText(body.phone, 50);
  const message = cleanMultiline(body.message, 5000);

  const fields: Record<string, string> = {};
  if (!isPersonName(name)) fields.name = 'Enter your name.';
  if (!isEmail(email)) fields.email = 'A valid email address is required.';
  // Ten characters keeps out the single-character submissions bots send.
  if (message.length < 10) fields.message = 'Enter a message of at least 10 characters.';
  if (phone && !isPhone(phone)) fields.phone = 'Enter a valid phone number, or leave it blank.';
  if (Object.keys(fields).length) return badRequest('Enquiry rejected.', fields);

  try {
    const { error } = await getSupabaseAdmin().from('customer_inquiries').insert({
      name,
      email,
      institution: cleanText(body.institution, 200) || null,
      subject: cleanText(body.subject, 300) || null,
      message,
    });

    if (error) return serverError(error.message);
    return created({ received: true });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}
