import { timingSafeEqual } from 'node:crypto';

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { chatwootEnv, features } from '@/lib/env';
import { ok, badRequest, serverError, readJson, clip } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Chatwoot webhook: a chat becomes a lead in the dashboard.
 *
 * Point Chatwoot at
 *   https://<site>/api/webhooks/chatwoot?token=<CHATWOOT_WEBHOOK_SECRET>
 *
 * Chatwoot does not sign its webhooks, so that shared secret is the whole of
 * the authentication. Without it anybody who found this URL could invent
 * customers and conversations in the CRM. Compared with a timing-safe
 * comparison so the secret cannot be recovered a character at a time.
 *
 * Events handled:
 *   conversation_created   -> a lead, if the contact left a way to reach them
 *   contact_created        -> same, for a contact captured via pre-chat
 *   contact_updated        -> fills in details added later in the conversation
 *   message_created        -> logged against the lead, incoming messages only
 *
 * Anything else is acknowledged and ignored: a webhook that returns an error
 * for an event it does not care about gets itself disabled by Chatwoot.
 */

interface ChatwootContact {
  id?: number;
  name?: string;
  email?: string;
  phone_number?: string;
  identifier?: string;
  custom_attributes?: Record<string, unknown>;
}

interface ChatwootPayload {
  event?: string;
  id?: number;
  /** conversation_created */
  meta?: { sender?: ChatwootContact };
  custom_attributes?: Record<string, unknown>;
  /** contact_* events put the contact at the top level */
  name?: string;
  email?: string;
  phone_number?: string;
  identifier?: string;
  /** message_created */
  content?: string;
  message_type?: string;
  conversation?: { id?: number };
  sender?: ChatwootContact;
}

/** Constant-time string compare that does not leak length through timing. */
function secretMatches(supplied: string, expected: string): boolean {
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    // Still do a comparison so a wrong length is not measurably faster.
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

const asText = (v: unknown): string | null => {
  const text = clip(v, 300);
  return text || null;
};

export async function POST(req: Request) {
  if (!features.liveChatWebhook) {
    // Deliberately not a 404: the person setting this up needs to know the
    // endpoint exists and what is missing.
    return Response.json(
      {
        error: 'feature_unavailable',
        message: 'Set CHATWOOT_WEBHOOK_SECRET and redeploy before pointing Chatwoot here.',
      },
      { status: 503 }
    );
  }

  const supplied = new URL(req.url).searchParams.get('token') ?? '';
  if (!supplied || !secretMatches(supplied, chatwootEnv.webhookSecret)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await readJson<ChatwootPayload>(req);
  if (!body || typeof body !== 'object') return badRequest('Body must be JSON.');

  const event = String(body.event ?? '');

  try {
    switch (event) {
      case 'conversation_created':
        return await recordLead(body.meta?.sender ?? {}, {
          conversationId: body.id,
          attributes: body.custom_attributes,
        });

      case 'contact_created':
      case 'contact_updated':
        return await recordLead(
          {
            name: body.name,
            email: body.email,
            phone_number: body.phone_number,
            identifier: body.identifier,
            custom_attributes: body.custom_attributes,
          },
          {}
        );

      case 'message_created':
        return await logMessage(body);

      default:
        return ok({ ignored: event || 'unknown' });
    }
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined);
  }
}

/* -------------------------------------------------------------------------- */

async function recordLead(
  contact: ChatwootContact,
  extra: { conversationId?: number; attributes?: Record<string, unknown> }
) {
  const email = asText(contact.email)?.toLowerCase() ?? null;
  const phone = asText(contact.phone_number);

  // No way to reach them is not a lead. The conversation still exists in
  // Chatwoot; there is just nothing to follow up in the CRM.
  if (!email && !phone) return ok({ skipped: 'no email or phone on the contact' });

  const db = getSupabaseAdmin();

  const noteParts = ['Started a live chat.'];
  if (extra.conversationId) noteParts.push(`Chatwoot conversation #${extra.conversationId}.`);

  const page = extra.attributes?.current_page;
  if (typeof page === 'string' && page) noteParts.push(`On ${clip(page, 120)}.`);

  const cart = extra.attributes?.cart_contents;
  if (typeof cart === 'string' && cart) noteParts.push(`Cart: ${clip(cart, 400)}.`);

  const row = {
    email,
    phone,
    full_name: asText(contact.name),
    institution: asText(contact.custom_attributes?.institution),
    source: 'live_chat',
    notes: noteParts.join(' '),
    last_contacted_at: new Date().toISOString(),
  };

  // Match on whichever identifier we have. Not `upsert`: the table has no
  // unique constraint on either column, so a conflict target would be rejected.
  const lookup = db.from('leads').select('id, notes');
  const { data: existing, error: lookupError } = email
    ? await lookup.ilike('email', email).maybeSingle()
    : await lookup.eq('phone', phone!).maybeSingle();

  if (lookupError) return serverError(lookupError.message);

  if (existing?.id) {
    // An existing lead keeps its notes and status. Only the contact details
    // and the last-contacted stamp are refreshed, so a returning chatter does
    // not wipe what a salesperson wrote against them.
    const { error } = await db
      .from('leads')
      .update({
        phone: row.phone ?? undefined,
        full_name: row.full_name ?? undefined,
        institution: row.institution ?? undefined,
        last_contacted_at: row.last_contacted_at,
      })
      .eq('id', existing.id);

    if (error) return serverError(error.message);

    await logActivity(existing.id, 'note', row.notes);
    return ok({ lead: existing.id, created: false });
  }

  const { data: created, error } = await db.from('leads').insert(row).select('id').single();
  if (error) return serverError(error.message);

  await logActivity(created.id, 'note', row.notes);
  return ok({ lead: created.id, created: true });
}

async function logMessage(body: ChatwootPayload) {
  // Outgoing messages are the team's own replies; logging those would just
  // mirror Chatwoot's transcript into the CRM.
  if (body.message_type !== 'incoming') return ok({ ignored: 'not an incoming message' });

  const content = clip(body.content, 1500);
  if (!content) return ok({ ignored: 'empty message' });

  const email = asText(body.sender?.email)?.toLowerCase() ?? null;
  if (!email) return ok({ skipped: 'no email on the sender' });

  const db = getSupabaseAdmin();
  const { data: lead } = await db
    .from('leads')
    .select('id')
    .ilike('email', email)
    .maybeSingle();

  if (!lead?.id) return ok({ skipped: 'no matching lead' });

  await db
    .from('leads')
    .update({ last_contacted_at: new Date().toISOString() })
    .eq('id', lead.id);

  await logActivity(lead.id, 'note', `Chat message: ${content}`);
  return ok({ lead: lead.id, logged: true });
}

async function logActivity(leadId: string, activity: string, bodyText: string) {
  // Best effort. A failure here must not make Chatwoot retry a webhook whose
  // real work - the lead itself - already succeeded.
  const { error } = await getSupabaseAdmin().from('crm_activity').insert({
    subject_type: 'lead',
    subject_id: leadId,
    activity,
    body: bodyText,
    actor: 'Live chat',
  });

  if (error) console.warn('[chatwoot] activity log failed:', error.message);
}
