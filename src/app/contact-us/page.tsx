'use client';

import React, { useState } from 'react';
import { Mail, Phone, MapPin, Clock, Send, ShieldCheck, Loader2 } from 'lucide-react';
import { useSiteContent } from '@/components/SiteContentProvider';
import { isEmail, isPersonName } from '@/lib/validate';

export default function ContactUsPage() {
  const { t } = useSiteContent();
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: 'General Inquiry',
    orderNumber: '',
    message: ''
  });

  // Saved as an enquiry in the dashboard (Enquiries). It used to only show the
  // thank-you message and send nothing.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Mirrors /api/contact, which checks all of this again.
    const errors: Record<string, string> = {};
    if (!isPersonName(formData.name)) errors.name = 'Enter your name.';
    if (!isEmail(formData.email)) errors.email = 'Enter a valid email address.';
    if (formData.message.trim().length < 10) errors.message = 'Enter a message of at least 10 characters.';
    setFieldErrors(errors);
    if (Object.keys(errors).length) { setSendError('Check the highlighted fields and try again.'); return; }
    setSending(true); setSendError('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          subject: formData.orderNumber ? `${formData.subject} — order ${formData.orderNumber}` : formData.subject,
          message: formData.message,
        }),
      });
      if (!res.ok) {
        const p = await res.json().catch(() => null);
        setFieldErrors((p?.fields ?? {}) as Record<string, string>);
        throw new Error(p?.message ?? 'Your message could not be sent.');
      }
      setSubmitted(true);
    } catch (err) {
      setSendError(err instanceof Error ? `${err.message} Please email us instead.` : 'Your message could not be sent.');
    } finally {
      setSending(false);
    }
  };
  const phone = t('contact.phone');

  return (
    <div className="shell py-10 space-y-10">
      
      <div className="border-b border-brand-border pb-6">
        <div className="eyebrow mb-2.5">
          {t('contactPage.eyebrow')}
        </div>
        <h1 className="page-title">
          {t('contactPage.title')}
        </h1>
        <p className="text-xs sm:text-sm text-brand-textMuted mt-2 max-w-2xl">
          {t('contactPage.intro')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Contact Info Sidebar */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 rounded-2xl bg-brand-card border border-brand-border space-y-6">
            <h3 className="font-bold text-brand-heading text-base">Laboratory Support Details</h3>
            
            <div className="space-y-4 text-xs text-brand-body">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-brand-accentGlow flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-brand-textMuted text-[10px] uppercase block">Email Address</span>
                  <a href={`mailto:${t('contact.email')}`} className="text-brand-heading hover:text-brand-accentGlow font-semibold">
                    {t('contact.email')}
                  </a>
                </div>
              </div>

              {phone && (
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-brand-accentGlow flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-brand-textMuted text-[10px] uppercase block">Phone</span>
                    <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="text-brand-heading hover:text-brand-accentGlow font-semibold">{phone}</a>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-brand-success flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-brand-textMuted text-[10px] uppercase block">Operations &amp; Fulfillment</span>
                  <span className="whitespace-pre-line text-brand-heading">{t('contact.address')}</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-brand-textMuted flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-brand-textMuted text-[10px] uppercase block">Hours of Operation</span>
                  <span className="text-brand-heading">{t('contact.hours')}</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-brand-border text-[11px] text-brand-textMuted">
              <strong className="text-red-700 block mb-1">Compliance Policy:</strong>
              {t('contactPage.policy')}
            </div>
          </div>
        </div>

        {/* Contact Form */}
        <div className="lg:col-span-7">
          <div className="p-6 sm:p-8 rounded-2xl bg-brand-card border border-brand-border">
            {submitted ? (
              <div className="text-center py-12 space-y-3">
                <div className="w-12 h-12 rounded-full bg-forest-50 text-brand-success mx-auto flex items-center justify-center border border-brand-success/40">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-brand-heading">Message Received</h3>
                <p className="text-xs text-brand-textMuted max-w-sm mx-auto">
                  Thank you for reaching out. A laboratory specialist will reply to <strong>{formData.email}</strong> shortly.
                </p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="mt-4 px-4 py-2 bg-brand-dark border border-brand-border rounded-xl text-xs font-semibold text-brand-body"
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h3 className="font-bold text-brand-heading text-base mb-4">Send a Laboratory Inquiry</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-brand-textMuted block mb-1">Your Name *</label>
                    <input
                      type="text"
                      autoComplete="name"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      aria-invalid={Boolean(fieldErrors.name)}
                      className={`w-full bg-brand-dark border border-brand-border rounded-xl px-3 py-2 text-xs text-brand-heading focus:outline-none focus:border-brand-accent ${fieldErrors.name ? 'border-action' : ''}`}
                    />
                    {fieldErrors.name && <p role="alert" className="mt-1 text-xs text-action">{fieldErrors.name}</p>}
                  </div>
                  <div>
                    <label className="text-xs text-brand-textMuted block mb-1">Email Address *</label>
                    <input
                      type="email"
                      autoComplete="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      aria-invalid={Boolean(fieldErrors.email)}
                      className={`w-full bg-brand-dark border border-brand-border rounded-xl px-3 py-2 text-xs text-brand-heading focus:outline-none focus:border-brand-accent ${fieldErrors.email ? 'border-action' : ''}`}
                    />
                    {fieldErrors.email && <p role="alert" className="mt-1 text-xs text-action">{fieldErrors.email}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-brand-textMuted block mb-1">Subject / Inquiry Type</label>
                    <select
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full bg-brand-dark border border-brand-border rounded-xl px-3 py-2 text-xs text-brand-heading focus:outline-none focus:border-brand-accent"
                    >
                      <option value="General Inquiry">General Product Inquiry</option>
                      <option value="COA Request">COA / Purity Test Request</option>
                      <option value="Order Support">Order Tracking / Support</option>
                      <option value="Institutional Wholesale">Institutional Wholesale</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-brand-textMuted block mb-1">Order # (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. USP-123456"
                      value={formData.orderNumber}
                      onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                      className="w-full bg-brand-dark border border-brand-border rounded-xl px-3 py-2 text-xs text-brand-heading focus:outline-none focus:border-brand-accent"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-brand-textMuted block mb-1">Message Details *</label>
                  <textarea
                    rows={5}
                    required
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Provide details regarding your research compounds, testing questions, or order..."
                    aria-invalid={Boolean(fieldErrors.message)}
                    className={`w-full bg-brand-dark border border-brand-border rounded-xl p-3 text-xs text-brand-heading focus:outline-none focus:border-brand-accent ${fieldErrors.message ? 'border-action' : ''}`}
                  />
                  {fieldErrors.message && <p role="alert" className="mt-1 text-xs text-action">{fieldErrors.message}</p>}
                </div>

                {sendError && <p className="border border-action/50 p-3 text-xs text-brand-body">{sendError}</p>}
                <button
                  type="submit"
                  disabled={sending}
                  className="w-full py-3.5 px-6 rounded-xl bg-brand-accent hover:bg-brand-accentHover text-brand-onAccent font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.12em] transition-colors flex items-center justify-center gap-2"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>Send Message to Laboratory Team</span>
                </button>
              </form>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
