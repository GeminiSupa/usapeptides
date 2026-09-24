/**
 * Everything on the public website that the dashboard can change without a
 * developer: contact details, headings, paragraphs, the FAQ list and SEO.
 *
 * Stored as one JSON object in site_settings (row `site_content`), read by the
 * site with the public key. Anything not saved yet falls back to the default
 * below, so an empty database still shows a complete website, and a new
 * business starts from a working copy of every line.
 *
 * Shared by the dashboard, the storefront and the server — imports nothing
 * that is server-only.
 */

import { faqs as defaultFaqs } from '@/data/faqs';
import { BUSINESS } from '@/lib/env';

const NAME = BUSINESS.name;

export const SITE_CONTENT_ID = 'site_content';

export type ContentFieldType = 'text' | 'textarea' | 'email' | 'phone' | 'url' | 'image' | 'lines' | 'faq';

export interface ContentField {
  key: string;
  label: string;
  type: ContentFieldType;
  help?: string;
  /** Search engines cut titles and descriptions off past these lengths. */
  max?: number;
}

export interface ContentSection {
  id: string;
  label: string;
  description: string;
  /** Page this section shows on, for the "view page" link. */
  page?: string;
  fields: ContentField[];
}

export interface FaqEntry { category: string; question: string; answer: string }

/** Every value is a string; `faq.items` holds a JSON list (see parseFaqs). */
export type SiteContent = Record<string, string>;

