'use client';

import React from 'react';
import PolicyPage from '@/components/PolicyPage';

export default function PrivacyPolicyPage() {
  return (
    <PolicyPage
      eyebrow="Privacy"
      title="Privacy Policy"
      updated="September 2026"
      intro="What we collect when you use this site, why we hold it, and how to have it removed."
      sections={[
        {
          heading: 'What we collect',
          body: [
            'When you place an order we collect your name, email address, phone number, shipping address, institution where given, and the contents of the order itself.',
            'When you contact us or subscribe to updates, we collect the details you submit in that form.',
            'We also record basic usage data — pages viewed, referring site, and an anonymous session identifier — so we can see which parts of the catalogue are being used.',
          ],
        },
        {
          heading: 'What we do not collect',
          body: [
            'We do not store full card numbers. Card payments, where offered, are handled by a third-party payment processor and the card details never reach our servers.',
            'We do not buy personal data from third parties, and we do not attempt to identify individual visitors from usage data.',
          ],
        },
        {
          heading: 'Why we hold it',
          body: [
            'Order and contact details are held to fulfil orders, provide support, meet our record-keeping obligations, and verify that purchasers are qualified laboratory buyers.',
            'Marketing emails are sent only to addresses that have opted in, and every one carries an unsubscribe link.',
          ],
        },
        {
          heading: 'Who it is shared with',
          body: [
            'Order details are shared with the carrier delivering your parcel and with our payment processor where a payment is involved. Both receive only what is needed to complete their part.',
            'We do not sell personal data, and we do not share it for anyone else’s marketing.',
            'We may disclose information where we are legally required to do so.',
          ],
        },
        {
          heading: 'Your choices',
          body: [
            'You can ask for a copy of the data we hold about you, ask us to correct it, or ask us to delete it. Email us and we will respond within 30 days.',
            'Deletion requests are honoured except where we are required to retain transaction records, in which case we retain the minimum necessary and remove the rest.',
            'You can unsubscribe from marketing email at any time using the link in any message, or through the unsubscribe page on this site.',
          ],
        },
        {
          heading: 'Storage and security',
          body: [
            'Data is held in a managed database with access restricted to the people who operate this store. Access to administrative credentials is limited and not shared.',
            'No system is perfectly secure. If a breach affects your data, we will notify affected customers.',
          ],
        },
      ]}
    />
  );
}
