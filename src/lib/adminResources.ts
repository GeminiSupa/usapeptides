import 'server-only';

/**
 * Whitelist of tables the admin dashboard may touch, what may be done to each,
 * and the shape of the "new record" form. Anything not described here is
 * unreachable through the admin API, so a crafted resource name cannot reach
 * an arbitrary table.
 */

export type FieldType =
  | 'text'
  | 'email'
  | 'number'
  | 'money'
  | 'boolean'
  | 'select'
  | 'date'
  | 'textarea';

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  options?: string[];
  required?: boolean;
  help?: string;
}

export interface ResourceConfig {
  table: string;
  /** Human label + one-line description, shown on empty states. */
  title: string;
  blurb: string;
  select: string;
  orderBy: string;
  searchable: string[];
  editable: string[];
  deletable: boolean;
  statusColumn?: string;
  /** Fields offered by the "new record" form. Empty means create is disabled. */
  createFields: FieldDef[];
  /** Columns worth showing in the compact table, in order. */
  columns?: string[];
}

const STATUS = {
  order: ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
  inquiry: ['new', 'open', 'answered', 'closed'],
  lead: ['new', 'working', 'qualified', 'lost', 'converted'],
  prospect: ['identified', 'contacted', 'meeting', 'proposal', 'won', 'lost'],
  commission: ['pending', 'approved', 'paid', 'void'],
  campaign: ['draft', 'scheduled', 'sending', 'sent', 'paused'],
  fulfillment: ['queued', 'picking', 'packed', 'dispatched'],
};

