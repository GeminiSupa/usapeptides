import 'server-only';

/**
 * Whitelist of tables the admin dashboard may touch, and what may be done to
 * each. Anything not described here is unreachable through the admin API, so
 * a crafted resource name cannot reach an arbitrary table.
 */

export interface ResourceConfig {
  table: string;
  /** Columns returned by the list endpoint. */
  select: string;
  /** Default sort column, descending. */
  orderBy: string;
  /** Columns a text search may match. */
  searchable: string[];
  /** Columns PATCH may set. Empty means the resource is read-only. */
  editable: string[];
  /** Whether rows may be deleted. */
  deletable: boolean;
  /** Optional column that a `status` query filters on. */
  statusColumn?: string;
}

export const RESOURCES: Record<string, ResourceConfig> = {
  orders: {
    table: 'orders',
    select:
      'id, order_number, email, full_name, institution, status, grand_total, currency, payment_provider, tracking_number, created_at',
    orderBy: 'created_at',
    searchable: ['order_number', 'email', 'full_name'],
    editable: ['status', 'tracking_number', 'notes', 'payment_reference'],
    deletable: false,
    statusColumn: 'status',
  },
  products: {
    table: 'products',
    select:
      'id, slug, name, category, price, sale_price, sku, stock_count, in_stock, is_featured, is_active',
    orderBy: 'name',
    searchable: ['name', 'sku', 'slug'],
    editable: ['price', 'sale_price', 'stock_count', 'in_stock', 'is_featured', 'is_active'],
    deletable: false,
  },
  customers: {
    table: 'customer_profiles',
    select: 'id, email, full_name, institution, phone, marketing_opt_in, created_at',
    orderBy: 'created_at',
    searchable: ['email', 'full_name', 'institution'],
    editable: ['marketing_opt_in'],
    deletable: false,
  },
  inquiries: {
    table: 'customer_inquiries',
    select: 'id, name, email, institution, subject, message, status, created_at',
    orderBy: 'created_at',
    searchable: ['name', 'email', 'subject'],
    editable: ['status'],
    deletable: true,
    statusColumn: 'status',
  },
  reviews: {
    table: 'product_reviews',
    select: 'id, product_slug, author_name, institution, rating, body, is_approved, created_at',
    orderBy: 'created_at',
    searchable: ['product_slug', 'author_name'],
    editable: ['is_approved'],
    deletable: true,
  },
  subscribers: {
    table: 'newsletter_subscribers',
    select: 'id, email, source, is_subscribed, created_at',
    orderBy: 'created_at',
    searchable: ['email', 'source'],
    editable: ['is_subscribed'],
    deletable: true,
  },
  carts: {
    table: 'abandoned_carts',
    select: 'id, session_id, email, cart_total, recovered, items, updated_at',
    orderBy: 'updated_at',
    searchable: ['email', 'session_id'],
    editable: ['recovered'],
    deletable: true,
  },
  fulfillment: {
    table: 'fulfillment_queue',
    select: 'id, order_id, stage, assigned_to, notes, created_at, updated_at',
    orderBy: 'created_at',
    searchable: ['assigned_to', 'stage'],
    editable: ['stage', 'assigned_to', 'notes'],
    deletable: true,
    statusColumn: 'stage',
  },
  leads: {
    table: 'leads',
    select:
      'id, email, phone, full_name, institution, source, status, assigned_to, score, last_contacted_at, created_at',
    orderBy: 'created_at',
    searchable: ['email', 'full_name', 'institution', 'source'],
    editable: ['status', 'assigned_to', 'score', 'notes', 'last_contacted_at'],
    deletable: true,
    statusColumn: 'status',
  },
  prospects: {
    table: 'sales_prospects',
    select:
      'id, company, contact_name, email, phone, segment, stage, owner, next_action, next_action_at, created_at',
    orderBy: 'created_at',
    searchable: ['company', 'contact_name', 'email'],
    editable: ['stage', 'owner', 'next_action', 'next_action_at'],
    deletable: true,
    statusColumn: 'stage',
  },
  deals: {
    table: 'deals',
    select:
      'id, title, product_slug, discount_percent, coupon_code, starts_at, ends_at, is_active, created_at',
    orderBy: 'created_at',
    searchable: ['title', 'coupon_code', 'product_slug'],
    editable: ['title', 'discount_percent', 'coupon_code', 'starts_at', 'ends_at', 'is_active'],
    deletable: true,
  },
  affiliates: {
    table: 'affiliates',
    select: 'id, email, full_name, referral_code, commission_rate, is_active, created_at',
    orderBy: 'created_at',
    searchable: ['email', 'full_name', 'referral_code'],
    editable: ['commission_rate', 'is_active'],
    deletable: true,
  },
  commissions: {
    table: 'affiliate_commissions',
    select: 'id, affiliate_id, order_id, amount, status, created_at, paid_at',
    orderBy: 'created_at',
    searchable: ['status'],
    editable: ['status', 'paid_at'],
    deletable: false,
    statusColumn: 'status',
  },
  campaigns: {
    table: 'campaigns',
    select:
      'id, name, channel, subject, audience, status, scheduled_at, sent_count, failed_count, created_at',
    orderBy: 'created_at',
    searchable: ['name', 'subject', 'channel'],
    editable: ['name', 'subject', 'body', 'audience', 'status', 'scheduled_at'],
    deletable: true,
    statusColumn: 'status',
  },
  notifications: {
    table: 'admin_notifications',
    select: 'id, kind, title, body, link, is_read, created_at',
    orderBy: 'created_at',
    searchable: ['title', 'kind'],
    editable: ['is_read'],
    deletable: true,
  },
  team: {
    table: 'team_members',
    select: 'id, email, full_name, role, is_active, created_at',
    orderBy: 'created_at',
    searchable: ['email', 'full_name', 'role'],
    editable: ['full_name', 'role', 'is_active'],
    deletable: true,
  },
  activity: {
    table: 'crm_activity',
    select: 'id, subject_type, subject_id, activity, body, actor, created_at',
    orderBy: 'created_at',
    searchable: ['subject_type', 'activity', 'actor'],
    editable: [],
    deletable: true,
  },
};

export type ResourceName = keyof typeof RESOURCES;

export const isResource = (name: string): name is ResourceName =>
  Object.prototype.hasOwnProperty.call(RESOURCES, name);
