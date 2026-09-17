'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { readReferral } from '@/components/ReferralCapture';
import { FLAT_SHIPPING } from '@/lib/checkout';
import { 
  ShieldCheck, 
  CreditCard, 
  Building2, 
  Truck, 
  Lock, 
  CheckCircle2, 
  ArrowRight,
  Bitcoin,
  DollarSign
} from 'lucide-react';

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, finalTotal, subtotal, hasFreeShipping, clearCart } = useCart();

  const [paymentMethod, setPaymentMethod] = useState<'card' | 'zelle' | 'crypto' | 'wire'>('card');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    institution: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    country: 'United States',
    cardNumber: '',
    cardExp: '',
    cardCvc: '',
    notes: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    // Remembered in this browser so an unfinished cart can be followed up.
    if (e.target.name === 'email') {
      try { localStorage.setItem('upd_checkout_email', e.target.value.trim()); } catch { /* ignore */ }
    }
  };

  /**
   * Saves the order through /api/orders. This used to wait a moment and show the
   * success page without saving anything, so no order ever reached the
   * dashboard.
   *
   * Only product slugs and quantities are sent; the server prices everything.
   * Card details are never sent anywhere — nothing on this site can charge a
   * card yet, so the order is saved as pending.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          fullName: `${formData.firstName} ${formData.lastName}`.trim(),
          institution: formData.institution,
          phone: formData.phone,
          items: cart.map((item) => ({ slug: item.product.slug, quantity: item.quantity })),
          shippingAddress: {
            line1: formData.address,
            city: formData.city,
            state: formData.state,
            postal_code: formData.zip,
            country: formData.country,
          },
          complianceAck: true,
          notes: formData.notes || undefined,
          paymentMethod,
          ref: readReferral(),
        }),
      });
      const payload = await res.json().catch(() => null);

      if (!res.ok) {
        const firstField = Object.values((payload?.fields ?? {}) as Record<string, string>)[0];
        setSubmitError(firstField ?? payload?.message ?? 'We could not place your order. Please try again.');
        setIsSubmitting(false);
        return;
      }

      clearCart();
      const orderNumber = payload?.data?.order?.orderNumber;
      router.push(orderNumber ? `/checkout/success?order=${encodeURIComponent(orderNumber)}` : '/checkout/success');
    } catch {
      setSubmitError('We could not reach the store. Check your connection and try again.');
      setIsSubmitting(false);
    }
  };

  const shippingCost = hasFreeShipping ? 0 : FLAT_SHIPPING;
  const orderTotal = finalTotal + shippingCost;

  if (cart.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="text-2xl font-bold text-brand-heading">Your cart is currently empty</h2>
        <p className="text-xs text-brand-textMuted">Add peptides to your cart before checking out.</p>
        <Link href="/shop" className="inline-block px-6 py-3 bg-brand-accent text-brand-onAccent font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.12em] rounded-xl">
          Return to Shop
        </Link>
      </div>
    );
  }

  return (
    <div className="shell py-10 space-y-8">
      
      <div className="border-b border-brand-border pb-6">
        <div className="eyebrow mb-2.5">
          Secure Procurement
        </div>
        <h1 className="page-title">
          Laboratory Checkout &amp; Verification
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Form: Shipping & Institution Info */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Institution & Researcher Details */}
          <div className="p-6 rounded-2xl bg-brand-card border border-brand-border space-y-4">
            <h3 className="text-sm font-bold text-brand-heading flex items-center gap-2 border-b border-brand-border pb-3">
              <Building2 className="w-4 h-4 text-brand-accentGlow" />
              1. Research Institution &amp; Contact Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-brand-textMuted block mb-1">First Name *</label>
                <input
                  type="text"
                  name="firstName"
                  required
                  value={formData.firstName}
                  onChange={handleChange}
                  className="w-full bg-brand-dark border border-brand-border rounded-xl px-3 py-2 text-xs text-brand-heading focus:outline-none focus:"
                />
              </div>
              <div>
                <label className="text-xs text-brand-textMuted block mb-1">Last Name *</label>
                <input
                  type="text"
                  name="lastName"
                  required
                  value={formData.lastName}
                  onChange={handleChange}
                  className="w-full bg-brand-dark border border-brand-border rounded-xl px-3 py-2 text-xs text-brand-heading focus:outline-none focus:"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-brand-textMuted block mb-1">Institution / Laboratory / Company Name *</label>
                <input
                  type="text"
                  name="institution"
                  required
                  placeholder="e.g. BioResearch Labs LLC / University Chemistry Dept"
                  value={formData.institution}
                  onChange={handleChange}
                  className="w-full bg-brand-dark border border-brand-border rounded-xl px-3 py-2 text-xs text-brand-heading focus:outline-none focus:"
                />
              </div>
              <div>
                <label className="text-xs text-brand-textMuted block mb-1">Email Address (Order Confirmation) *</label>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full bg-brand-dark border border-brand-border rounded-xl px-3 py-2 text-xs text-brand-heading focus:outline-none focus:"
                />
              </div>
              <div>
                <label className="text-xs text-brand-textMuted block mb-1">Phone Number (Tracking SMS) *</label>
                <input
                  type="tel"
                  name="phone"
                  required
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full bg-brand-dark border border-brand-border rounded-xl px-3 py-2 text-xs text-brand-heading focus:outline-none focus:"
                />
              </div>
            </div>
          </div>

          {/* Shipping Address */}
          <div className="p-6 rounded-2xl bg-brand-card border border-brand-border space-y-4">
            <h3 className="text-sm font-bold text-brand-heading flex items-center gap-2 border-b border-brand-border pb-3">
              <Truck className="w-4 h-4 text-brand-accentGlow" />
              2. US Domestic Shipping Destination
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-3">
                <label className="text-xs text-brand-textMuted block mb-1">Street Address *</label>
                <input
                  type="text"
                  name="address"
                  required
                  value={formData.address}
                  onChange={handleChange}
                  className="w-full bg-brand-dark border border-brand-border rounded-xl px-3 py-2 text-xs text-brand-heading focus:outline-none focus:"
                />
              </div>
              <div>
                <label className="text-xs text-brand-textMuted block mb-1">City *</label>
                <input
                  type="text"
                  name="city"
                  required
                  value={formData.city}
                  onChange={handleChange}
                  className="w-full bg-brand-dark border border-brand-border rounded-xl px-3 py-2 text-xs text-brand-heading focus:outline-none focus:"
                />
              </div>
              <div>
                <label className="text-xs text-brand-textMuted block mb-1">State *</label>
                <input
                  type="text"
                  name="state"
                  required
                  placeholder="e.g. CA, NY, TX"
                  value={formData.state}
                  onChange={handleChange}
                  className="w-full bg-brand-dark border border-brand-border rounded-xl px-3 py-2 text-xs text-brand-heading focus:outline-none focus:"
                />
              </div>
              <div>
                <label className="text-xs text-brand-textMuted block mb-1">ZIP / Postal Code *</label>
                <input
                  type="text"
                  name="zip"
                  required
                  value={formData.zip}
                  onChange={handleChange}
                  className="w-full bg-brand-dark border border-brand-border rounded-xl px-3 py-2 text-xs text-brand-heading focus:outline-none focus:"
                />
              </div>
            </div>
          </div>

          {/* Payment Selection */}
          <div className="p-6 rounded-2xl bg-brand-card border border-brand-border space-y-4">
            <h3 className="text-sm font-bold text-brand-heading flex items-center gap-2 border-b border-brand-border pb-3">
              <Lock className="w-4 h-4 text-brand-accentGlow" />
              3. Payment Selection
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'card', label: 'Credit Card', icon: <CreditCard className="w-4 h-4" /> },
                { id: 'zelle', label: 'Zelle Pay', icon: <DollarSign className="w-4 h-4" /> },
                { id: 'crypto', label: 'Bitcoin / USDT', icon: <Bitcoin className="w-4 h-4" /> },
                { id: 'wire', label: 'Bank Wire / ACH', icon: <Building2 className="w-4 h-4" /> },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPaymentMethod(p.id as any)}
                  className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                    paymentMethod === p.id
                      ? 'bg-navy-50 border-brand-accentGlow text-brand-heading shadow-md'
                      : 'bg-brand-darker border-brand-border text-brand-textMuted hover:text-brand-heading'
                  }`}
                >
                  {p.icon}
                  <span>{p.label}</span>
                </button>
              ))}
            </div>

            {paymentMethod === 'card' && (
              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-xs text-brand-textMuted block mb-1">Card Number *</label>
                  <input
                    type="text"
                    name="cardNumber"
                    placeholder="4000 1234 5678 9010"
                    required
                    value={formData.cardNumber}
                    onChange={handleChange}
                    className="w-full bg-brand-dark border border-brand-border rounded-xl px-3 py-2 text-xs text-brand-heading font-mono focus:outline-none focus:"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-brand-textMuted block mb-1">MM / YY *</label>
                    <input
                      type="text"
                      name="cardExp"
                      placeholder="12/28"
                      required
                      value={formData.cardExp}
                      onChange={handleChange}
                      className="w-full bg-brand-dark border border-brand-border rounded-xl px-3 py-2 text-xs text-brand-heading font-mono focus:outline-none focus:"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-brand-textMuted block mb-1">CVC / CVV *</label>
                    <input
                      type="text"
                      name="cardCvc"
                      placeholder="123"
                      required
                      value={formData.cardCvc}
                      onChange={handleChange}
                      className="w-full bg-brand-dark border border-brand-border rounded-xl px-3 py-2 text-xs text-brand-heading font-mono focus:outline-none focus:"
                    />
                  </div>
                </div>
              </div>
            )}

            {paymentMethod === 'zelle' && (
              <div className="p-4 rounded-xl bg-brand-darker border border-brand-border text-xs text-brand-body space-y-1 leading-relaxed">
                <span className="font-bold text-brand-heading block">Zelle Payment Instructions:</span>
                <p>Transfer order total to: <strong className="text-brand-accentGlow font-mono">payments@usapeptides.com</strong></p>
                <p className="text-brand-textMuted text-[11px]">Include your order name in memo. Orders ship immediately upon receipt confirmation.</p>
              </div>
            )}

            {paymentMethod === 'crypto' && (
              <div className="p-4 rounded-xl bg-brand-darker border border-brand-border text-xs text-brand-body space-y-1">
                <span className="font-bold text-brand-heading block">Crypto (BTC / USDT TRC20 / ETH):</span>
                <p>A dynamic cryptocurrency invoice QR code and address will be displayed on the next confirmation screen.</p>
              </div>
            )}

            {paymentMethod === 'wire' && (
              <div className="p-4 rounded-xl bg-brand-darker border border-brand-border text-xs text-brand-body space-y-1">
                <span className="font-bold text-brand-heading block">Domestic Wire / ACH:</span>
                <p>Wiring instructions and invoice will be automatically emailed to your institution address upon submission.</p>
              </div>
            )}
          </div>

        </div>

        {/* Right Summary & Place Order */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 rounded-2xl bg-brand-card border border-brand-border space-y-5 sticky top-28">
            <h3 className="text-base font-extrabold text-brand-heading pb-3 border-b border-brand-border">
              Review Lab Order ({cart.reduce((a, b) => a + b.quantity, 0)} Items)
            </h3>

            <div className="max-h-60 overflow-y-auto divide-y divide-brand-border/60 pr-1">
              {cart.map((item) => (
                <div key={item.product.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="min-w-0 pr-2">
                    <span className="text-brand-heading font-semibold block truncate">{item.product.name}</span>
                    <span className="text-[10px] text-brand-textMuted font-mono">Qty: {item.quantity} × ${item.selectedPrice.toFixed(2)}</span>
                  </div>
                  <span className="text-brand-heading font-extrabold font-mono flex-shrink-0">
                    ${(item.selectedPrice * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-2 text-xs text-brand-body pt-3 border-t border-brand-border">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="text-brand-heading font-bold">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tracked US Shipping:</span>
                <span className={hasFreeShipping ? 'text-brand-success font-bold' : 'text-brand-heading'}>
                  {hasFreeShipping ? 'FREE' : `$${FLAT_SHIPPING.toFixed(2)}`}
                </span>
              </div>
              <div className="flex justify-between text-base font-black text-brand-heading pt-2 border-t border-brand-border">
                <span>Total Amount:</span>
                <span className="text-brand-accentGlow text-xl font-mono">${orderTotal.toFixed(2)}</span>
              </div>
            </div>

            {submitError && (
              <p className="border border-brand-accent/60 p-3 text-xs leading-relaxed text-brand-accentGlow">{submitError}</p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 px-6 rounded-xl bg-action hover:bg-action-hover text-white font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.12em] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Processing Laboratory Order...</span>
              ) : (
                <>
                  <span>Submit &amp; Place Research Order</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <p className="text-[10px] text-brand-textMuted text-center leading-relaxed">
              By placing this order, you verify that you are authorized on behalf of a research entity and acknowledge products are for in-vitro research use only.
            </p>
          </div>
        </div>

      </form>

    </div>
  );
}
