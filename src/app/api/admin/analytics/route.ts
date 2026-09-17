import { requireAdmin } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { featureUnavailable } from '@/lib/env';
import { ok, serverError } from '@/lib/api';

export const dynamic = 'force-dynamic';
export async function GET(req:Request){
  const unavailable=featureUnavailable('adminDatabase');if(unavailable)return unavailable;
  const auth=await requireAdmin(req,{permission:'analytics'});if(!auth.ok)return auth.response;
  const db=getSupabaseAdmin();const since=new Date(Date.now()-90*86400_000).toISOString();
  const [ordersResult,productsResult,leadsResult,cartsResult]=await Promise.all([
    db.from('orders').select('id, grand_total, status, created_at').gte('created_at',since),
    db.from('products').select('id, name, stock_count, is_active').eq('is_active',true).order('stock_count',{ascending:true}).limit(10),
    db.from('leads').select('id, status, source, created_at').gte('created_at',since),
    db.from('abandoned_carts').select('id, cart_total, recovered, created_at').gte('created_at',since),
  ]);
  const error=ordersResult.error||productsResult.error||leadsResult.error||cartsResult.error;if(error)return serverError(error.message);
  const orders=ordersResult.data??[];const valid=orders.filter(o=>!['cancelled','refunded'].includes(o.status));
  const daily=new Map<string,{date:string;orders:number;revenue:number}>();
  for(const order of valid){const date=String(order.created_at).slice(0,10);const row=daily.get(date)??{date,orders:0,revenue:0};row.orders++;row.revenue+=Number(order.grand_total)||0;daily.set(date,row);}
  const statuses:Record<string,number>={};for(const order of orders)statuses[order.status]=(statuses[order.status]??0)+1;
  const leadStatuses:Record<string,number>={};for(const lead of leadsResult.data??[])leadStatuses[lead.status]=(leadStatuses[lead.status]??0)+1;
  const carts=cartsResult.data??[];return ok({
    totals:{orders:orders.length,revenue:valid.reduce((s,o)=>s+Number(o.grand_total||0),0),averageOrder:valid.length?valid.reduce((s,o)=>s+Number(o.grand_total||0),0)/valid.length:0,leads:(leadsResult.data??[]).length,abandonedCarts:carts.filter(c=>!c.recovered).length,recoveredCarts:carts.filter(c=>c.recovered).length},
    daily:Array.from(daily.values()).sort((a,b)=>a.date.localeCompare(b.date)),statuses,leadStatuses,lowStock:productsResult.data??[],generatedAt:new Date().toISOString()
  });
}