export const DEFAULT_CONTENT: Record<string, string> = {
  // Business and contact
  'business.name': NAME,
  'contact.email': BUSINESS.supportEmail,
  'contact.phone': BUSINESS.supportPhone,
  'contact.address': 'United States Logistics & Climate Storage Facility',
  'contact.shipsFrom': 'United States',
  'contact.hours': 'Mon–Fri, 8:00am–6:00pm ET',
  'contact.responseTime': 'Our laboratory team responds within 24 business hours.',
  'social.instagram': '',
  'social.facebook': '',
  'social.x': '',
  'social.youtube': '',
  'social.tiktok': '',
  'social.linkedin': '',

  // Home page
  'hero.eyebrow': 'Laboratory research use only — evidence over hype',
  'hero.title': 'Why trust what\nyou can test?',
  'hero.points': 'Independent HPLC testing where available\nLot-specific documentation\nU.S.-based fulfillment and support',
  'hero.primaryLabel': 'Shop Research Materials',
  'hero.primaryHref': '/shop',
  'hero.secondaryLabel': 'Search COA Database',
  'hero.secondaryHref': '/coa-database',
  'hero.lede': `Anyone can print a purity number on a label. ${NAME} delivers the goods with independent HPLC testing and lot-specific documentation. We don’t make marketing claims. We keep it real with real results for real research.`,
  'hero.closing': 'Don’t believe the hype. Believe the results. That’s Trust. Verified.',
  'hero.disclaimer':
    'Products are for laboratory and research use only and are not intended for human or veterinary use.',

  // Shop
  'shop.eyebrow': 'Catalog & Reference Materials',
  'shop.title': 'All Research Peptides',
  'shop.intro':
    'HPLC-verified lyophilized peptides for in-vitro research use. Bulk volume tiers calculated automatically with verified Certificate of Analysis available per batch.',

  // Contact page
  'contactPage.eyebrow': 'Direct Laboratory Communication',
  'contactPage.title': `Contact ${NAME}`,
  'contactPage.intro': 'For technical HPLC inquiries, bulk institutional orders, or shipping assistance, our laboratory team responds within 24 business hours.',
  'contactPage.policy':
    'We do not answer questions relating to human administration or medical advice. Inquiries must pertain to laboratory chemistry, in-vitro protocols, or orders.',

  // FAQ page
  'faq.eyebrow': 'Support & Answers',
  'faq.title': 'Frequently Asked Questions',
  'faq.intro': 'Find answers regarding ordering, HPLC testing verification, domestic shipping, and laboratory peptide storage.',
  'faq.items': JSON.stringify(defaultFaqs),

  // Blog
  'blog.eyebrow': 'Scientific Library & COA Analysis',
  'blog.title': 'Peptide Research & Analytical Guides',
  'blog.intro': 'Explore laboratory protocols, HPLC chromatogram reading guides, receptor pathways, and peptide stability research.',

  // Footer
  'footer.about':
    'Lyophilized research peptides and laboratory reagents supplied to research institutions, licensed researchers and university laboratories across the United States. Every item is supplied as a laboratory reference material for in-vitro research use only.',
  'footer.newsletterTitle': 'Laboratory newsletter',
  'footer.complianceTitle': 'Research compliance notice',
  'footer.compliance':
    'All products listed are supplied strictly for in-vitro laboratory research by qualified institutions, universities and licensed laboratory personnel. None of these compounds are intended for human consumption, clinical diagnostic application or veterinary use, and none are approved by the FDA or any other health authority. Purchasers are responsible for handling, storage and disposal in accordance with their own institutional requirements.',
  'footer.copyright': `${NAME}. All rights reserved.`,

  // SEO — site-wide
  'seo.siteTitle': `${NAME} | HPLC-Tested Research Peptides, Shipped From the USA`,
  'seo.titleSuffix': ` | ${NAME}`,
  'seo.description':
    'Lyophilized research peptides with independent HPLC test results published per product. Ships from the United States, tracked. Free shipping over $100. In-vitro research use only.',
  'seo.keywords': 'research peptides, HPLC tested peptides, lyophilized peptides, peptide certificate of analysis, USA peptide supplier',
  'seo.ogImage': '',
  'seo.twitterHandle': '',
  'seo.googleVerification': '',
  'seo.bingVerification': '',

  // SEO — per page (blank title/description means use the site-wide one)
  'seo.coa.title': 'Peptide Certificates of Analysis (COA)',
  'seo.coa.description': 'Search peptide analysis records by compound, lot number or CAS number. Review the available report and contact support for documentation.',
  'seo.bulk.title': 'Bulk Research Peptide Pricing',
  'seo.bulk.description': 'Compare volume discount tiers for research peptides and estimate order totals before reviewing your cart.',
  'seo.calculator.title': 'Peptide Reconstitution & Dilution Calculator',
  'seo.calculator.description': 'Calculate laboratory solution concentration from peptide mass and diluent volume. Includes calculation formulas for in-vitro research.',
  'seo.shipping.title': 'Shipping Policy',
  'seo.shipping.description': 'Review shipping options, order processing, tracking and delivery information for research-product orders.',
  'seo.privacy.title': 'Privacy Policy',
  'seo.privacy.description': 'Read how customer information is collected, used and handled when browsing the store or placing an order.',
  'seo.returns.title': 'Returns & Refund Policy',
  'seo.returns.description': 'Review return and refund conditions, reporting an order issue, and how to contact support.',
  'seo.affiliates.title': 'Research Referral & Affiliate Program',
  'seo.affiliates.description': 'Learn about the research referral program, application process and affiliate enquiries.',
  'seo.shop.title': 'Shop Research Peptides',
  'seo.shop.description': 'Browse HPLC-verified research peptides with a certificate of analysis for every lot and automatic bulk pricing.',
  'seo.about.title': 'About Our Standards',
  'seo.about.description': 'How we source, test and ship research peptides: independent HPLC analysis, cold-chain handling and tracked US delivery.',
  'seo.contact.title': 'Contact Us',
  'seo.contact.description': 'Questions about an order, bulk pricing or a test report? Contact our US laboratory support team.',
  'seo.faq.title': 'Frequently Asked Questions',
  'seo.faq.description': 'Answers about ordering, HPLC testing, shipping and storing research peptides.',
  'seo.blog.title': 'Research Library',
  'seo.blog.description': 'Protocols, analytical methods and laboratory notes on research peptides.',
  'seo.story.title': 'Our Story',
  'seo.story.description': 'Why the company was founded: too many claims, too little proof. Evidence over hype, lot by lot.',
  'seo.team.title': 'Our Team and Leadership',
  'seo.team.description': 'An operations-first leadership approach: rigorous sourcing, lot-specific documentation and direct support.',
  'seo.why.title': 'Why Choose Us',
  'seo.why.description': 'Lot-specific testing, independent analysis, domestic fulfillment with tracking, and support that answers questions.',
  'seo.how.title': 'How It Works',
  'seo.how.description': 'Six steps from choosing a research material to verifying the lot documentation that came with it.',
  'seo.knowledge.title': 'Knowledge Center',
  'seo.knowledge.description': 'How to read a Certificate of Analysis, what HPLC can and cannot show, why lot numbers matter, and laboratory terminology.',
  'seo.standards.title': 'Quality Standards',
  'seo.standards.description': 'Traceability, lot identification and analytical documentation published where it exists.',

  // AEO — what answer engines read about the business
  'aeo.summary':
    `${NAME} supplies lyophilized research peptides for in-vitro laboratory use, with an independent HPLC certificate of analysis for every lot and tracked shipping from the United States.`,
  'aeo.audience': 'Universities, research institutions and qualified laboratory buyers',
  'aeo.priceRange': '$$',
};

