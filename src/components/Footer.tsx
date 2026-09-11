'use client';

import React from 'react';
import Link from 'next/link';
import { 
  FlaskConical, 
  ShieldCheck, 
  Truck, 
  Lock, 
  Mail, 
  ArrowRight, 
  FileCheck,
  CreditCard,
  CheckCircle2
} from 'lucide-react';
import { categories } from '@/data/categories';

export default function Footer() {
  return (
    <footer className="bg-brand-darker border-t border-brand-border text-gray-400 text-sm mt-20">
      {/* Top Value Badges */}
      <div className="border-b border-brand-border/60 bg-brand-dark/40 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-6 text-center md:text-left">
          <div className="flex items-center gap-4 justify-center md:justify-start">
            <div className="w-12 h-12 rounded-xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400 flex-shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-white font-semibold text-sm">HPLC & Mass Spec Verified</h4>
              <p className="text-xs text-brand-textMuted">&gt;99% Analytical Purity Published</p>
            </div>
          </div>

          <div className="flex items-center gap-4 justify-center md:justify-start">
            <div className="w-12 h-12 rounded-xl bg-blue-950/60 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-white font-semibold text-sm">Fast Domestic USA Shipping</h4>
              <p className="text-xs text-brand-textMuted">Free shipping on orders over $100</p>
            </div>
          </div>

          <div className="flex items-center gap-4 justify-center md:justify-start">
            <div className="w-12 h-12 rounded-xl bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
              <FileCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-white font-semibold text-sm">Published COA Per Batch</h4>
              <p className="text-xs text-brand-textMuted">Third-party lab tested & tracked</p>
            </div>
          </div>

          <div className="flex items-center gap-4 justify-center md:justify-start">
            <div className="w-12 h-12 rounded-xl bg-purple-950/60 border border-purple-500/30 flex items-center justify-center text-purple-400 flex-shrink-0">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-white font-semibold text-sm">Secure Checkout & Privacy</h4>
              <p className="text-xs text-brand-textMuted">Encrypted payments & discreet packaging</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
        
        {/* Brand Info */}
        <div className="lg:col-span-2 space-y-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-accent flex items-center justify-center text-white border border-cyan-400/40">
              <FlaskConical className="w-5 h-5" />
            </div>
            <span className="text-xl font-extrabold tracking-wider text-white">
              BATTLE BORN <span className="text-cyan-400">PEPTIDES</span>
            </span>
          </Link>
          <p className="text-xs text-gray-400 leading-relaxed pr-4">
            Battle Born Peptides is a premier USA supplier of lyophilized research peptides and laboratory reference compounds. Dedicated to chemical purity, analytical transparency, and reliable cold-chain delivery.
          </p>

          <div className="pt-2">
            <div className="text-xs font-semibold text-white uppercase tracking-wider mb-2">
              Laboratory Newsletter
            </div>
            <form onSubmit={(e) => { e.preventDefault(); alert('Subscribed to research updates.'); }} className="flex gap-2 max-w-sm">
              <input
                type="email"
                placeholder="institution.email@lab.edu"
                required
                className="bg-brand-card border border-brand-border rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 flex-grow"
              />
              <button
                type="submit"
                className="bg-brand-accent hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <span>Join</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </form>
          </div>
        </div>

        {/* Categories */}
        <div>
          <h4 className="text-white font-semibold text-xs uppercase tracking-wider mb-4">
            Top Categories
          </h4>
          <ul className="space-y-2 text-xs">
            {categories.slice(0, 6).map((cat) => (
              <li key={cat.id}>
                <Link href={`/category/${cat.slug}`} className="hover:text-cyan-400 transition-colors">
                  {cat.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Quick Links */}
        <div>
          <h4 className="text-white font-semibold text-xs uppercase tracking-wider mb-4">
            Navigation
          </h4>
          <ul className="space-y-2 text-xs">
            <li>
              <Link href="/shop" className="hover:text-cyan-400 transition-colors">
                All Products Catalog
              </Link>
            </li>
            <li>
              <Link href="/calculator" className="hover:text-cyan-400 transition-colors text-cyan-300 font-medium">
                Reconstitution Calculator
              </Link>
            </li>
            <li>
              <Link href="/blog" className="hover:text-cyan-400 transition-colors">
                Research & HPLC Reports
              </Link>
            </li>
            <li>
              <Link href="/about-us" className="hover:text-cyan-400 transition-colors">
                About Our Standards
              </Link>
            </li>
            <li>
              <Link href="/faq" className="hover:text-cyan-400 transition-colors">
                Frequently Asked Questions
              </Link>
            </li>
            <li>
              <Link href="/contact-us" className="hover:text-cyan-400 transition-colors">
                Contact Laboratory Support
              </Link>
            </li>
            <li>
              <Link href="/affiliates" className="hover:text-cyan-400 transition-colors">
                Affiliate Research Portal
              </Link>
            </li>
          </ul>
        </div>

        {/* Compliance & Contact */}
        <div>
          <h4 className="text-white font-semibold text-xs uppercase tracking-wider mb-4">
            Laboratory Support
          </h4>
          <div className="space-y-3 text-xs text-gray-400">
            <p>
              <span className="block text-gray-500">Inquiries & Orders:</span>
              <a href="mailto:info@battlebornresearch.com" className="text-cyan-400 hover:underline">
                info@battlebornresearch.com
              </a>
            </p>
            <p>
              <span className="block text-gray-500">Shipping Origin:</span>
              <span className="text-gray-300">United States Climate Facility</span>
            </p>
            <p>
              <span className="block text-gray-500">Hours:</span>
              <span className="text-gray-300">Mon - Fri: 8:00 AM - 6:00 PM EST</span>
            </p>
          </div>
        </div>
      </div>

      {/* Mandatory Regulatory Disclaimer */}
      <div className="border-t border-brand-border bg-black/40 py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-4 text-[11px] leading-relaxed text-gray-400">
          <div className="p-4 rounded-xl bg-brand-card/80 border border-brand-border/80 space-y-2">
            <p className="font-semibold text-amber-400/90 uppercase tracking-wider">
              Mandatory Legal & Research Compliance Disclaimer:
            </p>
            <p>
              All products listed and sold on battlebornresearch.com are intended strictly for in-vitro laboratory research and scientific experimentation by qualified institutions, academic universities, and licensed laboratory personnel. None of these compounds are intended for human consumption, clinical diagnostic application, or veterinary medicine. They are not approved by the FDA or international health authorities.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 text-xs">
            <p className="text-gray-500">
              &copy; {new Date().getFullYear()} Battle Born Peptides. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-gray-400">
              <span>Terms of Research Supply</span>
              <span>Privacy Policy</span>
              <span>HPLC Quality Guarantee</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
