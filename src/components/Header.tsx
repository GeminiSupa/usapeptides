'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Search,
  ShoppingBag,
  Heart,
  Menu,
  X,
  ChevronDown,
  User,
  Calculator,
} from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { categories } from '@/data/categories';

interface HeaderProps {
  onOpenSearch: () => void;
}

const NAV = [
  { href: '/shop', label: 'Shop' },
  { href: '/coa-database', label: 'COA Database' },
  { href: '/blog', label: 'Research' },
  { href: '/about-us', label: 'About' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact-us', label: 'Contact' },
  { href: '/my-account', label: 'Account' },
];

export default function Header({ onOpenSearch }: HeaderProps) {
  const pathname = usePathname();
  const { totalItems, setIsCartOpen, subtotal } = useCart();
  const { wishlist } = useWishlist();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
    setCategoryDropdownOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Utility bar */}
      <div className="border-b border-brand-border bg-brand-darker">
        <div className="shell flex flex-col items-center justify-between gap-1 py-2 text-[0.6875rem] text-brand-textMuted md:flex-row">
          <span className="tracking-wide">
            Free tracked shipping on US orders over $100
            <span className="mx-2 text-brand-borderLight">/</span>
            HPLC test results published per product
          </span>
          <span className="tracking-wide">For in-vitro research use only</span>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-brand-border bg-brand-dark/95 backdrop-blur-md">
        {/* Row 1 - brand, search, actions */}
        <div className="shell flex h-20 items-center gap-1 sm:gap-4">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-brand-body hover:text-brand-heading lg:hidden"
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <Link href="/" className="flex flex-shrink-0 flex-col leading-none" aria-label="USA Peptide Depot home">
            <Image
              src="/logo.png"
              alt="USA Peptide Depot"
              width={622}
              height={205}
              priority
              className="h-auto w-[11.5rem] sm:w-[14rem]"
            />
          </Link>

          {/* Search with a category scope, as on the reference header */}
          <div className="ml-auto hidden min-w-0 max-w-xl flex-1 items-stretch border border-brand-border md:flex">
            <button
              onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
              className="flex flex-shrink-0 items-center gap-1.5 border-r border-brand-border bg-brand-card px-3 text-[0.6875rem] font-semibold text-brand-body hover:text-brand-heading"
            >
              <span>All categories</span>
              <ChevronDown className="h-3 w-3" />
            </button>
            <button
              onClick={onOpenSearch}
              className="flex min-w-0 flex-1 items-center justify-between gap-2 bg-transparent px-3 py-2.5 text-left text-xs text-brand-textMuted hover:text-brand-body"
            >
              <span className="truncate">Search research peptides...</span>
              <Search className="h-4 w-4 flex-shrink-0 text-brand-accentGlow" />
            </button>
          </div>

          <div className="ml-auto flex items-center gap-1 md:ml-0">
            <button
              onClick={onOpenSearch}
              className="p-2.5 text-brand-body hover:text-brand-heading md:hidden"
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </button>

            <Link
              href="/wishlist"
              className="relative p-2.5 text-brand-body hover:text-brand-accentGlow"
              title="Wishlist"
            >
              <Heart className="h-5 w-5" />
              {wishlist.length > 0 && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center bg-brand-accent text-[0.5625rem] font-bold text-white">
                  {wishlist.length}
                </span>
              )}
            </Link>

            <Link
              href="/my-account"
              className="hidden p-2.5 text-brand-body hover:text-brand-accentGlow sm:block"
              title="Account"
            >
              <User className="h-5 w-5" />
            </Link>

            <button
              onClick={() => setIsCartOpen(true)}
              className="relative ml-1 flex items-center gap-2 bg-brand-accent px-3.5 py-2.5 font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.1em] text-white transition-colors hover:bg-flag-red"
              aria-label="View cart"
            >
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">${subtotal.toFixed(2)}</span>
              {totalItems > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center bg-white px-1 text-[0.5625rem] font-black text-brand-accent">
                  {totalItems}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Row 2 - primary navigation */}
        <nav className="hidden border-t border-brand-border lg:block">
          <div className="shell flex items-center gap-1">
            <div className="relative" onMouseLeave={() => setCategoryDropdownOpen(false)}>
              <button
                onMouseEnter={() => setCategoryDropdownOpen(true)}
                onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                className="flex items-center gap-1.5 px-4 py-3 font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.12em] text-brand-heading hover:text-brand-accentGlow"
              >
                <span>All Research Peptides</span>
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${categoryDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {categoryDropdownOpen && (
                <div
                  onMouseEnter={() => setCategoryDropdownOpen(true)}
                  className="animate-fadeIn absolute left-0 top-full z-50 w-[22rem] border border-brand-border bg-brand-card"
                >
                  {categories.map((cat) => (
                    <Link
                      key={cat.id}
                      href={`/category/${cat.slug}`}
                      className="flex items-center justify-between border-b border-brand-border/60 px-4 py-2.5 text-xs text-brand-body transition-colors last:border-b-0 hover:bg-brand-cardHover hover:text-brand-accentGlow"
                    >
                      <span>{cat.name}</span>
                      <span className="text-[0.625rem] text-brand-textMuted">{cat.count}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {NAV.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-3 font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.12em] transition-colors ${
                    active ? 'text-brand-accentGlow' : 'text-brand-heading hover:text-brand-accentGlow'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}

            <Link
              href="/calculator"
              className="flex items-center gap-1.5 px-4 py-3 font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.12em] text-brand-heading hover:text-brand-accentGlow"
            >
              <Calculator className="h-3.5 w-3.5" />
              <span>Calculator</span>
            </Link>

            <Link
              href="/affiliates"
              className="ml-auto px-4 py-3 font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.12em] text-brand-textMuted hover:text-brand-accentGlow"
            >
              Affiliate Portal
            </Link>
          </div>
        </nav>

        {/* Mobile drawer */}
        {mobileMenuOpen && (
          <div className="animate-fadeIn border-t border-brand-border bg-brand-card px-4 py-5 lg:hidden">
            <div className="flex flex-col">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="border-b border-brand-border/60 py-3 font-display text-xs font-extrabold uppercase tracking-[0.12em] text-brand-heading"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/calculator"
                className="border-b border-brand-border/60 py-3 font-display text-xs font-extrabold uppercase tracking-[0.12em] text-brand-heading"
              >
                Reconstitution Calculator
              </Link>
              <Link
                href="/affiliates"
                className="py-3 font-display text-xs font-extrabold uppercase tracking-[0.12em] text-brand-heading"
              >
                Affiliate Portal
              </Link>
            </div>

            <div className="mt-5 border-t border-brand-border pt-4">
              <div className="eyebrow mb-3 text-brand-textMuted">Browse by category</div>
              <div className="flex flex-col">
                {categories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/category/${cat.slug}`}
                    className="flex items-center justify-between py-2 text-xs text-brand-body hover:text-brand-accentGlow"
                  >
                    <span>{cat.name}</span>
                    <span className="text-[0.625rem] text-brand-textMuted">{cat.count}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
