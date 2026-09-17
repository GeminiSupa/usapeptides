import 'server-only';

import { categories } from '@/data/categories';

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
  | 'textarea'
  /** Stored as a URL string; the form offers an upload button. */
  | 'image'
  | 'file';

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  options?: string[];
  required?: boolean;
  help?: string;
  /** Groups fields into sections in the product editor. */
  group?: string;
}

/** Category names, offered as a dropdown so nobody free-types a pathway. */
export const CATEGORY_NAMES = categories.map((c) => c.name);

/** Name -> slug, so choosing a category fills in its slug automatically. */
export const CATEGORY_SLUGS: Record<string, string> = Object.fromEntries(
  categories.map((c) => [c.name, c.slug])
);

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
  /**
   * Last pass over a validated row before it is written. Fills in columns the
   * form deliberately does not ask for, so a short form still produces a
   * complete record.
   */
  derive?: (row: Record<string, unknown>) => Record<string, unknown>;
  /**
   * The same idea for an edit, but it may only touch columns implied by what
   * was actually submitted. `derive` cannot be reused here: it fills in
   * defaults from an absent field, which on a one-field edit would overwrite
   * good data with a default.
   */
  deriveUpdate?: (changes: Record<string, unknown>) => Record<string, unknown>;
}

/** URL-safe slug from a product name, for when the field is left blank. */
export function slugify(value: string): string {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
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
    blurb: 'Your catalogue. What you set here is what the website shows.',
    select:
      'id, slug, name, category, category_slug, price, sale_price, sku, purity, sequence,' +
      ' cas_number, molar_mass, formula, storage, appearance, description, image, coa_url,' +
      ' coa_lot, coa_tested_at, stock_count, in_stock, is_featured, is_popular, is_active,' +
      ' sort_order, created_at',
    orderBy: 'name',
    searchable: ['name', 'sku', 'slug'],
    editable: [
      'name', 'slug', 'sku', 'category', 'category_slug', 'price', 'sale_price',
      'stock_count', 'in_stock', 'is_featured', 'is_popular', 'is_active',
      'purity', 'sequence', 'cas_number', 'molar_mass', 'formula', 'storage',
      'appearance', 'description', 'image', 'coa_url', 'coa_lot', 'coa_tested_at',
      'sort_order',
    ],
    deletable: true,
    createFields: [
      { group: 'Basics', name: 'name', label: 'Product name', type: 'text', required: true },
      { group: 'Basics', name: 'category', label: 'Category', type: 'select', options: CATEGORY_NAMES, required: true,
        help: 'Decides which category page it appears on.' },
      { group: 'Basics', name: 'sku', label: 'SKU', type: 'text', help: 'Your own stock code. Optional.' },
      { group: 'Basics', name: 'slug', label: 'Web address', type: 'text',
        help: 'Leave blank and it is built from the name.' },
      { group: 'Basics', name: 'purity', label: 'Purity', type: 'text', help: 'e.g. 99.4%' },

      { group: 'Price and stock', name: 'price', label: 'Price', type: 'money', required: true },
      { group: 'Price and stock', name: 'sale_price', label: 'Sale price', type: 'money',
        help: 'Leave blank for no sale. Shown struck through against the price.' },
      { group: 'Price and stock', name: 'stock_count', label: 'Units in stock', type: 'number' },

      { group: 'Media', name: 'image', label: 'Product photo', type: 'image',
        help: 'JPG, PNG or WEBP, up to 2 MB.' },
      { group: 'Media', name: 'coa_url', label: 'Certificate of analysis', type: 'file',
        help: 'PDF up to 2 MB. Customers download this from the product page.' },
      { group: 'Media', name: 'coa_lot', label: 'Certificate lot number', type: 'text' },
      { group: 'Media', name: 'coa_tested_at', label: 'Tested on', type: 'date' },

      { group: 'Details', name: 'description', label: 'Description', type: 'textarea' },
      { group: 'Details', name: 'sequence', label: 'Sequence', type: 'textarea' },
      { group: 'Details', name: 'cas_number', label: 'CAS number', type: 'text' },
      { group: 'Details', name: 'molar_mass', label: 'Molar mass', type: 'text' },
      { group: 'Details', name: 'formula', label: 'Formula', type: 'text' },
      { group: 'Details', name: 'storage', label: 'Storage', type: 'text' },
      { group: 'Details', name: 'appearance', label: 'Appearance', type: 'text' },

      { group: 'Visibility', name: 'is_active', label: 'Show on the website', type: 'boolean' },
      { group: 'Visibility', name: 'is_featured', label: 'Feature on the home page', type: 'boolean' },
      { group: 'Visibility', name: 'is_popular', label: 'Mark as popular', type: 'boolean' },
      { group: 'Visibility', name: 'sort_order', label: 'Sort position', type: 'number',
        help: 'Lower numbers come first. Leave at 0 to sort by name.' },
    ],
    columns: ['name', 'category', 'price', 'stock_count', 'is_active'],
    derive: (row) => {
      const name = String(row.name ?? '');
      const category = String(row.category ?? '');

      // A blank web address is filled in from the name rather than refused:
      // whoever adds a product should not have to know what a slug is.
      if (!row.slug && name) row.slug = slugify(name);

      // Category pages filter on the slug, so a product saved with a category
      // name but no slug would be invisible on its own category page.
      if (category && CATEGORY_SLUGS[category]) row.category_slug = CATEGORY_SLUGS[category];

      // Stock drives the In stock badge. Typing 0 units should not leave a
      // product advertised as available.
      const stock = Number(row.stock_count ?? 0);
      row.in_stock = Number.isFinite(stock) && stock > 0;

      // Live unless the form said otherwise, so adding a product and pressing
      // save actually puts it on the website.
      if (row.is_active === undefined) row.is_active = true;

      return row;
    },
    deriveUpdate: (changes) => {
      // Moving a product to another category has to move its slug too, or the
      // product page says one category and the category page never lists it.
      const category = changes.category;
      if (typeof category === 'string' && CATEGORY_SLUGS[category]) {
        changes.category_slug = CATEGORY_SLUGS[category];
      }

      // Editing the stock number re-decides the In stock badge. Only when that
      // number is part of the edit, so toggling Featured leaves stock alone.
      if (changes.stock_count !== undefined) {
        const stock = Number(changes.stock_count);
        changes.in_stock = Number.isFinite(stock) && stock > 0;
      }

      return changes;
    },
  },

  customers: {
    table: 'customer_profiles',
    title: 'Customers',
    blurb: 'People who have registered or ordered. Message them, give them a sign-in, or remove them.',
    select: 'id, email, full_name, institution, phone, marketing_opt_in, user_id, created_at',
    orderBy: 'created_at',
    searchable: ['email', 'full_name', 'institution', 'phone'],
    editable: ['full_name', 'institution', 'phone', 'marketing_opt_in'],
    // Their orders stay (orders.customer_id is ON DELETE SET NULL) and still
    // carry the email, name and address they were placed with.
    deletable: true,
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

  articles: {
    table: 'articles',
    title: 'Research articles',
    blurb: 'Draft and publish original research-library articles for the public website.',
    select: 'id, slug, title, excerpt, content, category, author, image, tags, read_time, is_published, published_at, created_at',
    orderBy: 'created_at',
    searchable: ['title', 'slug', 'category', 'author'],
    editable: ['slug', 'title', 'excerpt', 'content', 'category', 'author', 'image', 'tags', 'read_time', 'is_published', 'published_at'],
    deletable: true,
    createFields: [
      { group: 'Article', name: 'title', label: 'Title', type: 'text', required: true },
      { group: 'Article', name: 'slug', label: 'Web address', type: 'text', help: 'Leave blank to build it from the title.' },
      { group: 'Article', name: 'category', label: 'Category', type: 'text', required: true },
      { group: 'Article', name: 'author', label: 'Author', type: 'text', required: true },
      { group: 'Article', name: 'read_time', label: 'Reading time', type: 'text', help: 'For example: 6 min read.' },
      { group: 'Article', name: 'excerpt', label: 'Short introduction', type: 'textarea', required: true },
      { group: 'Article', name: 'content', label: 'Full article', type: 'textarea', required: true },
      { group: 'Media', name: 'image', label: 'Header image', type: 'image' },
      { group: 'Media', name: 'tags', label: 'Tags', type: 'text', help: 'Separate tags with commas.' },
      { group: 'Publishing', name: 'is_published', label: 'Publish on the website', type: 'boolean' },
      { group: 'Publishing', name: 'published_at', label: 'Publish date', type: 'date', help: 'Leave blank to publish now when switched on.' },
    ],
    columns: ['title', 'category', 'author', 'is_published', 'published_at'],
    derive: (row) => {
      if (!row.slug && row.title) row.slug = slugify(String(row.title));
      row.tags = String(row.tags ?? '').split(',').map((tag) => tag.trim()).filter(Boolean);
      if (!row.read_time) row.read_time = '5 min read';
      if (row.is_published && !row.published_at) row.published_at = new Date().toISOString();
      return row;
    },
    deriveUpdate: (changes) => {
      if (changes.tags !== undefined) changes.tags = String(changes.tags ?? '').split(',').map((tag) => tag.trim()).filter(Boolean);
      if (changes.is_published === true && !changes.published_at) changes.published_at = new Date().toISOString();
      return changes;
    },
  },

  team: {
    table: 'team_members',
    title: 'Team',
    blurb: 'Everyone who works here. Adding someone here does not give them a login - use Grant access for that.',
    select:
      'id, email, full_name, job_title, role, phone, avatar_url, notes, started_on,' +
      ' is_active, has_dashboard_access, created_at',
    orderBy: 'created_at',
    searchable: ['email', 'full_name', 'role', 'job_title'],
    editable: [
      'full_name', 'job_title', 'role', 'phone', 'avatar_url', 'notes',
      'started_on', 'is_active',
    ],
    deletable: true,
    createFields: [
      { group: 'Person', name: 'full_name', label: 'Full name', type: 'text', required: true },
      { group: 'Person', name: 'email', label: 'Email', type: 'email', required: true },
      { group: 'Person', name: 'phone', label: 'Phone', type: 'text' },
      { group: 'Person', name: 'avatar_url', label: 'Photo', type: 'image',
        help: 'JPG or PNG up to 2 MB. Optional.' },

      { group: 'Role', name: 'job_title', label: 'Job title', type: 'text',
        help: 'What they actually do. e.g. Lab Manager' },
      { group: 'Role', name: 'role', label: 'Level', type: 'select',
        options: ['owner', 'manager', 'staff'],
        help: 'For your own records. It does not grant dashboard access.' },
      { group: 'Role', name: 'started_on', label: 'Started on', type: 'date' },
      { group: 'Role', name: 'is_active', label: 'Currently employed', type: 'boolean' },

      { group: 'Notes', name: 'notes', label: 'Notes', type: 'textarea' },
    ],
    columns: ['full_name', 'job_title', 'role', 'email', 'is_active', 'has_dashboard_access'],
    derive: (row) => {
      // Somebody added to the team is presumed to work here.
      if (row.is_active === undefined) row.is_active = true;
      if (!row.role) row.role = 'staff';
      return row;
    },
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
