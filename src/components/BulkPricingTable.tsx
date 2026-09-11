'use client';

import React from 'react';
import { Product } from '@/types';
import { Tag } from 'lucide-react';

export default function BulkPricingTable({ product }: { product: Product }) {
  return (
    <div className="p-4 rounded-2xl bg-brand-darker border border-brand-border space-y-3">
      <div className="flex items-center gap-2 text-xs font-bold text-white">
        <Tag className="w-4 h-4 text-cyan-400" />
        <span>Automatic Tiered Bulk Pricing</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {product.bulkPricing.map((tier, idx) => (
          <div
            key={idx}
            className="p-3 rounded-xl bg-brand-card border border-brand-border/60 text-center space-y-1 hover:border-cyan-500/40 transition-colors"
          >
            <div className="text-xs font-semibold text-gray-300">{tier.quantity} Vials</div>
            <div className="text-sm font-extrabold text-white">${tier.pricePerUnit.toFixed(2)}</div>
            <div className="text-[10px] font-bold text-emerald-400">
              {tier.discountPercent > 0 ? `${tier.discountPercent}% OFF` : 'Standard'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
