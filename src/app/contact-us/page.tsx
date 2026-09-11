'use client';

import React, { useState } from 'react';
import { Mail, Phone, MapPin, Clock, Send, ShieldCheck } from 'lucide-react';

export default function ContactUsPage() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: 'General Inquiry',
    orderNumber: '',
    message: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      
      <div className="border-b border-brand-border pb-6">
        <div className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-1">
          Direct Laboratory Communication
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
          Contact Battle Born Peptides
        </h1>
        <p className="text-xs sm:text-sm text-gray-400 mt-2 max-w-2xl">
          For technical HPLC inquiries, bulk institutional orders, or shipping assistance, our laboratory team responds within 24 business hours.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Contact Info Sidebar */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 rounded-2xl bg-brand-card border border-brand-border space-y-6 shadow-xl">
            <h3 className="font-bold text-white text-base">Laboratory Support Details</h3>
            
            <div className="space-y-4 text-xs text-gray-300">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-gray-500 text-[10px] uppercase block">Email Address</span>
                  <a href="mailto:info@battlebornresearch.com" className="text-white hover:text-cyan-400 font-semibold">
                    info@battlebornresearch.com
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-gray-500 text-[10px] uppercase block">Operations &amp; Fulfillment</span>
                  <span className="text-white">United States Logistics &amp; Climate Storage Facility</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-gray-500 text-[10px] uppercase block">Hours of Operation</span>
                  <span className="text-white">Monday – Friday: 8:00 AM – 6:00 PM EST</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-brand-border text-[11px] text-gray-400">
              <strong className="text-amber-400 block mb-1">Compliance Policy:</strong>
              We do not answer questions relating to human administration or medical advice. Inquiries must pertain to laboratory chemistry, in-vitro protocols, or orders.
            </div>
          </div>
        </div>

        {/* Contact Form */}
        <div className="lg:col-span-7">
          <div className="p-6 sm:p-8 rounded-2xl bg-brand-card border border-brand-border shadow-xl">
            {submitted ? (
              <div className="text-center py-12 space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-950 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/40">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white">Message Received</h3>
                <p className="text-xs text-gray-400 max-w-sm mx-auto">
                  Thank you for reaching out. A laboratory specialist will reply to <strong>{formData.email}</strong> shortly.
                </p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="mt-4 px-4 py-2 bg-brand-dark border border-brand-border rounded-xl text-xs font-semibold text-gray-300"
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h3 className="font-bold text-white text-base mb-4">Send a Laboratory Inquiry</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Your Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-brand-dark border border-brand-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-brand-dark border border-brand-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Subject / Inquiry Type</label>
                    <select
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full bg-brand-dark border border-brand-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                    >
                      <option value="General Inquiry">General Product Inquiry</option>
                      <option value="COA Request">COA / Purity Test Request</option>
                      <option value="Order Support">Order Tracking / Support</option>
                      <option value="Institutional Wholesale">Institutional Wholesale</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Order # (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. BBP-123456"
                      value={formData.orderNumber}
                      onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                      className="w-full bg-brand-dark border border-brand-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">Message Details *</label>
                  <textarea
                    rows={5}
                    required
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Provide details regarding your research compounds, testing questions, or order..."
                    className="w-full bg-brand-dark border border-brand-border rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 px-6 rounded-xl bg-brand-accent hover:bg-blue-600 text-white font-bold text-xs shadow-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
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
