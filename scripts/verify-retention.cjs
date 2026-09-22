/* Integration check using isolated zz.* customer fixtures; never prints credentials.
 * Auth identities are injected for route scope checks, not real login testing.
 */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
require('@next/env').loadEnvConfig(process.cwd());
const { createClient } = require('@supabase/supabase-js');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
let identity, denied = false;
const cache = {};
function load(file) {
  if (file === 'server-only') return {};
  if (file === '@/lib/supabaseAdmin') return { getSupabaseAdmin: () => db };
  if (file === '@/lib/adminAuth') return { requireAdmin: async () => denied ? { ok: false, response: Response.json({}, { status: 403 }) } : { ok: true, admin: identity } };
  if (file === '@/lib/env') return { featureUnavailable: () => null };
  if (file === '@/lib/audit') return { writeAudit: async () => {} };
  if (!file.startsWith('@/') && !file.startsWith('.')) return require(file);
  const resolved = file.startsWith('@/') ? path.resolve('src', file.slice(2) + '.ts') : path.resolve(file);
  if (cache[resolved]) return cache[resolved].exports;
  const m = { exports: {} }; cache[resolved] = m;
  const code = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function('require','module','exports',code)(p => p.startsWith('.') ? load(path.resolve(path.dirname(resolved), p + '.ts')) : load(p),m,m.exports);
  return m.exports;
}
async function main() {
  const probe = await db.from('customer_retention').select('customer_id').limit(1);
  assert.equal(probe.error, null, 'Migration 0023 is not available');
  const publicRead = await anon.from('customer_retention').select('*').limit(1);
  assert.ok(publicRead.error, 'Anonymous access must be refused');
  const owner = await db.from('admin_users').select('id').eq('is_superadmin', true).limit(1).single();
  assert.ok(owner.data?.id, 'Need an existing owner reference for fixture ownership');
  const id = randomUUID();
  const email = `zz.retention.${id}@example.invalid`;
  try {
    const created = await db.from('customer_profiles').insert({ id, email, full_name: 'Retention verification fixture', owner_id: owner.data.id });
    assert.equal(created.error, null);
    const routes = load('@/app/api/admin/customers/[id]/route');
    const profile = { id: owner.data.id, tier: 'staff', role: 'staff', is_superadmin: true, status: 'active', permissions: ['customers'] };
    identity = { id: owner.data.id, profile };
    const payload = { notes: 'Fixture only', acquisition_source: 'Verification', reorder_days: 14, follow_up_after: '2026-10-01' };
    const request = p => new Request('http://localhost/api/admin/customers/'+id, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(p) });
    const params = { params: { id } };
    assert.equal((await routes.POST(request(payload),params)).status,200);
    const stored = await db.from('customer_retention').select('*').eq('customer_id',id).single();
    assert.equal(stored.data.notes, payload.notes); assert.equal(stored.data.reorder_days,14);
    for (const change of [{ reorder_days:0 }, { reorder_days:1.5 }, { notes:'x'.repeat(5001) }, { follow_up_after:'2026-02-30' }]) assert.equal((await routes.POST(request({...payload,...change}),params)).status,400);
    identity = { id: randomUUID(), profile:{ ...profile, role:'sales_agent', is_superadmin:false } };
    assert.equal((await routes.POST(request(payload),params)).status,404);
    assert.equal((await routes.GET(new Request('http://localhost/api/admin/customers/'+id),params)).status,404);
    identity = { id:owner.data.id, profile:{ ...profile, role:'sales_agent', is_superadmin:false } };
    assert.equal((await routes.POST(request(payload),params)).status,200);
    denied = true;
    assert.equal((await routes.POST(request(payload),params)).status,403);
    const { canAccess } = load('@/lib/permissions');
    assert.equal(canAccess('customers',{...profile,is_superadmin:false,permissions:[]}),false);
    assert.equal(canAccess('customers',{...profile,tier:'sub_user'}),false);
    assert.equal(canAccess('customers',{...profile,status:'suspended'}),false);
    console.log('PASS: live schema, anonymous denial, saved fields, invalid input, assigned/other-agent scope, permission policy. Auth gate injected; no real staff logins used.');
  } finally {
    const removed = await db.from('customer_profiles').delete().eq('id',id).eq('email',email);
    assert.equal(removed.error,null);
    const remaining = await db.from('customer_retention').select('customer_id').eq('customer_id',id);
    assert.equal(remaining.data?.length,0);
    console.log('Fixture customer and retention row removed.');
  }
}
main().catch(e => { console.error(e.message); process.exitCode=1; });
