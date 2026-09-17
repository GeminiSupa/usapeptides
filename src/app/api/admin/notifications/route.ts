import { requireAdmin } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { badRequest, ok, readJson, serverError } from '@/lib/api';

export const dynamic = 'force-dynamic';

const SELECT = 'id,kind,title,body,link,is_read,created_at';

const migrationMissing = (error: { code?: string; message?: string } | null) =>
  Boolean(error && (error.code === '42P01' || /admin_notification_reads|schema cache|does not exist/i.test(error.message ?? '')));

export async function GET(req: Request) {
  const auth = await requireAdmin(req, { permission: 'notifications' });
  if (!auth.ok) return auth.response;
  const db = getSupabaseAdmin();
  const { data: notifications, error } = await db
    .from('admin_notifications')
    .select(SELECT)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return serverError(error.message);

  const ids = (notifications ?? []).map((item) => item.id);
  let readIds = new Set<string>();
  let perUserReads = true;
  if (ids.length) {
    const reads = await db
      .from('admin_notification_reads')
      .select('notification_id')
      .eq('admin_user_id', auth.admin.id)
      .in('notification_id', ids);
    if (migrationMissing(reads.error)) perUserReads = false;
    else if (reads.error) return serverError(reads.error.message);
    else readIds = new Set((reads.data ?? []).map((row) => String(row.notification_id)));
  }

  const items = (notifications ?? []).map((item) => ({
    ...item,
    is_read: perUserReads ? readIds.has(item.id) : Boolean(item.is_read),
  }));
  return ok({
    notifications: items,
    unreadCount: items.filter((item) => !item.is_read).length,
    perUserReads,
  });
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin(req, { permission: 'notifications' });
  if (!auth.ok) return auth.response;
  const body = await readJson<{ id?: string; markAllRead?: boolean; unread?: boolean }>(req);
  if (!body || (!body.id && !body.markAllRead)) return badRequest('Choose a notification or mark all as read.');
  const db = getSupabaseAdmin();

  let ids: string[] = [];
  if (body.markAllRead) {
    const rows = await db.from('admin_notifications').select('id').limit(500);
    if (rows.error) return serverError(rows.error.message);
    ids = (rows.data ?? []).map((row) => row.id);
  } else if (body.id) {
    const exists = await db.from('admin_notifications').select('id').eq('id', body.id).maybeSingle();
    if (exists.error) return serverError(exists.error.message);
    if (!exists.data) return badRequest('Notification not found.');
    ids = [body.id];
  }
  if (!ids.length) return ok({ updated: 0 });

  if (body.unread && body.id) {
    const removed = await db.from('admin_notification_reads').delete().eq('admin_user_id', auth.admin.id).eq('notification_id', body.id);
    if (!removed.error) return ok({ updated: 1 });
    if (!migrationMissing(removed.error)) return serverError(removed.error.message);
    const fallback = await db.from('admin_notifications').update({ is_read: false }).eq('id', body.id);
    return fallback.error ? serverError(fallback.error.message) : ok({ updated: 1 });
  }

  const rows = ids.map((notification_id) => ({ admin_user_id: auth.admin.id, notification_id }));
  const saved = await db.from('admin_notification_reads').upsert(rows, { onConflict: 'admin_user_id,notification_id' });
  if (!saved.error) return ok({ updated: ids.length });
  if (!migrationMissing(saved.error)) return serverError(saved.error.message);

  const fallback = await db.from('admin_notifications').update({ is_read: true }).in('id', ids);
  return fallback.error ? serverError(fallback.error.message) : ok({ updated: ids.length, perUserReads: false });
}
