'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import WhatsAppOrderButton from '@/components/WhatsAppOrderButton';
import { 
  ShoppingBag, 
  Trash2, 
  Plus, 
  Minus, 
  ArrowRight, 
  ShieldCheck, 
  Truck, 
  Tag, 
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { useCart } from '@/context/CartContext';

export default function CartPage() {
  const { 
    cart, 
    updateQuantity, 
    removeFromCart, 
    clearCart,
    subtotal, 
    bulkDiscountSavings,
    couponCode,
    couponDiscount,
    applyCoupon,
    removeCoupon,
    finalTotal,
    hasFreeShipping,
    amountNeededForFreeShipping,
    freeShippingThreshold
  } = useCart();

  const [inputCoupon, setInputCoupon] = useState('');
  const [couponMessage, setCouponMessage] = useState<{ success: boolean; text: string } | null>(null);
  const [ackCompliance, setAckCompliance] = useState(true);

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCoupon) return;
    const res = applyCoupon(inputCoupon);
    setCouponMessage({ success: res.success, text: res.message });
  };

  const freeShippingProgress = Math.min(100, (subtotal / freeShippingThreshold) * 100);

  return (
    <div className="shell py-10 space-y-8">
      
      <div className="border-b border-brand-border pb-6">
        <h1 className="page-title">
          Research Shopping Cart
        </h1>
        <p className="text-xs sm:text-sm text-brand-textMuted mt-1">
          Review your laboratory order, bulk discounts, and shipping requirements.
        </p>
      </div>

      {cart.length === 0 ? (
        <div className="text-center py-20 p-8 rounded-3xl bg-brand-card border border-brand-border space-y-4">
          <div className="w-16 h-16 bg-brand-darker mx-auto flex items-center justify-center text-brand-textMuted border border-brand-border">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-brand-heading">Your Cart is Currently Empty</h2>
          <p className="text-xs text-brand-textMuted max-w-sm mx-auto">
            Browse our catalog of HPLC-tested research peptides to begin your laboratory order.
          </p>
          <Link
            href="/shop"
            className="inline-block px-6 py-3 bg-brand-accent hover:bg-brand-accentHover text-brand-onAccent font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.12em] rounded-xl transition-colors"
          >
            Explore Catalog
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Cart Table Area */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Free Shipping Meter */}
            <div className="p-4 rounded-2xl bg-brand-card border border-brand-border space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-brand-body">
                  <Truck className="w-4 h-4 text-brand-accentGlow" />
                  {hasFreeShipping ? (
                    <span className="text-brand-success font-bold">You qualify for FREE US Tracked Shipping!</span>
                  ) : (
                    <span>Add <strong className="text-brand-accentGlow">${amountNeededForFreeShipping.toFixed(2)}</strong> more for Free Shipping</span>
                  )}
                </span>
                <span className="text-[10px] font-mono text-brand-textMuted">{freeShippingProgress.toFixed(0)}%</span>
              </div>
              <div className="w-full h-2 bg-brand-darker overflow-hidden">
                <div
                  className="h-full bg-brand-accent transition-all duration-300"
                  style={{ width: `${freeShippingProgress}%` }}
                />
              </div>
            </div>

            {/* Items Table */}
            <div className="rounded-2xl bg-brand-card border border-brand-border overflow-hidden">
              <div className="p-4 bg-brand-darker border-b border-brand-border flex items-center justify-between text-xs font-semibold text-brand-textMuted">
                <span>Product Item</span>
                <span className="hidden sm:inline">Price &amp; Quantity</span>
              </div>

              <div className="divide-y divide-brand-border/60">
                {cart.map((item) => (
                  <div key={item.product.id} className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-16 h-16 rounded-xl bg-brand-darker p-1 border border-brand-border/60 flex-shrink-0 flex items-center justify-center">
                        <img
                          src={item.product.image}
                          alt={item.product.name}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/product/${item.product.slug}`}
                          className="text-sm font-bold text-brand-heading hover:text-brand-accentGlow line-clamp-1"
                        >
                          {item.product.name}
                        </Link>
                        <div className="text-[11px] text-brand-textMuted flex items-center gap-2 pt-0.5">
                          <span>SKU: {item.product.sku}</span>
                          <span>•</span>
                          <span className="text-brand-success font-semibold">{item.product.purity}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-brand-border/40">
                      {/* Quantity Adjuster */}
                      <div className="flex items-center border border-brand-border rounded-xl bg-brand-darker overflow-hidden">
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          aria-label="Decrease quantity"
                          className="flex h-10 w-10 items-center justify-center text-brand-textMuted hover:text-brand-heading"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-3 py-1.5 text-xs text-brand-heading font-mono font-bold">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          aria-label="Increase quantity"
                          className="flex h-10 w-10 items-center justify-center text-brand-textMuted hover:text-brand-heading"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Line Total */}
                      <div className="text-right">
                        <div className="text-sm font-extrabold text-brand-heading">
                          ${(item.selectedPrice * item.quantity).toFixed(2)}
                        </div>
                        <div className="text-[10px] text-brand-textMuted">
                          ${item.selectedPrice.toFixed(2)} / ea
                        </div>
                      </div>

                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="flex h-10 w-10 items-center justify-center text-brand-textMuted hover:text-red-600"
                        title="Remove"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-brand-darker border-t border-brand-border flex justify-between items-center text-xs">
                <Link href="/shop" className="text-brand-accentGlow hover:underline">
                  ← Continue Shopping
                </Link>
                <button
                  onClick={clearCart}
                  className="text-brand-textMuted hover:text-red-600 text-xs"
                >
                  Clear Cart
                </button>
              </div>
            </div>

            {/* Coupon Code Box */}
            <div className="p-5 rounded-2xl bg-brand-card border border-brand-border space-y-3">
              <span className="text-xs font-bold text-brand-heading flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-brand-accentGlow" />
                Laboratory Promotional or Affiliate Discount Code
              </span>

              {couponCode ? (
                <div className="flex items-center justify-between p-3 rounded-xl bg-navy-50 border border-brand-accentGlow/40 text-xs text-brand-accentGlow">
                  <span>Coupon <strong>{couponCode}</strong> Active</span>
                  <button
                    onClick={removeCoupon}
                    className="text-red-600 hover:underline text-xs"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApply} className="flex gap-2">
                  <input
                    type="text"
                    value={inputCoupon}
                    onChange={(e) => setInputCoupon(e.target.value)}
                    placeholder="Enter code (e.g. RESEARCH10)"
                    className="bg-brand-dark border border-brand-border rounded-xl px-4 py-2 text-xs text-brand-heading uppercase placeholder-brand-textMuted focus:outline-none focus:border-brand-accentGlow flex-grow"
                  />
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-brand-accent hover:bg-brand-accentHover text-brand-onAccent font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.12em] transition-colors"
                  >
                    Apply Code
                  </button>
                </form>
              )}

              {couponMessage && (
                <div className={`text-xs ${couponMessage.success ? 'text-brand-success' : 'text-red-600'}`}>
                  {couponMessage.text}
                </div>
              )}
            </div>

          </div>

          {/* Right Order Summary Area */}
          <div className="lg:col-span-4 space-y-6">
            <div className="p-6 rounded-2xl bg-brand-card border border-brand-border space-y-5">
              <h3 className="text-base font-extrabold text-brand-heading pb-3 border-b border-brand-border">
                Order Summary
              </h3>

              <div className="space-y-3 text-xs text-brand-body">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-semibold text-brand-heading">${subtotal.toFixed(2)}</span>
                </div>

                {bulkDiscountSavings > 0 && (
                  <div className="flex justify-between text-brand-success">
                    <span>Volume Bulk Savings:</span>
                    <span className="font-bold">-${bulkDiscountSavings.toFixed(2)}</span>
                  </div>
                )}

                {couponDiscount > 0 && (
                  <div className="flex justify-between text-brand-accentGlow">
                    <span>Coupon ({couponCode}):</span>
                    <span className="font-bold">-${couponDiscount.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span>US Domestic Shipping:</span>
                  <span className={hasFreeShipping ? 'text-brand-success font-bold' : 'text-brand-heading'}>
                    {hasFreeShipping ? 'FREE' : '$9.95'}
                  </span>
                </div>

                <div className="flex justify-between text-base font-extrabold text-brand-heading pt-3 border-t border-brand-border">
                  <span>Total:</span>
                  <span className="text-brand-accentGlow text-xl">
                    ${(finalTotal + (hasFreeShipping ? 0 : 9.95)).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Research Compliance Checkbox */}
              <div 
                className="p-3 rounded-xl bg-brand-darker border border-brand-border/80 flex items-start gap-2.5 cursor-pointer text-[11px] text-brand-body select-none"
                onClick={() => setAckCompliance(!ackCompliance)}
              >
                <input
                  type="checkbox"
                  checked={ackCompliance}
                  onChange={(e) => setAckCompliance(e.target.checked)}
                  className="rounded bg-brand-dark border-brand-border text-brand-accent mt-0.5"
                />
                <span>I confirm that all compounds are purchased solely for in-vitro laboratory research and not for human or animal consumption.</span>
              </div>

              {/* Checkout Button */}
              <Link
                href={ackCompliance ? '/checkout' : '#'}
                onClick={(e) => {
                  if (!ackCompliance) {
                    e.preventDefault();
                    alert('Please check the research compliance box to proceed.');
                  }
                }}
                className={`w-full py-4 px-6 font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.12em] transition-colors flex items-center justify-center gap-2 ${
                  ackCompliance
                    ? 'bg-action hover:bg-action-hover text-white'
                    : 'bg-brand-cardHover text-brand-textMuted cursor-not-allowed'
                }`}
              >
                <span>Proceed to Secure Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <WhatsAppOrderButton
                className="w-full"
                disabled={!ackCompliance}
                lines={cart.map((i) => ({ name: i.product.name, quantity: i.quantity, unitPrice: i.selectedPrice }))}
                total={finalTotal}
              />

              <div className="text-[10px] text-brand-textMuted text-center flex items-center justify-center gap-1.5 pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-success" />
                <span>256-Bit SSL Encrypted • US Climate Packaging</span>
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
