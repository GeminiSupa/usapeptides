import { requireAdmin } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { features, featureRequirements } from '@/lib/env';
import { ok } from '@/lib/api';

export const dynamic='force-dynamic';
export async function GET(req:Request){
 const auth=await requireAdmin(req,{superadmin:true});if(!auth.ok)return auth.response;
 const db=getSupabaseAdmin();
 const checks=[
  ['Core store','products','id,stock_count'],['Orders','orders','id,inventory_released'],
  ['Users','admin_users','id,role,referral_code'],['Seller earnings','sales_commissions','id,status'],
  ['Articles','articles','id,is_published'],['Fulfilment','fulfillment_queue','id,stage'],
  ['CRM','crm_activity','id,subject_type'],['Notifications','admin_notifications','id,is_read'],
  ['Notification read state','admin_notification_reads','admin_user_id,notification_id'],
  ['Categories','product_categories','id,name,slug,is_active'],
 ] as const;
 const database=[] as {name:string;table:string;ok:boolean;message:string}[];
 for(const [name,table,select] of checks){const {error}=await db.from(table).select(select,{head:true,count:'exact'}).limit(1);database.push({name,table,ok:!error,message:error?.message??'Ready'});}
 const integrations=Object.entries(features).map(([name,enabled])=>({name,enabled,required:featureRequirements[name as keyof typeof featureRequirements]}));
 return ok({database,integrations,checkedAt:new Date().toISOString()});
}