export const CONTENT_SECTIONS: ContentSection[] = [
  {
    id: 'contact',
    label: 'Contact & social',
    description: 'Shown in the footer, on the contact page and to search engines.',
    page: '/contact-us',
    fields: [
      { key: 'business.name', label: 'Business name', type: 'text' },
      { key: 'contact.email', label: 'Email', type: 'email' },
      { key: 'contact.phone', label: 'Phone', type: 'phone', help: 'Leave blank to hide it.' },
      { key: 'contact.address', label: 'Address or location', type: 'textarea' },
      { key: 'contact.shipsFrom', label: 'Ships from', type: 'text' },
      { key: 'contact.hours', label: 'Opening hours', type: 'text' },
      { key: 'contact.responseTime', label: 'Response time line', type: 'text' },
      { key: 'social.instagram', label: 'Instagram link', type: 'url' },
      { key: 'social.facebook', label: 'Facebook link', type: 'url' },
      { key: 'social.x', label: 'X (Twitter) link', type: 'url' },
      { key: 'social.youtube', label: 'YouTube link', type: 'url' },
      { key: 'social.tiktok', label: 'TikTok link', type: 'url' },
      { key: 'social.linkedin', label: 'LinkedIn link', type: 'url' },
    ],
  },
  {
    id: 'home',
    label: 'Home page',
    description: 'The big banner at the top of the home page.',
    page: '/',
    fields: [
      { key: 'hero.eyebrow', label: 'Small line above the heading', type: 'text' },
      { key: 'hero.title', label: 'Main heading', type: 'textarea', help: 'Press Enter to break the line.' },
      { key: 'hero.lede', label: 'Paragraph under the heading', type: 'textarea' },
      { key: 'hero.points', label: 'Three selling points', type: 'lines', help: 'One per line.' },
      { key: 'hero.closing', label: 'Closing line under the buttons', type: 'text' },
      { key: 'hero.primaryLabel', label: 'Main button text', type: 'text' },
      { key: 'hero.primaryHref', label: 'Main button link', type: 'url' },
      { key: 'hero.secondaryLabel', label: 'Second button text', type: 'text' },
      { key: 'hero.secondaryHref', label: 'Second button link', type: 'url' },
      { key: 'hero.disclaimer', label: 'Small print under the buttons', type: 'textarea' },
    ],
  },
  {
    id: 'pages',
    label: 'Page headings',
    description: 'The heading and first paragraph of the main pages.',
    fields: [
      { key: 'shop.eyebrow', label: 'Shop — small line', type: 'text' },
      { key: 'shop.title', label: 'Shop — heading', type: 'text' },
      { key: 'shop.intro', label: 'Shop — paragraph', type: 'textarea' },
      { key: 'contactPage.eyebrow', label: 'Contact — small line', type: 'text' },
      { key: 'contactPage.title', label: 'Contact — heading', type: 'text' },
      { key: 'contactPage.intro', label: 'Contact — paragraph', type: 'textarea' },
      { key: 'contactPage.policy', label: 'Contact — policy note', type: 'textarea' },
      { key: 'blog.eyebrow', label: 'Blog — small line', type: 'text' },
      { key: 'blog.title', label: 'Blog — heading', type: 'text' },
      { key: 'blog.intro', label: 'Blog — paragraph', type: 'textarea' },
      { key: 'faq.eyebrow', label: 'FAQ — small line', type: 'text' },
      { key: 'faq.title', label: 'FAQ — heading', type: 'text' },
      { key: 'faq.intro', label: 'FAQ — paragraph', type: 'textarea' },
    ],
  },
  {
    id: 'faq',
    label: 'FAQ',
    description: 'Questions on the FAQ page. Search engines and AI assistants read these as answers.',
    page: '/faq',
    fields: [{ key: 'faq.items', label: 'Questions and answers', type: 'faq' }],
  },
  {
    id: 'footer',
    label: 'Footer',
    description: 'The dark band at the bottom of every page.',
    fields: [
      { key: 'footer.about', label: 'About paragraph', type: 'textarea' },
      { key: 'footer.newsletterTitle', label: 'Newsletter heading', type: 'text' },
      { key: 'footer.complianceTitle', label: 'Compliance heading', type: 'text' },
      { key: 'footer.compliance', label: 'Compliance notice', type: 'textarea' },
      { key: 'footer.copyright', label: 'Copyright line', type: 'text', help: 'The year is added in front automatically.' },
    ],
  },
  {
    id: 'seo',
    label: 'SEO',
    description: 'What Google shows for the site. Each blog post has its own SEO fields as well.',
    fields: [
      { key: 'seo.siteTitle', label: 'Home page title', type: 'text', max: 60 },
      { key: 'seo.titleSuffix', label: 'Added after every other page title', type: 'text', help: 'For example " | Your Brand".' },
      { key: 'seo.description', label: 'Home page description', type: 'textarea', max: 160 },
      { key: 'seo.keywords', label: 'Keywords', type: 'text', help: 'Comma separated.' },
      { key: 'seo.ogImage', label: 'Share image', type: 'image', help: 'Shown when a link is shared on social media. 1200×630 works best.' },
      { key: 'seo.twitterHandle', label: 'X (Twitter) handle', type: 'text', help: 'For example @yourbrand.' },
      { key: 'seo.shop.title', label: 'Shop — title', type: 'text', max: 60 },
      { key: 'seo.shop.description', label: 'Shop — description', type: 'textarea', max: 160 },
      { key: 'seo.about.title', label: 'About — title', type: 'text', max: 60 },
      { key: 'seo.about.description', label: 'About — description', type: 'textarea', max: 160 },
      { key: 'seo.contact.title', label: 'Contact — title', type: 'text', max: 60 },
      { key: 'seo.contact.description', label: 'Contact — description', type: 'textarea', max: 160 },
      { key: 'seo.faq.title', label: 'FAQ — title', type: 'text', max: 60 },
      { key: 'seo.faq.description', label: 'FAQ — description', type: 'textarea', max: 160 },
      { key: 'seo.blog.title', label: 'Blog — title', type: 'text', max: 60 },
      { key: 'seo.blog.description', label: 'Blog — description', type: 'textarea', max: 160 },
      { key: 'seo.story.title', label: 'Our story — title', type: 'text', max: 60 },
      { key: 'seo.story.description', label: 'Our story — description', type: 'textarea', max: 160 },
      { key: 'seo.team.title', label: 'Our team and leadership — title', type: 'text', max: 60 },
      { key: 'seo.team.description', label: 'Our team and leadership — description', type: 'textarea', max: 160 },
      { key: 'seo.why.title', label: 'Why us — title', type: 'text', max: 60 },
      { key: 'seo.why.description', label: 'Why us — description', type: 'textarea', max: 160 },
      { key: 'seo.how.title', label: 'How it works — title', type: 'text', max: 60 },
      { key: 'seo.how.description', label: 'How it works — description', type: 'textarea', max: 160 },
      { key: 'seo.knowledge.title', label: 'Knowledge Center — title', type: 'text', max: 60 },
      { key: 'seo.knowledge.description', label: 'Knowledge Center — description', type: 'textarea', max: 160 },
      { key: 'seo.standards.title', label: 'Quality standards — title', type: 'text', max: 60 },
      { key: 'seo.standards.description', label: 'Quality standards — description', type: 'textarea', max: 160 },
      { key: 'seo.coa.title', label: 'Peptide Certificates of Analysis (COA) — title', type: 'text', max: 60 },
      { key: 'seo.coa.description', label: 'Peptide Certificates of Analysis (COA) — description', type: 'textarea', max: 160 },
      { key: 'seo.bulk.title', label: 'Bulk Research Peptide Pricing — title', type: 'text', max: 60 },
      { key: 'seo.bulk.description', label: 'Bulk Research Peptide Pricing — description', type: 'textarea', max: 160 },
      { key: 'seo.calculator.title', label: 'Peptide Reconstitution & Dilution Calculator — title', type: 'text', max: 60 },
      { key: 'seo.calculator.description', label: 'Peptide Reconstitution & Dilution Calculator — description', type: 'textarea', max: 160 },
      { key: 'seo.shipping.title', label: 'Shipping Policy — title', type: 'text', max: 60 },
      { key: 'seo.shipping.description', label: 'Shipping Policy — description', type: 'textarea', max: 160 },
      { key: 'seo.privacy.title', label: 'Privacy Policy — title', type: 'text', max: 60 },
      { key: 'seo.privacy.description', label: 'Privacy Policy — description', type: 'textarea', max: 160 },
      { key: 'seo.returns.title', label: 'Returns & Refund Policy — title', type: 'text', max: 60 },
      { key: 'seo.returns.description', label: 'Returns & Refund Policy — description', type: 'textarea', max: 160 },
      { key: 'seo.affiliates.title', label: 'Research Referral & Affiliate Program — title', type: 'text', max: 60 },
      { key: 'seo.affiliates.description', label: 'Research Referral & Affiliate Program — description', type: 'textarea', max: 160 },
      { key: 'seo.googleVerification', label: 'Google Search Console code', type: 'text', help: 'Only the content="…" value.' },
      { key: 'seo.bingVerification', label: 'Bing Webmaster code', type: 'text' },
    ],
  },
  {
    id: 'aeo',
    label: 'AI answers (AEO)',
    description: 'Plain facts about the business that ChatGPT, Google AI and other answer engines read from the page code.',
    fields: [
      { key: 'aeo.summary', label: 'One-paragraph summary of the business', type: 'textarea', max: 300 },
      { key: 'aeo.audience', label: 'Who you sell to', type: 'text' },
      { key: 'aeo.priceRange', label: 'Price range', type: 'text', help: '$, $$ or $$$.' },
    ],
  },
];

