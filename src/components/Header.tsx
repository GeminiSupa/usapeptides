'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Search, 
  ShoppingBag, 
  Heart, 
  Menu, 
  X, 
  ChevronDown, 
  ShieldCheck, 
  Truck, 
  FileText, 
  FlaskConical,
  User,
  Calculator
} from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { categories } from '@/data/categories';

interface HeaderProps {
  onOpenSearch: () => void;
}

export default function Header({ onOpenSearch }: HeaderProps) {
  const pathname = usePathname();
  const { totalItems, setIsCartOpen, subtotal } = useCart();
  const { wishlist } = useWishlist();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setCategoryDropdownOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-brand-darker via-brand-dark to-brand-darker border-b border-brand-border text-xs py-2 px-4 text-brand-textMuted">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2 text-center md:text-left">
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <span className="flex items-center gap-1.5 text-brand-cyan">
              <Truck className="w-3.5 h-3.5" />
              <span>FREE US Tracked Shipping on Orders $100+</span>
            </span>
            <span className="hidden sm:inline text-brand-border">•</span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>HPLC Tested &gt;99% Purity Verified</span>
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-gray-400">Laboratory In-Vitro Research Use Only</span>
            <Link href="/contact-us" className="text-brand-accentGlow hover:underline hidden lg:inline">
              info@battlebornresearch.com
            </Link>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header className={`sticky top-0 z-40 transition-all duration-200 ${
        isScrolled 
          ? 'bg-brand-darker/95 backdrop-blur-md shadow-xl shadow-black/40 border-b border-brand-border' 
          : 'bg-brand-darker border-b border-brand-border'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20 gap-4">
            
            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-gray-300 hover:text-white rounded-lg hover:bg-brand-card focus:outline-none"
              aria-label="Toggle Navigation"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 flex-shrink-0 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-accent to-blue-700 flex items-center justify-center shadow-lg shadow-brand-accent/20 group-hover:scale-105 transition-transform border border-cyan-400/30">
                <FlaskConical className="w-6 h-6 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-extrabold tracking-wider text-white font-sans flex items-center gap-1">
                  BATTLE BORN <span className="text-cyan-400">PEPTIDES</span>
                </span>
                <span className="text-[10px] tracking-widest text-brand-textMuted uppercase font-medium">
                  HPLC TESTED • USA RESEARCH
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-1 xl:gap-2 text-sm font-medium">
              <Link 
                href="/shop" 
                className={`px-3 py-2 rounded-lg transition-colors ${
                  pathname === '/shop' ? 'text-cyan-400 bg-brand-card' : 'text-gray-200 hover:text-white hover:bg-brand-card/60'
                }`}
              >
                All Peptides
              </Link>

              {/* Category Dropdown */}
              <div className="relative" onMouseLeave={() => setCategoryDropdownOpen(false)}>
                <button
                  onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                  onMouseEnter={() => setCategoryDropdownOpen(true)}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg text-gray-200 hover:text-white hover:bg-brand-card/60 transition-colors"
                >
                  <span>Categories</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${categoryDropdownOpen ? 'rotate-180 text-cyan-400' : ''}`} />
                </button>

                {categoryDropdownOpen && (
                  <div 
                    onMouseEnter={() => setCategoryDropdownOpen(true)}
                    className="absolute top-full left-0 w-80 bg-brand-card border border-brand-border rounded-xl shadow-2xl shadow-black/80 py-2 z-50 animate-fadeIn backdrop-blur-xl"
                  >
                    <div className="px-4 py-2 border-b border-brand-border/60 text-xs font-semibold text-brand-textMuted uppercase tracking-wider">
                      Peptide Pathways
                    </div>
                    <div className="max-h-96 overflow-y-auto py-1">
                      {categories.map((cat) => (
                        <Link
                          key={cat.id}
                          href={`/category/${cat.slug}`}
                          className="flex items-center justify-between px-4 py-2.5 text-xs text-gray-300 hover:text-white hover:bg-brand-cardHover transition-colors group"
                        >
                          <span className="font-medium group-hover:text-cyan-400 transition-colors">{cat.name}</span>
                          <span className="text-[10px] bg-brand-dark/80 px-2 py-0.5 rounded text-gray-400 border border-brand-border/40">
                            {cat.count}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Link 
                href="/calculator" 
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${
                  pathname === '/calculator' ? 'text-cyan-400 bg-brand-card' : 'text-gray-200 hover:text-white hover:bg-brand-card/60'
                }`}
              >
                <Calculator className="w-4 h-4 text-brand-cyan" />
                <span>Reconstitution Calc</span>
              </Link>

              <Link 
                href="/blog" 
                className={`px-3 py-2 rounded-lg transition-colors ${
                  pathname.startsWith('/blog') ? 'text-cyan-400 bg-brand-card' : 'text-gray-200 hover:text-white hover:bg-brand-card/60'
                }`}
              >
                Research & COA
              </Link>

              <Link 
                href="/about-us" 
                className={`px-3 py-2 rounded-lg transition-colors ${
                  pathname === '/about-us' ? 'text-cyan-400 bg-brand-card' : 'text-gray-200 hover:text-white hover:bg-brand-card/60'
                }`}
              >
                About
              </Link>

              <Link 
                href="/faq" 
                className={`px-3 py-2 rounded-lg transition-colors ${
                  pathname === '/faq' ? 'text-cyan-400 bg-brand-card' : 'text-gray-200 hover:text-white hover:bg-brand-card/60'
                }`}
              >
                FAQ
              </Link>

              <Link 
                href="/contact-us" 
                className={`px-3 py-2 rounded-lg transition-colors ${
                  pathname === '/contact-us' ? 'text-cyan-400 bg-brand-card' : 'text-gray-200 hover:text-white hover:bg-brand-card/60'
                }`}
              >
                Contact
              </Link>
            </nav>

            {/* Right Action Icons */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Search trigger button */}
              <button
                onClick={onOpenSearch}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-card border border-brand-border text-brand-textMuted hover:text-white hover:border-brand-accent/50 transition-all text-xs"
                aria-label="Search peptides"
              >
                <Search className="w-4 h-4 text-cyan-400" />
                <span className="hidden md:inline">Search compounds...</span>
                <kbd className="hidden lg:inline bg-brand-dark px-1.5 py-0.5 rounded text-[10px] text-gray-400 border border-brand-border">
                  ⌘K
                </kbd>
              </button>

              {/* Wishlist */}
              <Link
                href="/wishlist"
                className="relative p-2.5 rounded-xl bg-brand-card border border-brand-border text-gray-300 hover:text-rose-400 hover:border-rose-500/40 transition-colors"
                title="View Wishlist"
              >
                <Heart className="w-4 h-4" />
                {wishlist.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                    {wishlist.length}
                  </span>
                )}
              </Link>

              {/* Account */}
              <Link
                href="/my-account"
                className="p-2.5 rounded-xl bg-brand-card border border-brand-border text-gray-300 hover:text-cyan-400 hover:border-cyan-500/40 transition-colors hidden sm:flex"
                title="Laboratory Portal"
              >
                <User className="w-4 h-4" />
              </Link>

              {/* Cart Button */}
              <button
                onClick={() => setIsCartOpen(true)}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-accent to-blue-600 hover:from-blue-500 hover:to-brand-accent text-white font-semibold text-xs shadow-lg shadow-brand-accent/25 transition-all hover:scale-105 active:scale-95 border border-cyan-300/30"
                aria-label="View shopping cart"
              >
                <div className="relative">
                  <ShoppingBag className="w-4 h-4" />
                  {totalItems > 0 && (
                    <span className="absolute -top-2 -right-2 bg-emerald-500 text-brand-darker font-black text-[10px] w-4 h-4 rounded-full flex items-center justify-center border-2 border-brand-darker">
                      {totalItems}
                    </span>
                  )}
                </div>
                <span className="hidden sm:inline">${subtotal.toFixed(2)}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-brand-card border-b border-brand-border px-4 py-6 space-y-4 animate-fadeIn">
            <div className="space-y-1">
              <Link
                href="/shop"
                className="block px-3 py-2.5 rounded-lg text-sm font-medium text-white hover:bg-brand-cardHover"
              >
                All Research Peptides
              </Link>
              <Link
                href="/calculator"
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-cyan-400 hover:bg-brand-cardHover"
              >
                <Calculator className="w-4 h-4" />
                <span>Reconstitution Calculator</span>
              </Link>
              <Link
                href="/blog"
                className="block px-3 py-2.5 rounded-lg text-sm font-medium text-white hover:bg-brand-cardHover"
              >
                Research & COA Reports
              </Link>
              <Link
                href="/about-us"
                className="block px-3 py-2.5 rounded-lg text-sm font-medium text-white hover:bg-brand-cardHover"
              >
                About Battle Born
              </Link>
              <Link
                href="/faq"
                className="block px-3 py-2.5 rounded-lg text-sm font-medium text-white hover:bg-brand-cardHover"
              >
                FAQ & Shipping
              </Link>
              <Link
                href="/contact-us"
                className="block px-3 py-2.5 rounded-lg text-sm font-medium text-white hover:bg-brand-cardHover"
              >
                Contact & Support
              </Link>
              <Link
                href="/my-account"
                className="block px-3 py-2.5 rounded-lg text-sm font-medium text-white hover:bg-brand-cardHover"
              >
                Researcher Account Portal
              </Link>
            </div>

            <div className="pt-4 border-t border-brand-border">
              <div className="text-xs font-semibold text-brand-textMuted uppercase tracking-wider mb-2">
                Browse By Category
              </div>
              <div className="grid grid-cols-1 gap-1">
                {categories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/category/${cat.slug}`}
                    className="flex items-center justify-between py-2 px-3 rounded-lg text-xs text-gray-300 hover:text-cyan-400 hover:bg-brand-dark/50"
                  >
                    <span>{cat.name}</span>
                    <span className="text-[10px] text-gray-500 font-mono">{cat.count}</span>
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
