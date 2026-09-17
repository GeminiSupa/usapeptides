import { requireAdmin } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { badRequest, created, ok, readJson, serverError, clip } from '@/lib/api';

export const dynamic = 'force-dynamic';
const SELECT = 'id,title,discount_type,discount_value,min_quantity,max_quantity,applies_to_all,banner_text,banner_href,starts_at,ends_at,is_active,created_at,deal_products(product_id)';
const missing = (message = '') => /discount_type|deal_products|schema cache|does not exist/i.test(message);

async function auth(req: Request) { return requireAdmin(req, { permission: 'deals' }); }
function values(body: Record<string, unknown>) {
  const type = body.discount_type === 'fixed' ? 'fixed' : 'percent';
  const value = Number(body.discount_value);
  const min = Math.max(1, Math.floor(Number(body.min_quantity) || 1));
  const max = body.max_quantity === '' || body.max_quantity == null ? null : Math.floor(Number(body.max_quantity));
  if (!clip(body.title, 160)) throw new Error('Title is required.');
  if (!Number.isFinite(value) || value <= 0 || (type === 'percent' && value > 100)) throw new Error(type === 'percent' ? 'Percentage must be between 0 and 100.' : 'Discount value must be greater than zero.');
  if (max !== null && max < min) throw new Error('Maximum quantity must be empty or at least the minimum quantity.');
  const starts = body.starts_at ? new Date(String(body.starts_at)) : null;
  const ends = body.ends_at ? new Date(String(body.ends_at)) : null;
  if (starts && Number.isNaN(starts.getTime()) || ends && Number.isNaN(ends.getTime())) throw new Error('Enter valid start and end dates.');
  if (starts && ends && ends <= starts) throw new Error('The end must be after the start.');
  return { title: clip(body.title,160), discount_type:type, discount_value:value, min_quantity:min, max_quantity:max, applies_to_all:Boolean(body.applies_to_all), banner_text:clip(body.banner_text,220)||null, banner_href:clip(body.banner_href,500)||null, starts_at:starts?.toISOString()??null, ends_at:ends?.toISOString()??null, is_active:body.is_active!==false, updated_at:new Date().toISOString() };
}

export async function GET(req: Request) {
  const access=await auth(req); if(!access.ok)return access.response; const db=getSupabaseAdmin();
  const [deals,products]=await Promise.all([db.from('deals').select(SELECT).order('created_at',{ascending:false}),db.from('products').select('id,name,sku,is_active').order('name')]);
  if(deals.error)return serverError(missing(deals.error.message)?'Run migration 0014_deal_engine.sql, then reload.':deals.error.message);
  if(products.error)return serverError(products.error.message);
  return ok({deals:deals.data??[],products:products.data??[]});
}
export async function POST(req: Request) {
  const access=await auth(req); if(!access.ok)return access.response; const body=await readJson<Record<string,unknown>>(req); if(!body)return badRequest('Invalid request.');
  try { const row=values(body); const productIds=Array.isArray(body.product_ids)?body.product_ids.map(String):[]; if(!row.applies_to_all&&!productIds.length)return badRequest('Select at least one product or choose all products.'); const db=getSupabaseAdmin(); const saved=await db.from('deals').insert(row).select('id').single(); if(saved.error)return serverError(missing(saved.error.message)?'Run migration 0014_deal_engine.sql, then reload.':saved.error.message); if(productIds.length){const links=await db.from('deal_products').insert(productIds.map(product_id=>({deal_id:saved.data.id,product_id})));if(links.error){await db.from('deals').delete().eq('id',saved.data.id);return serverError(links.error.message);}} return created({id:saved.data.id}); } catch(e){return badRequest(e instanceof Error?e.message:'Invalid deal.');}
}
export async function PATCH(req: Request) {
  const access=await auth(req); if(!access.ok)return access.response; const body=await readJson<Record<string,unknown>>(req); const id=clip(body?.id,80); if(!body||!id)return badRequest('Deal id is required.');
  try { const row=values(body); const productIds=Array.isArray(body.product_ids)?body.product_ids.map(String):[]; if(!row.applies_to_all&&!productIds.length)return badRequest('Select at least one product or choose all products.'); const db=getSupabaseAdmin(); const saved=await db.from('deals').update(row).eq('id',id); if(saved.error)return serverError(saved.error.message); await db.from('deal_products').delete().eq('deal_id',id); if(productIds.length){const links=await db.from('deal_products').insert(productIds.map(product_id=>({deal_id:id,product_id})));if(links.error)return serverError(links.error.message);} return ok({updated:true}); } catch(e){return badRequest(e instanceof Error?e.message:'Invalid deal.');}
}
export async function DELETE(req: Request) { const access=await auth(req);if(!access.ok)return access.response;const id=new URL(req.url).searchParams.get('id');if(!id)return badRequest('Deal id is required.');const result=await getSupabaseAdmin().from('deals').delete().eq('id',id);return result.error?serverError(result.error.message):ok({deleted:true}); }
