import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { ok, serverError } from '@/lib/api';
export const dynamic='force-dynamic';
export async function GET(){const now=new Date().toISOString();const result=await getSupabaseAdmin().from('deals').select('id,banner_text,banner_href,ends_at').eq('is_active',true).not('banner_text','is',null).or(`starts_at.is.null,starts_at.lte.${now}`).or(`ends_at.is.null,ends_at.gt.${now}`).order('created_at',{ascending:false});if(result.error){if(/banner_text|schema cache|does not exist/i.test(result.error.message))return ok({banners:[]});return serverError(result.error.message);}return ok({banners:(result.data??[]).map(d=>({id:`deal-${d.id}`,text:d.banner_text,href:d.banner_href||'/shop',isActive:true,endsAt:d.ends_at}))});}
