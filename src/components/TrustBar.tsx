'use client';

import React from 'react';
import { Truck, BadgeCheck, FlaskConical, Headset } from 'lucide-react';

/**
 * Four-up assurance row directly under the hero. Flat cells divided by
 * hairlines — no raised cards.
 */
const items = [
  {
    icon: Truck,
    title: 'Shipped From The USA',
    body: 'Packed and dispatched from a domestic facility with tracking on every parcel. Delivery is free once an order passes $100.',
  },
  {
    icon: BadgeCheck,
    title: 'Backed Against Your Own Test',
    body: 'Send a vial for independent analysis. Come back under our published number and we cover the order and the testing fee.',
  },
  {
    icon: FlaskConical,
    title: 'Consistent Lot Quality',
    body: 'Supplied lyophilized in sealed vials under inert gas, each lot matched to the chromatography report filed against it.',
  },
  {
    icon: Headset,
    title: 'Straight Answers',
    body: 'We will confirm what is in a vial, which report belongs to it, and where your order is. Protocol and dosing questions we leave to you.',
  },
];

export default function TrustBar() {
  return (
    <section className="border-y border-brand-border bg-brand-card/60">
      <div className="shell">
        <div className="grid grid-cols-1 divide-y divide-brand-border sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
          {items.map(({ icon: Icon, title, body }) => (
            <div key={title} className="px-0 py-8 sm:px-6 lg:px-7 first:lg:pl-0 last:lg:pr-0">
              <Icon className="h-6 w-6 text-brand-accentGlow" strokeWidth={1.75} />
              <h3 className="mt-4 font-display text-[0.9375rem] font-extrabold text-brand-heading">
                {title}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-brand-textMuted">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
