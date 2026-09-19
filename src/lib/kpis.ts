/**
 * Every number on the Dashboard and Analytics, with what it means in plain
 * English. The (i) next to a number shows `help`.
 *
 * One list, so the same figure is explained the same way everywhere.
 */

export type KpiFormat = 'money' | 'count' | 'percent' | 'duration';

export interface KpiDef {
  id: string;
  label: string;
  help: string;
  format: KpiFormat;
  /** A rise is bad news (refunds, abandoned carts). Colours the change chip. */
  lowerIsBetter?: boolean;
  /** Dashboard section that must be open to see it. */
  section: string;
}

export const KPIS: KpiDef[] = [
  // Sales
  { id: 'revenue', label: 'Revenue', format: 'money', section: 'orders',
    help: 'Money from orders placed in this period, not counting pending (unpaid), cancelled or refunded orders. Includes shipping, after discounts.' },
  { id: 'orders', label: 'Paid orders', format: 'count', section: 'orders',
    help: 'Orders placed in this period that are paid or further along (processing, shipped, delivered or completed). Unpaid and cancelled orders are not counted.' },
  { id: 'aov', label: 'Average order', format: 'money', section: 'orders',
    help: 'Revenue divided by paid orders — how much a typical customer spends per order.' },
  { id: 'pendingOrders', label: 'Awaiting payment', format: 'count', section: 'orders',
    help: 'Orders placed in this period that are still marked pending — the customer has not paid yet, or the payment has not been confirmed. Follow these up.' },
  { id: 'pendingValue', label: 'Unpaid order value', format: 'money', section: 'orders',
    help: 'The total of the orders awaiting payment. Money you can still collect.' },
  { id: 'toShip', label: 'Waiting to ship', format: 'count', section: 'fulfillment',
    help: 'Paid or processing orders (any date) that have not been marked shipped yet.' },
  { id: 'unitsSold', label: 'Vials sold', format: 'count', section: 'orders',
    help: 'Total quantity of products in the paid orders of this period.' },
  { id: 'refunds', label: 'Refunded / cancelled', format: 'count', section: 'orders', lowerIsBetter: true,
    help: 'Orders placed in this period that were later cancelled or refunded.' },
  { id: 'discounts', label: 'Discounts given', format: 'money', section: 'orders',
    help: 'Total discount (coupons, bulk tiers, deals) on the paid orders of this period.' },

  // Customers
  { id: 'newCustomers', label: 'New customers', format: 'count', section: 'customers',
    help: 'People whose first ever paid order was in this period.' },
  { id: 'returningCustomers', label: 'Returning customers', format: 'count', section: 'customers',
    help: 'People with a paid order in this period who had also ordered before it.' },
  { id: 'repeatRate', label: 'Repeat rate', format: 'percent', section: 'customers',
    help: 'Of the customers who ordered in this period, the share who had ordered before. Higher means people come back.' },

  // Visitors
  { id: 'visitors', label: 'Visitors', format: 'count', section: 'analytics',
    help: 'Different people (browsers) who opened the website in this period. The same person on two devices counts twice. Bots are left out.' },
  { id: 'sessions', label: 'Visits', format: 'count', section: 'analytics',
    help: 'Separate browsing sessions. One person coming back tomorrow is two visits.' },
  { id: 'pageViews', label: 'Page views', format: 'count', section: 'analytics',
    help: 'Every page opened, including repeats.' },
  { id: 'pagesPerVisit', label: 'Pages per visit', format: 'count', section: 'analytics',
    help: 'Page views divided by visits. Higher usually means people are browsing, not bouncing.' },
  { id: 'bounceRate', label: 'Bounce rate', format: 'percent', section: 'analytics', lowerIsBetter: true,
    help: 'Share of visits that saw only one page and left.' },
  { id: 'avgVisit', label: 'Average visit', format: 'duration', section: 'analytics',
    help: 'Average time between the first and last activity of a visit.' },
  { id: 'liveNow', label: 'On the site now', format: 'count', section: 'analytics',
    help: 'Visits with activity in the last 5 minutes. Ignores the date range.' },
  { id: 'conversionRate', label: 'Conversion rate', format: 'percent', section: 'analytics',
    help: 'Share of visits that ended in an order. The most important sign of whether the website sells.' },

  // Funnel
  { id: 'productViews', label: 'Product views', format: 'count', section: 'analytics',
    help: 'Times a product page was opened.' },
  { id: 'addToCarts', label: 'Add to cart', format: 'count', section: 'analytics',
    help: 'Times someone pressed Add to cart.' },
  { id: 'checkouts', label: 'Reached checkout', format: 'count', section: 'analytics',
    help: 'Visits that opened the checkout page.' },

  // Carts
  { id: 'abandonedCarts', label: 'Abandoned carts', format: 'count', section: 'carts', lowerIsBetter: true,
    help: 'Carts with products that were started in this period and never turned into an order.' },
  { id: 'abandonedValue', label: 'Left in carts', format: 'money', section: 'carts', lowerIsBetter: true,
    help: 'The value of those abandoned carts — sales you could still win back with a reminder.' },
  { id: 'recoveredCarts', label: 'Recovered carts', format: 'count', section: 'carts',
    help: 'Carts from this period that went on to become an order.' },

  // Marketing & sales team
  { id: 'leads', label: 'New leads', format: 'count', section: 'leads',
    help: 'Leads created in this period — enquiries, chats, prospects copied across and people added by hand.' },
  { id: 'openLeads', label: 'Open leads', format: 'count', section: 'leads',
    help: 'Leads (any date) still marked new or working — people waiting for a follow-up.' },
  { id: 'enquiries', label: 'Enquiries', format: 'count', section: 'inquiries',
    help: 'Messages sent through the contact form in this period.' },
  { id: 'openEnquiries', label: 'Unanswered enquiries', format: 'count', section: 'inquiries', lowerIsBetter: true,
    help: 'Enquiries (any date) still marked new.' },
  { id: 'subscribers', label: 'New subscribers', format: 'count', section: 'subscribers',
    help: 'People who joined the newsletter in this period.' },
  { id: 'emailsSent', label: 'Emails sent', format: 'count', section: 'campaigns',
    help: 'Campaign emails delivered in this period.' },
  { id: 'openRate', label: 'Email open rate', format: 'percent', section: 'campaigns',
    help: 'Of the campaign emails sent in this period, the share opened at least once. Some mail apps hide opens, so the real number is usually higher.' },
  { id: 'clickRate', label: 'Email click rate', format: 'percent', section: 'campaigns',
    help: 'Of the campaign emails sent in this period, the share where a link was clicked.' },
  { id: 'prospects', label: 'Prospects saved', format: 'count', section: 'prospects',
    help: 'Businesses saved in the Prospector in this period.' },
  { id: 'commissionOwed', label: 'Commission to pay', format: 'money', section: 'commissions', lowerIsBetter: true,
    help: 'Seller and affiliate commission (any date) approved or pending but not yet paid out.' },

  // Catalogue & to-dos
  { id: 'lowStock', label: 'Low stock', format: 'count', section: 'products', lowerIsBetter: true,
    help: 'Live products with fewer than 5 units left. Ignores the date range.' },
  { id: 'outOfStock', label: 'Out of stock', format: 'count', section: 'products', lowerIsBetter: true,
    help: 'Live products with no units left. Ignores the date range.' },
  { id: 'pendingReviews', label: 'Reviews to approve', format: 'count', section: 'reviews',
    help: 'Customer reviews waiting for you to approve before they show on the site. Ignores the date range.' },
];

export const KPI = Object.fromEntries(KPIS.map((k) => [k.id, k])) as Record<string, KpiDef>;

export function formatKpi(value: number | null | undefined, format: KpiFormat): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  switch (format) {
    case 'money':
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: value >= 10_000 ? 0 : 2 }).format(value);
    case 'percent':
      return `${Math.round(value * 10) / 10}%`;
    case 'duration': {
      const s = Math.round(value);
      if (s < 60) return `${s}s`;
      const m = Math.floor(s / 60);
      return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
    }
    default:
      return Number.isInteger(value) ? value.toLocaleString('en-US') : (Math.round(value * 10) / 10).toLocaleString('en-US');
  }
}
