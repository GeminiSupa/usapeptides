import 'server-only';

import { getSupabaseAdmin } from './supabaseAdmin';
import { fireTrigger } from './automationEngine';
import type { InboundLead } from './leadIntake';

/**
 * Write one form submission into Leads.
 *
 * A person who already has a lead keeps their status and the notes a
 * salesperson wrote. The new message is added as activity instead of
 * replacing that. A brand-new person becomes a lead with status "new",
 * unassigned, and starts the "new lead" email sequence when they left an email.
 */

export interface RecordedLead {
  id: string;
  created: boolean;
}

type Row = { id?: string; notes?: string | null };

export async function recordInboundLead(lead: InboundLead): Promise<RecordedLead> {
  const db = getSupabaseAdmin();
  const now = new Date().toISOString();
  const existing = await findExisting(lead);

  if (existing?.id) {
    const patch: Record<string, unknown> = { last_contacted_at: now };
    if (lead.phone) patch.phone = lead.phone;
    if (lead.name) patch.full_name = lead.name;
    if (lead.institution) patch.institution = lead.institution;
    if (lead.email) patch.email = lead.email;
    if (!existing.notes && lead.message) patch.notes = lead.message;

    const { error } = await db.from('leads').update(patch).eq('id', existing.id);
    if (error) throw new Error(error.message);

    await logActivity(existing.id, lead);
    return { id: existing.id, created: false };
  }

  const { data, error } = await db.from('leads').insert({
    email: lead.email,
    phone: lead.phone,
    full_name: lead.name,
    institution: lead.institution,
    source: lead.site,
    notes: lead.message,
    last_contacted_at: now,
  }).select('id').single();

  if (error || !data?.id) throw new Error(error?.message || 'The lead could not be saved.');

  await logActivity(data.id, lead);
  await notify(lead);
  if (lead.email) {
    await fireTrigger('lead_created', {
      email: lead.email,
      name: lead.name,
      source: 'lead',
      subjectType: 'lead',
      subjectId: String(data.id),
    });
  }
  return { id: data.id, created: true };
}

async function findExisting(lead: InboundLead): Promise<Row | null> {
  const db = getSupabaseAdmin();
  if (lead.email) {
    const { data, error } = await db.from('leads').select('id, notes').eq('email', lead.email)
      .order('created_at', { ascending: false }).limit(1);
    if (error) throw new Error(error.message);
    if (data?.[0]?.id) return data[0];
  }
  if (lead.phone) {
    const { data, error } = await db.from('leads').select('id, notes').eq('phone', lead.phone)
      .order('created_at', { ascending: false }).limit(1);
    if (error) throw new Error(error.message);
    if (data?.[0]?.id) return data[0];
  }
  return null;
}

async function logActivity(leadId: string, lead: InboundLead) {
  const body = lead.message
    ? `Form on ${lead.site}: ${lead.message}`
    : `Form submitted on ${lead.site}.`;
  const { error } = await getSupabaseAdmin().from('crm_activity').insert({
    subject_type: 'lead',
    subject_id: leadId,
    activity: 'note',
    body: body.slice(0, 2000),
    actor: `Form on ${lead.site}`.slice(0, 200),
  });
  if (error) console.warn('[lead-intake] activity log failed:', error.message);
}

async function notify(lead: InboundLead) {
  const who = lead.name || lead.email || lead.phone || 'Someone';
  const { error } = await getSupabaseAdmin().from('admin_notifications').insert({
    kind: 'lead',
    title: `New lead from ${lead.site}`,
    body: who,
    link: '/admin?section=leads',
  });
  if (error) console.warn('[lead-intake] notification failed:', error.message);
}
