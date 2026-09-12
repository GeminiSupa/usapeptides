'use client';

import React from 'react';
import PolicyPage from '@/components/PolicyPage';

export default function ReturnRefundPolicyPage() {
  return (
    <PolicyPage
      eyebrow="Returns"
      title="Return & Refund Policy"
      updated="September 2026"
      intro="What can be returned, what cannot, and how the purity reimbursement works."
      sections={[
        {
          heading: 'Sealed vials cannot be returned',
          body: [
            'Once a vial has left our facility we cannot verify how it has been stored or handled, so opened or unsealed material cannot be resold and cannot be accepted back.',
            'This is a safety position rather than a commercial one. It does not limit the remedies below.',
          ],
        },
        {
          heading: 'Purity reimbursement',
          body: [
            'Send a vial purchased from us to an independent laboratory of your choosing. If the analysis returns a purity below the figure we published for that lot, we refund the purchase price of the item and the cost of the test.',
            'To qualify, the claim must reference an order placed with us, identify the lot number printed on the vial, and include the full report from the testing laboratory including its methodology.',
            'Claims must be raised within 60 days of delivery. We may ask to correspond with the testing laboratory directly.',
          ],
        },
        {
          heading: 'Wrong item, damage or shortage',
          body: [
            'If you receive the wrong product, a damaged vial, or fewer items than ordered, contact us within 7 days of delivery with photographs of the parcel and its contents.',
            'We will replace the affected items or refund them in full, including any shipping paid, at your preference.',
          ],
        },
        {
          heading: 'Cancelling an order',
          body: [
            'An order can be cancelled for a full refund at any point before it is dispatched. Email us with the order number as soon as possible.',
            'Once a tracking number has been issued the order is in transit and the sections above apply instead.',
          ],
        },
        {
          heading: 'How refunds are issued',
          body: [
            'Approved refunds are returned to the original payment method. Depending on your provider, the funds may take a further 5 to 10 business days to appear after we process them.',
            'We will confirm by email when a refund has been issued.',
          ],
        },
      ]}
    />
  );
}