export const RESOURCES: Record<string, ResourceConfig> = {
  orders: {
    table: 'orders',
    title: 'Orders',
    blurb: 'Orders placed through the storefront. Change status and add tracking here.',
    select:
      'id, order_number, email, full_name, institution, status, grand_total, currency, payment_provider, tracking_number, created_at',
    orderBy: 'created_at',
    searchable: ['order_number', 'email', 'full_name'],
    editable: ['status', 'tracking_number', 'notes', 'payment_reference'],
    deletable: false,
    statusColumn: 'status',
    createFields: [], // orders originate from checkout, never typed in by hand
    columns: ['order_number', 'email', 'status', 'grand_total', 'tracking_number', 'created_at'],
  },

  products: {
    table: 'products',
    title: 'Products',
    blurb: 'Your catalogue. Prices and stock here are what the storefront shows.',
    select:
      'id, slug, name, category, category_slug, price, sale_price, sku, purity, stock_count, in_stock, is_featured, is_active, image',
    orderBy: 'name',
    searchable: ['name', 'sku', 'slug'],
    editable: [
      'name', 'price', 'sale_price', 'stock_count', 'in_stock',
      'is_featured', 'is_active', 'purity', 'category', 'image',
    ],
    deletable: false,
    createFields: [
      { name: 'name', label: 'Product name', type: 'text', required: true },
      { name: 'slug', label: 'URL slug', type: 'text', required: true, help: 'lowercase-with-dashes' },
      { name: 'sku', label: 'SKU', type: 'text' },
      { name: 'category', label: 'Category', type: 'text' },
      { name: 'category_slug', label: 'Category slug', type: 'text' },
      { name: 'price', label: 'Price', type: 'money', required: true },
      { name: 'sale_price', label: 'Sale price', type: 'money' },
      { name: 'stock_count', label: 'Stock', type: 'number' },
      { name: 'purity', label: 'Purity', type: 'text' },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'image', label: 'Image path', type: 'text', help: 'e.g. /vials/bpc-157-5mg.svg' },
      { name: 'is_featured', label: 'Featured', type: 'boolean' },
      { name: 'is_active', label: 'Active', type: 'boolean' },
    ],
  },

  customers: {
    table: 'customer_profiles',
    title: 'Customers',
    blurb: 'People who have registered or ordered.',
    select: 'id, email, full_name, institution, phone, marketing_opt_in, created_at',
    orderBy: 'created_at',
    searchable: ['email', 'full_name', 'institution'],
    editable: ['full_name', 'institution', 'phone', 'marketing_opt_in'],
    deletable: false,
    createFields: [
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'full_name', label: 'Full name', type: 'text' },
      { name: 'institution', label: 'Institution', type: 'text' },
      { name: 'phone', label: 'Phone', type: 'text' },
      { name: 'marketing_opt_in', label: 'Marketing opt-in', type: 'boolean' },
    ],
  },

  inquiries: {
    table: 'customer_inquiries',
    title: 'Enquiries',
    blurb: 'Messages from the contact form.',
    select: 'id, name, email, institution, subject, message, status, created_at',
    orderBy: 'created_at',
    searchable: ['name', 'email', 'subject'],
    editable: ['status'],
    deletable: true,
    statusColumn: 'status',
    createFields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'subject', label: 'Subject', type: 'text' },
      { name: 'message', label: 'Message', type: 'textarea', required: true },
      { name: 'status', label: 'Status', type: 'select', options: STATUS.inquiry },
    ],
  },

  carts: {
    table: 'abandoned_carts',
    title: 'Abandoned carts',
    blurb: 'Carts started but not checked out. Populated automatically as people shop.',
    select: 'id, session_id, email, cart_total, recovered, updated_at',
    orderBy: 'updated_at',
    searchable: ['email', 'session_id'],
    editable: ['recovered'],
    deletable: true,
    createFields: [],
  },

  reviews: {
    table: 'product_reviews',
    title: 'Reviews',
    blurb: 'Customer reviews. Nothing appears on the site until you approve it.',
    select: 'id, product_slug, author_name, institution, rating, body, is_approved, created_at',
    orderBy: 'created_at',
    searchable: ['product_slug', 'author_name'],
    editable: ['is_approved', 'body'],
    deletable: true,
    createFields: [
      { name: 'product_slug', label: 'Product slug', type: 'text', required: true },
      { name: 'author_name', label: 'Author', type: 'text', required: true },
      { name: 'institution', label: 'Institution', type: 'text' },
      { name: 'rating', label: 'Rating (1-5)', type: 'number', required: true },
      { name: 'body', label: 'Review', type: 'textarea' },
      { name: 'is_approved', label: 'Approved', type: 'boolean' },
    ],
  },

  subscribers: {
    table: 'newsletter_subscribers',
    title: 'Subscribers',
    blurb: 'Newsletter mailing list.',
    select: 'id, email, source, is_subscribed, created_at',
    orderBy: 'created_at',
    searchable: ['email', 'source'],
    editable: ['is_subscribed'],
    deletable: true,
    createFields: [
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'source', label: 'Source', type: 'text' },
      { name: 'is_subscribed', label: 'Subscribed', type: 'boolean' },
    ],
  },

  fulfillment: {
    table: 'fulfillment_queue',
    title: 'Fulfillment',
    blurb: 'Picking and packing queue for orders being prepared.',
    select: 'id, order_id, stage, assigned_to, notes, created_at, updated_at',
    orderBy: 'created_at',
    searchable: ['assigned_to', 'stage'],
    editable: ['stage', 'assigned_to', 'notes'],
    deletable: true,
    statusColumn: 'stage',
    createFields: [
      { name: 'order_id', label: 'Order ID', type: 'text', required: true },
      { name: 'stage', label: 'Stage', type: 'select', options: STATUS.fulfillment },
      { name: 'assigned_to', label: 'Assigned to', type: 'text' },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },

  leads: {
    table: 'leads',
    title: 'Leads',
    blurb: 'People who showed interest but have not ordered. Add them here or capture from forms.',
    select:
      'id, email, phone, full_name, institution, source, status, assigned_to, score, last_contacted_at, created_at',
    orderBy: 'created_at',
    searchable: ['email', 'full_name', 'institution', 'source'],
    editable: ['status', 'assigned_to', 'score', 'notes', 'last_contacted_at', 'phone', 'full_name'],
    deletable: true,
    statusColumn: 'status',
    createFields: [
      { name: 'full_name', label: 'Name', type: 'text' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'phone', label: 'Phone', type: 'text' },
      { name: 'institution', label: 'Institution', type: 'text' },
      { name: 'source', label: 'Source', type: 'text', help: 'where they came from' },
      { name: 'status', label: 'Status', type: 'select', options: STATUS.lead },
      { name: 'assigned_to', label: 'Assigned to', type: 'text' },
      { name: 'score', label: 'Score', type: 'number' },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },

  prospects: {
    table: 'sales_prospects',
    title: 'Prospects',
    blurb: 'Organisations you are actively pursuing, with a pipeline stage each.',
    select:
      'id, company, contact_name, email, phone, segment, stage, owner, next_action, next_action_at, created_at',
    orderBy: 'created_at',
    searchable: ['company', 'contact_name', 'email'],
    editable: ['stage', 'owner', 'next_action', 'next_action_at', 'segment', 'phone'],
    deletable: true,
    statusColumn: 'stage',
    createFields: [
      { name: 'company', label: 'Company', type: 'text', required: true },
      { name: 'contact_name', label: 'Contact', type: 'text' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'phone', label: 'Phone', type: 'text' },
      { name: 'segment', label: 'Segment', type: 'text' },
      { name: 'stage', label: 'Stage', type: 'select', options: STATUS.prospect },
      { name: 'owner', label: 'Owner', type: 'text' },
      { name: 'next_action', label: 'Next action', type: 'text' },
      { name: 'next_action_at', label: 'Next action date', type: 'date' },
    ],
  },

  deals: {
    table: 'deals',
    title: 'Deals',
    blurb: 'Time-limited promotions and coupon codes.',
    select:
      'id, title, product_slug, discount_percent, coupon_code, starts_at, ends_at, is_active, created_at',
    orderBy: 'created_at',
    searchable: ['title', 'coupon_code', 'product_slug'],
    editable: ['title', 'discount_percent', 'coupon_code', 'starts_at', 'ends_at', 'is_active'],
    deletable: true,
    createFields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'product_slug', label: 'Product slug', type: 'text', help: 'blank = all products' },
      { name: 'discount_percent', label: 'Discount %', type: 'number', required: true },
      { name: 'coupon_code', label: 'Coupon code', type: 'text' },
      { name: 'starts_at', label: 'Starts', type: 'date' },
      { name: 'ends_at', label: 'Ends', type: 'date' },
      { name: 'is_active', label: 'Active', type: 'boolean' },
    ],
  },

  affiliates: {
    table: 'affiliates',
    title: 'Affiliates',
    blurb: 'Partners earning commission on referred orders.',
    select: 'id, email, full_name, referral_code, commission_rate, is_active, created_at',
    orderBy: 'created_at',
    searchable: ['email', 'full_name', 'referral_code'],
    editable: ['commission_rate', 'is_active', 'full_name'],
    deletable: true,
    createFields: [
      { name: 'full_name', label: 'Name', type: 'text' },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'referral_code', label: 'Referral code', type: 'text', required: true },
      { name: 'commission_rate', label: 'Commission %', type: 'number' },
      { name: 'is_active', label: 'Active', type: 'boolean' },
    ],
  },

  commissions: {
    table: 'affiliate_commissions',
    title: 'Commissions',
    blurb: 'Commission owed to affiliates, created as referred orders come in.',
    select: 'id, affiliate_id, order_id, amount, status, created_at, paid_at',
    orderBy: 'created_at',
    searchable: ['status'],
    editable: ['status', 'paid_at', 'amount'],
    deletable: false,
    statusColumn: 'status',
    createFields: [
      { name: 'affiliate_id', label: 'Affiliate ID', type: 'text', required: true },
      { name: 'amount', label: 'Amount', type: 'money', required: true },
      { name: 'status', label: 'Status', type: 'select', options: STATUS.commission },
    ],
  },

  campaigns: {
    table: 'campaigns',
    title: 'Campaigns',
    blurb: 'Email and messaging campaigns. Drafting works now; sending needs an email provider.',
    select:
      'id, name, channel, subject, audience, status, scheduled_at, sent_count, failed_count, created_at',
    orderBy: 'created_at',
    searchable: ['name', 'subject', 'channel'],
    editable: ['name', 'subject', 'body', 'audience', 'status', 'scheduled_at'],
    deletable: true,
    statusColumn: 'status',
    createFields: [
      { name: 'name', label: 'Campaign name', type: 'text', required: true },
      { name: 'channel', label: 'Channel', type: 'select', options: ['email', 'whatsapp', 'messenger'] },
      { name: 'subject', label: 'Subject', type: 'text' },
      { name: 'body', label: 'Message', type: 'textarea' },
      { name: 'audience', label: 'Audience', type: 'text' },
      { name: 'status', label: 'Status', type: 'select', options: STATUS.campaign },
      { name: 'scheduled_at', label: 'Send at', type: 'date' },
    ],
  },

  notifications: {
    table: 'admin_notifications',
    title: 'Notifications',
    blurb: 'Internal alerts for your team.',
    select: 'id, kind, title, body, link, is_read, created_at',
    orderBy: 'created_at',
    searchable: ['title', 'kind'],
    editable: ['is_read'],
    deletable: true,
    createFields: [
      { name: 'kind', label: 'Kind', type: 'select', options: ['order', 'inquiry', 'review', 'stock', 'system'] },
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'body', label: 'Body', type: 'textarea' },
      { name: 'link', label: 'Link', type: 'text' },
    ],
  },

  team: {
    table: 'team_members',
    title: 'Team',
    blurb: 'Staff records. To grant dashboard access, add the address to admin_users as well.',
    select: 'id, email, full_name, role, is_active, created_at',
    orderBy: 'created_at',
    searchable: ['email', 'full_name', 'role'],
    editable: ['full_name', 'role', 'is_active'],
    deletable: true,
    createFields: [
      { name: 'full_name', label: 'Name', type: 'text' },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'role', label: 'Role', type: 'select', options: ['owner', 'manager', 'staff'] },
      { name: 'is_active', label: 'Active', type: 'boolean' },
    ],
  },

  activity: {
    table: 'crm_activity',
    title: 'Activity log',
    blurb: 'Notes and contact history against leads, prospects and customers.',
    select: 'id, subject_type, subject_id, activity, body, actor, created_at',
    orderBy: 'created_at',
    searchable: ['subject_type', 'activity', 'actor'],
    editable: [],
    deletable: true,
    createFields: [
      { name: 'subject_type', label: 'Relates to', type: 'select', options: ['lead', 'prospect', 'customer', 'order'] },
      { name: 'subject_id', label: 'Record ID', type: 'text' },
      { name: 'activity', label: 'Type', type: 'select', options: ['note', 'call', 'email', 'status_change'] },
      { name: 'body', label: 'Details', type: 'textarea' },
      { name: 'actor', label: 'Logged by', type: 'text' },
    ],
  },
};

export type ResourceName = keyof typeof RESOURCES;

export const isResource = (name: string): name is ResourceName =>
  Object.prototype.hasOwnProperty.call(RESOURCES, name);