export const CONTENT_FIELDS = new Map(CONTENT_SECTIONS.flatMap((s) => s.fields).map((f) => [f.key, f]));

/** Saved values over the defaults. Unknown keys are dropped. */
export function mergeContent(stored: unknown): SiteContent {
  const out = { ...DEFAULT_CONTENT };
  if (stored && typeof stored === 'object') {
    for (const [key, value] of Object.entries(stored as Record<string, unknown>)) {
      if (key in DEFAULT_CONTENT && typeof value === 'string') out[key] = value;
    }
  }
  return out;
}

export function parseFaqs(value: string | undefined): FaqEntry[] {
  try {
    const list = JSON.parse(value ?? '[]');
    if (!Array.isArray(list)) return [];
    return list
      .map((f) => ({ category: String(f?.category ?? '').trim(), question: String(f?.question ?? '').trim(), answer: String(f?.answer ?? '').trim() }))
      .filter((f) => f.question && f.answer);
  } catch {
    return [];
  }
}

export const contentLines = (value: string | undefined) =>
  String(value ?? '').split('\n').map((l) => l.trim()).filter(Boolean);

/** Links a visitor may be sent to from editable content. */
export function safeHref(value: string | undefined): string {
  const v = String(value ?? '').trim();
  if (!v) return '';
  if (v.startsWith('/') && !v.startsWith('//')) return v;
  if (/^https?:\/\//i.test(v) || /^mailto:/i.test(v) || /^tel:/i.test(v)) return v;
  return '';
}

/**
 * Validate what the dashboard posts. Returns clean values for known keys, and
 * per-field messages for anything refused.
 */
export function sanitizeContent(input: unknown): { values: Record<string, string>; errors: Record<string, string> } {
  const values: Record<string, string> = {};
  const errors: Record<string, string> = {};
  if (!input || typeof input !== 'object') return { values, errors };

  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    const field = CONTENT_FIELDS.get(key);
    if (!field) continue;
    let value = typeof raw === 'string' ? raw : '';

    if (field.type === 'faq') {
      const list = parseFaqs(value).slice(0, 200).map((f) => ({
        category: f.category.slice(0, 120), question: f.question.slice(0, 500), answer: f.answer.slice(0, 5000),
      }));
      values[key] = JSON.stringify(list);
      continue;
    }

    value = value.replace(/\r\n/g, '\n').trim().slice(0, field.type === 'textarea' || field.type === 'lines' ? 5000 : 500);

    if (value && (field.type === 'url' || field.type === 'image') && !safeHref(value)) {
      errors[key] = 'Use a link starting with https:// or a page like /shop.';
      continue;
    }
    if (value && field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      errors[key] = 'That is not an email address.';
      continue;
    }
    values[key] = value;
  }
  return { values, errors };
}
