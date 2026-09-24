import { FAQItem } from '@/types';
import { BUSINESS } from '@/lib/env';

/**
 * The FAQ the site starts with. These are defaults: once the FAQ is saved in
 * the dashboard, the saved copy wins and changes here no longer show.
 *
 * The "General" answers are the writer's, kept close to his wording — they
 * deliberately describe what documentation shows rather than promising a
 * number. Research and handling questions live on the Knowledge Center page.
 */

const NAME = BUSINESS.name;

export const faqs: FAQItem[] = [
  {
    category: 'General',
    question: `What does ${NAME} sell?`,
    answer: `${NAME} supplies research peptides and laboratory reference materials intended exclusively for laboratory, analytical, and research purposes.`,
  },
  {
    category: 'General',
    question: `Is ${NAME} a U.S. peptide supplier?`,
    answer: `Yes. ${NAME} serves the United States research market. All orders are fulfilled domestically unless otherwise stated on the website or during checkout.`,
  },
  {
    category: 'General',
    question: `Can I order research peptides online from ${NAME}?`,
    answer:
      'Eligible research products can be ordered through the website subject to product availability, shipping eligibility, legal restrictions, and our Terms and Conditions. Customers are responsible for ensuring that their purchase and intended research use comply with applicable laws and institutional requirements.',
  },
  {
    category: 'General',
    question: 'Do I need an account to order?',
    answer:
      'Account and checkout options are displayed during the ordering process. Creating an account makes it easier to review previous orders, shipping information, and related account information, and to take part in our loyalty program.',
  },
  {
    category: 'General',
    question: 'Who is eligible to purchase?',
    answer:
      'Our compounds are strictly for laboratory in-vitro research purposes only. They are not intended for human consumption, clinical use, or veterinary applications. Purchases are restricted to research institutions, university laboratories, corporate R&D facilities, and qualified independent laboratory researchers.',
  },
  {
    category: 'General',
    question: `How do I contact ${NAME}?`,
    answer:
      'Visit the Contact page or email support. Include your order number when contacting us to help us locate the relevant information more quickly.',
  },
  {
    category: 'General',
    question: 'Where can I read the full policies?',
    answer:
      'Please review Quality Standards, the Shipping Policy, the Return Policy, the Privacy Policy and the COA database for our full policies.',
  },
  {
    category: 'Ordering & Bulk',
    question: 'Can laboratories or research organizations place larger orders?',
    answer:
      'Availability of larger research orders may vary by product. Laboratories, universities, research organizations, and other qualified purchasers seeking larger quantities can contact support for information on current availability.',
  },
  {
    category: 'Ordering & Bulk',
    question: 'Do you fulfill wholesale research peptide orders?',
    answer:
      'Wholesale or volume discounts may be offered for selected research materials. Contact support with the product, quantity, organization information, and research purchasing requirements so availability can be reviewed.',
  },
  {
    category: 'Ordering & Bulk',
    question: 'Can I request a product that is not currently listed?',
    answer:
      'Researchers may contact support with product requests. A request does not guarantee that a particular research material will be available, but customer requests help us understand what materials researchers are looking for.',
  },
  {
    category: 'Ordering & Bulk',
    question: 'How do volume and bulk discounts work?',
    answer:
      'Tiered bulk pricing is calculated automatically in your cart: 1-2 vials at standard price, 3-4 vials receive 10% off, 5-9 vials receive 15% off, and 10+ vials receive 20% off. You can also mix and match within the same category for tiered rates.',
  },
  {
    category: 'Documentation & Testing',
    question: 'How is product purity documented?',
    answer:
      'Analytical testing is lot-specific, and the applicable report is published in the COA database where it is available. Read the full report rather than a headline percentage: check that the product name and lot number match the vial in front of you, then check the laboratory, test date and method.',
  },
  {
    category: 'Documentation & Testing',
    question: 'What can an HPLC purity result actually tell me?',
    answer:
      'HPLC shows how much of the detected signal is associated with the primary peak under the test conditions. It does not by itself establish identity, mass, concentration, sterility, stability, or suitability for a particular protocol — those are separate analytical questions. The Knowledge Center explains this in full.',
  },
  {
    category: 'Documentation & Testing',
    question: 'What should I do if the lot on my vial does not match the report?',
    answer:
      'Contact support before relying on the material for research. A report tied to a different lot may not describe what you received, and a mismatch is worth resolving rather than assuming.',
  },
  {
    category: 'Shipping & Logistics',
    question: 'What are your domestic shipping options and timelines?',
    answer:
      'All orders ship from our United States facility via USPS Priority or FedEx 2-Day with live tracking. Orders placed before 2:00 PM EST ship same-day. Orders over $100 automatically qualify for free tracked US shipping.',
  },
  {
    category: 'Shipping & Logistics',
    question: 'How are shipments packaged?',
    answer:
      'Lyophilized materials are shipped in insulated mailers with protective cushioning. Follow the storage specifications on the product label and product page once the shipment arrives.',
  },
  {
    category: 'Storage & Handling',
    question: 'How should lyophilized materials be stored?',
    answer:
      'Storage requirements vary by compound and format, so the product label, product page and technical documentation come first. Materials should be protected from inappropriate heat, moisture, light and contamination. The Knowledge Center covers general laboratory handling principles.',
  },
  {
    category: 'Storage & Handling',
    question: 'What reconstitution solution is used for in-vitro work?',
    answer:
      'For in-vitro laboratory research, sterile bacteriostatic 0.9% benzyl alcohol water or sterile 0.9% sodium chloride solution is standard. Our reconstitution calculator works out diluent ratios. We do not provide human dosing, administration or treatment instructions.',
  },
  {
    category: 'Payments & Security',
    question: 'What payment methods do you accept?',
    answer:
      'Online payment is coming soon. For now, place your order on the site and our team emails you within one business day to confirm it and arrange payment. Nothing is charged at checkout and no card details are collected.',
  },
];
