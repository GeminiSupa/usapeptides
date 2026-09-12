'use client';

import React from 'react';
import PolicyPage from '@/components/PolicyPage';

export default function ShippingPolicyPage() {
  return (
    <PolicyPage
      eyebrow="Delivery"
      title="Shipping Policy"
      updated="September 2026"
      intro="How orders are packed, when they leave us, and what happens if something goes wrong in transit."
      sections={[
        {
          heading: 'Processing time',
          body: [
            'Orders placed on a business day before 2:00pm Eastern are normally packed the same day. Anything later, or placed at a weekend, goes out on the next business day.',
            'You will receive a tracking number by email once the parcel is collected. Until it is scanned by the carrier, that number may not return any results.',
          ],
        },
        {
          heading: 'Destinations and cost',
          body: [
            'We ship within the United States only. Orders are dispatched from a domestic facility with tracking included on every parcel.',
            'Shipping is free on orders over $100 after any volume discount. Below that threshold a flat rate applies, shown at checkout before you pay.',
          ],
        },
        {
          heading: 'Packaging',
          body: [
            'Lyophilized material is shipped sealed in its original vial. Parcels are plain and carry no description of the contents on the outside.',
            'Lyophilized peptides are stable at ambient temperature for the duration of a domestic transit. Cold-chain shipping is not used as standard and is not required for the products in this catalogue.',
          ],
        },
        {
          heading: 'Delays, loss and damage',
          body: [
            'Once a parcel is with the carrier, transit time is outside our control. If tracking has not updated for five business days, contact us and we will open an enquiry.',
            'If a vial arrives broken, photograph the parcel and its contents before disposing of anything and contact us within 7 days of delivery. We will replace the item or refund it.',
            'If an address is entered incorrectly and the parcel is returned to us, we will contact you to arrange redelivery. The reshipping cost is payable by the customer.',
          ],
        },
        {
          heading: 'Who we can ship to',
          body: [
            'Orders are accepted only from research institutions, universities, licensed researchers and other qualified laboratory purchasers. We may ask for verification before dispatching an order.',
            'Materials in this catalogue are supplied for in-vitro laboratory research only. They are not drugs and are not intended for human or veterinary use.',
          ],
        },
      ]}
    />
  );
}
