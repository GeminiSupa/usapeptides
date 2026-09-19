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
  ShieldCheck,
} from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useCategories } from '@/hooks/useCategories';

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
  const categories = useCategories();
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
      <header className="theme-forest sticky top-0 z-40 border-b border-brand-border bg-brand-dark/95 backdrop-blur-md">
        {/* Row 1 - brand, search, actions */}
        <div className="shell flex h-16 items-center gap-0 sm:h-20 sm:gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="-ml-2 flex h-11 w-11 flex-shrink-0 items-center justify-center text-brand-body hover:text-brand-heading lg:hidden"
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
              className="h-auto w-[8.75rem] min-[380px]:w-[10rem] sm:w-[14rem]"
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

          <div className="ml-auto flex flex-shrink-0 items-center md:ml-0">
            <button
              onClick={onOpenSearch}
              className="flex h-11 w-11 items-center justify-center text-brand-body hover:text-brand-heading md:hidden"
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </button>

            <Link
              href="/wishlist"
              className="relative hidden h-11 w-10 items-center justify-center text-brand-body hover:text-brand-accentGlow sm:flex"
              title="Wishlist"
            >
              <Heart className="h-5 w-5" />
              {wishlist.length > 0 && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center bg-brand-accent text-[0.5625rem] font-bold text-brand-onAccent">
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
              className="relative ml-1 flex min-h-11 items-center gap-1.5 bg-brand-accent px-3 font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.1em] text-brand-onAccent transition-colors hover:bg-brand-accentHover sm:gap-2 sm:px-3.5"
              aria-label="View cart"
            >
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">${subtotal.toFixed(2)}</span>
              {totalItems > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center bg-brand-onAccent px-1 text-[0.5625rem] font-black text-brand-accent">
                  {totalItems}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Row 2 - primary navigation */}
        <nav className="hidden border-t border-brand-border lg:block">
          <div className="shell flex items-center gap-0">
            <div className="relative" onMouseLeave={() => setCategoryDropdownOpen(false)}>
              <button
                onMouseEnter={() => setCategoryDropdownOpen(true)}
                onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                className="flex items-center gap-1.5 whitespace-nowrap px-2 py-3 font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.08em] xl:px-3 2xl:px-4 2xl:tracking-[0.12em] text-brand-heading hover:text-brand-accentGlow"
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
                  className={`whitespace-nowrap px-2 py-3 font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.08em] xl:px-3 2xl:px-4 2xl:tracking-[0.12em] transition-colors ${
                    active ? 'text-brand-accentGlow' : 'text-brand-heading hover:text-brand-accentGlow'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}

            <Link
              href="/calculator"
              className="flex items-center gap-1.5 whitespace-nowrap px-2 py-3 font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.08em] xl:px-3 2xl:px-4 2xl:tracking-[0.12em] text-brand-heading hover:text-brand-accentGlow"
            >
              <Calculator className="h-3.5 w-3.5" />
              <span>Calculator</span>
            </Link>

            <Link
              href="/affiliates"
              className="ml-auto whitespace-nowrap px-2 py-3 font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.08em] xl:px-3 2xl:px-4 2xl:tracking-[0.12em] text-brand-textMuted hover:text-brand-accentGlow"
            >
              Affiliate Portal
            </Link>
            <Link
              href="/admin/login"
              className="flex items-center gap-1.5 border-l border-brand-border whitespace-nowrap px-2 py-3 font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.08em] xl:px-3 2xl:px-4 2xl:tracking-[0.12em] text-brand-textMuted hover:text-brand-accentGlow"
              title="Secure staff sign in"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Admin login
            </Link>
          </div>
        </nav>

        {/* Mobile drawer */}
        {mobileMenuOpen && (
          <div className="max-h-[calc(100dvh-4rem)] animate-fadeIn overflow-y-auto overscroll-contain border-t border-brand-border bg-brand-card px-4 pb-8 pt-2 lg:hidden">
            <div className="flex flex-col">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex min-h-12 items-center border-b border-brand-border/60 py-3 font-display text-xs font-extrabold uppercase tracking-[0.12em] text-brand-heading"
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
              <Link
                href="/admin/login"
                className="flex min-h-12 items-center gap-2 border-t border-brand-border/60 py-3 font-display text-xs font-extrabold uppercase tracking-[0.12em] text-brand-heading"
              >
                <ShieldCheck className="h-4 w-4" /> Admin login
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
