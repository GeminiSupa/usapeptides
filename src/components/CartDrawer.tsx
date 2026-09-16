'use client';

import React from 'react';
import Link from 'next/link';
import { 
  X, 
  Trash2, 
  Plus, 
  Minus, 
  ShoppingBag, 
  Truck, 
  ArrowRight, 
  ShieldCheck,
  Tag
} from 'lucide-react';
import { useCart } from '@/context/CartContext';

export default function CartDrawer() {
  const { 
    cart, 
    isCartOpen, 
    setIsCartOpen, 
    updateQuantity, 
    removeFromCart, 
    subtotal, 
    bulkDiscountSavings,
    couponCode,
    couponDiscount,
    finalTotal,
    hasFreeShipping,
    amountNeededForFreeShipping,
    freeShippingThreshold
  } = useCart();

  if (!isCartOpen) return null;

  const freeShippingProgress = Math.min(100, (subtotal / freeShippingThreshold) * 100);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={() => setIsCartOpen(false)}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-brand-card border-l border-brand-border flex flex-col">
          
          {/* Header */}
          <div className="p-4 border-b border-brand-border bg-brand-darker flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-brand-accentGlow" />
              <h2 className="text-base font-bold text-brand-heading">Your Research Cart</h2>
              <span className="text-xs bg-brand-dark text-brand-accentGlow px-2 py-0.5 rounded-full border border-brand-border font-mono">
                {cart.reduce((a, b) => a + b.quantity, 0)}
              </span>
            </div>
            <button
              onClick={() => setIsCartOpen(false)}
              className="p-2 text-brand-textMuted hover:text-brand-heading rounded-lg hover:bg-brand-dark"
              aria-label="Close cart"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Free Shipping Progress Meter */}
          <div className="p-3.5 bg-brand-dark/80 border-b border-brand-border/60">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="flex items-center gap-1.5 text-brand-body">
                <Truck className="w-3.5 h-3.5 text-brand-accentGlow" />
                {hasFreeShipping ? (
                  <span className="text-brand-success font-bold">You qualify for FREE US Tracked Shipping!</span>
                ) : (
                  <span>Add <strong className="text-brand-accentGlow">${amountNeededForFreeShipping.toFixed(2)}</strong> more for Free Shipping</span>
                )}
              </span>
              <span className="text-[10px] font-mono text-brand-textMuted">{freeShippingProgress.toFixed(0)}%</span>
            </div>
            <div className="w-full h-1.5 bg-brand-border overflow-hidden">
              <div 
                className="h-full bg-brand-accent transition-all duration-300"
                style={{ width: `${freeShippingProgress}%` }}
              />
            </div>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {cart.length === 0 ? (
              <div className="text-center py-16 space-y-4">
                <div className="w-16 h-16 rounded-full bg-brand-dark mx-auto flex items-center justify-center text-brand-textMuted border border-brand-border">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-bold text-brand-heading">Your cart is empty</h3>
                <p className="text-xs text-brand-textMuted max-w-xs mx-auto">
                  Explore our HPLC-tested peptide catalog to add laboratory compounds to your order.
                </p>
                <Link
                  href="/shop"
                  onClick={() => setIsCartOpen(false)}
                  className="inline-block px-5 py-2.5 rounded-xl bg-brand-accent text-brand-onAccent font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.12em] hover:bg-brand-accentHover transition-colors"
                >
                  Browse Peptides
                </Link>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.product.id}
                  className="p-3.5 rounded-xl bg-brand-dark/60 border border-brand-border/80 flex gap-3 relative group"
                >
                  {/* Thumbnail */}
                  <div className="w-16 h-16 rounded-lg bg-brand-card p-1 border border-brand-border/40 flex-shrink-0 flex items-center justify-center">
                    <img
                      src={item.product.image}
                      alt={item.product.name}
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/product/${item.product.slug}`}
                        onClick={() => setIsCartOpen(false)}
                        className="text-xs font-bold text-brand-heading hover:text-brand-accentGlow line-clamp-1"
                      >
                        {item.product.name}
                      </Link>
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-brand-textMuted hover:text-red-600 p-1"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="text-[10px] text-brand-textMuted flex items-center gap-2">
                      <span>SKU: {item.product.sku}</span>
                      <span>•</span>
                      <span className="text-brand-success font-semibold">{item.product.purity}</span>
                    </div>

                    {/* Quantity & Unit Price */}
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center border border-brand-border rounded-lg bg-brand-darker overflow-hidden">
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          className="px-2 py-1 text-brand-textMuted hover:text-brand-heading hover:bg-brand-card"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2 py-1 text-xs text-brand-heading font-mono font-bold">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          className="px-2 py-1 text-brand-textMuted hover:text-brand-heading hover:bg-brand-card"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-extrabold text-brand-heading">
                          ${(item.selectedPrice * item.quantity).toFixed(2)}
                        </div>
                        {item.quantity >= 3 && (
                          <span className="text-[9px] text-brand-success font-semibold block">
                            Bulk tier applied (${item.selectedPrice.toFixed(2)}/ea)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Summary & Checkout */}
          {cart.length > 0 && (
            <div className="p-4 border-t border-brand-border bg-brand-darker space-y-3">
              {/* Savings callout */}
              {bulkDiscountSavings > 0 && (
                <div className="flex items-center justify-between text-xs text-brand-success bg-forest-50 border border-brand-success/30 px-3 py-1.5 rounded-lg">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Tag className="w-3.5 h-3.5" />
                    Volume Tier Savings:
                  </span>
                  <span className="font-bold">-${bulkDiscountSavings.toFixed(2)}</span>
                </div>
              )}

              {/* Coupon discount */}
              {couponDiscount > 0 && (
                <div className="flex items-center justify-between text-xs text-brand-accentGlow bg-navy-50 border border-brand-accentGlow/30 px-3 py-1.5 rounded-lg">
                  <span>Coupon Discount ({couponCode}):</span>
                  <span className="font-bold">-${couponDiscount.toFixed(2)}</span>
                </div>
              )}

              <div className="space-y-1.5 text-xs text-brand-textMuted pt-1">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="text-brand-heading font-semibold">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tracked US Shipping:</span>
                  <span className={hasFreeShipping ? 'text-brand-success font-bold' : 'text-brand-heading'}>
                    {hasFreeShipping ? 'FREE' : '$9.95'}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-extrabold text-brand-heading pt-2 border-t border-brand-border">
                  <span>Estimated Total:</span>
                  <span className="text-brand-accentGlow text-base">
                    ${(finalTotal + (hasFreeShipping ? 0 : 9.95)).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <Link
                  href="/checkout"
                  onClick={() => setIsCartOpen(false)}
                  className="w-full py-3.5 px-4 rounded-xl bg-action hover:bg-action-hover text-white font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.12em] transition-all flex items-center justify-center gap-2"
                >
                  <span>Proceed to Checkout</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/cart"
                  onClick={() => setIsCartOpen(false)}
                  className="w-full py-2.5 px-4 rounded-xl bg-brand-card hover:bg-brand-cardHover border border-brand-border text-brand-body hover:text-brand-heading text-xs font-semibold transition-colors text-center block"
                >
                  View Full Cart & Apply Coupons
                </Link>
              </div>

              <div className="text-[10px] text-brand-textMuted text-center flex items-center justify-center gap-1.5 pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-success" />
                <span>SSL Encrypted • Research Laboratory Purchase</span>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
