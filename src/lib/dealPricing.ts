import 'server-only';
import { roundMoney } from './checkout';

interface DealLine { product_id: string; quantity: number; line_total: number }
export async function bestDealDiscount(db: any, lines: DealLine[]) {
  const now = new Date().toISOString();
  const result = await db.from('deals')
    .select('id,title,discount_type,discount_value,min_quantity,max_quantity,applies_to_all,starts_at,ends_at,deal_products(product_id)')
    .eq('is_active', true).or(`starts_at.is.null,starts_at.lte.${now}`).or(`ends_at.is.null,ends_at.gt.${now}`);
  if (result.error) {
    if (/discount_type|deal_products|schema cache|does not exist/i.test(result.error.message)) return null;
    throw new Error(result.error.message);
  }
  let best: { id:string; title:string; amount:number } | null = null;
  for (const deal of result.data ?? []) {
    const ids = new Set((deal.deal_products ?? []).map((item:any) => item.product_id));
    const eligible = lines.filter((line) => deal.applies_to_all || ids.has(line.product_id));
    const quantity = eligible.reduce((sum, line) => sum + line.quantity, 0);
    if (quantity < Number(deal.min_quantity ?? 1) || (deal.max_quantity != null && quantity > Number(deal.max_quantity))) continue;
    const value = Number(deal.discount_value ?? 0);
    const eligibleTotal = eligible.reduce((sum, line) => sum + Number(line.line_total), 0);
    const amount = roundMoney(Math.min(eligibleTotal, deal.discount_type === 'fixed' ? value : eligibleTotal * value / 100));
    if (amount > 0 && (!best || amount > best.amount)) best = { id: deal.id, title: deal.title, amount };
  }
  return best;
}
