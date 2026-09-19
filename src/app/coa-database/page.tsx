'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, FileText, X } from 'lucide-react';
import { useCatalogue } from '@/hooks/useCatalogue';
import { useCategories } from '@/hooks/useCategories';
import { useCart } from '@/context/CartContext';

/**
 * Searchable index of every published test report, keyed by lot number.
 *
 * A researcher usually arrives holding a vial and wants the report that
 * matches the lot printed on it, so lot number is a first-class search term
 * alongside compound name and CAS number.
 */
export default function CoaDatabasePage() {
  const categories = useCategories();
  const { setSelectedCOAProduct } = useCart();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');

  const { products } = useCatalogue();

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => (category === 'all' ? true : p.categorySlugs?.includes(category) || p.categorySlug === category))
      .filter((p) => {
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.coa.lotNumber.toLowerCase().includes(q) ||
          (p.casNumber ?? '').toLowerCase().includes(q) ||
          p.coa.lab.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, query, category]);

  return (
    <div className="shell space-y-8 py-10">
      <div className="border-b border-brand-border pb-6">
        <p className="eyebrow mb-2.5">Published analysis</p>
        <h1 className="page-title">COA Database</h1>
        <p className="mt-3 max-w-2xl text-xs leading-relaxed text-brand-textMuted sm:text-sm">
          Every lot we have released, with the independent chromatography filed against it. Search by
          compound, lot number, CAS number or laboratory.
        </p>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-textMuted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Lot number, compound, CAS, laboratory..."
            className="w-full border border-brand-border bg-brand-card py-3 pl-10 pr-10 text-xs text-brand-heading placeholder-brand-textMuted focus:border-brand-accent focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-textMuted hover:text-brand-heading"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="border border-brand-border bg-brand-card px-3 py-3 text-xs text-brand-heading focus:border-brand-accent focus:outline-none sm:w-72"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <p className="text-[0.6875rem] uppercase tracking-[0.12em] text-brand-textMuted">
        Showing <span className="text-brand-heading">{rows.length}</span> of {products.length} reports
      </p>

      {/* Results */}
      {rows.length === 0 ? (
        <div className="border border-brand-border bg-brand-card p-12 text-center">
          <FileText className="mx-auto h-6 w-6 text-brand-textMuted" />
          <p className="mt-4 font-display text-sm font-extrabold text-brand-heading">
            No reports match that search
          </p>
          <p className="mt-1 text-xs text-brand-textMuted">
            Try the lot number exactly as printed on the vial.
          </p>
        </div>
      ) : (
        <>
        {/* Phones: one card per lot instead of a table wider than the screen. */}
        <ul className="space-y-2 md:hidden">
          {rows.map((p) => (
            <li key={p.id} className="border border-brand-border bg-brand-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/product/${p.slug}`}
                    className="font-display text-xs font-extrabold text-brand-heading hover:text-brand-accentGlow"
                  >
                    {p.name}
                  </Link>
                  <span className="mt-0.5 block text-[0.625rem] text-brand-textMuted">{p.category}</span>
                </div>
                <span className="flex-none bg-brand-accent px-2 py-0.5 font-display text-[0.625rem] font-black text-brand-onAccent">
                  {p.coa.purity}
                </span>
              </div>
              <p className="mt-2 text-[0.6875rem] leading-relaxed text-brand-textMuted">
                Lot <span className="font-mono text-brand-body">{p.coa.lotNumber}</span> · {p.coa.method} ·{' '}
                {p.coa.lab} · <span className="font-mono">{p.coa.testDate}</span>
              </p>
              <button
                onClick={() => setSelectedCOAProduct(p)}
                className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-1.5 border border-brand-borderLight px-3 font-display text-[0.625rem] font-extrabold uppercase tracking-[0.1em] text-brand-heading transition-colors hover:border-brand-accent hover:text-brand-accentGlow"
              >
                <FileText className="h-3 w-3" />
                View report
              </button>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto border border-brand-border md:block">
          <table className="w-full min-w-[52rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-brand-border bg-brand-card">
                {['Compound', 'Lot', 'Purity', 'Method', 'Laboratory', 'Tested', ''].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 font-display text-[0.625rem] font-extrabold uppercase tracking-[0.12em] text-brand-textMuted"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-brand-border/60 transition-colors last:border-b-0 hover:bg-brand-card"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/product/${p.slug}`}
                      className="font-display text-xs font-extrabold text-brand-heading hover:text-brand-accentGlow"
                    >
                      {p.name}
                    </Link>
                    <span className="mt-0.5 block text-[0.625rem] text-brand-textMuted">
                      {p.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[0.6875rem] text-brand-body">
                    {p.coa.lotNumber}
                  </td>
                  <td className="px-4 py-3">
                    <span className="bg-brand-accent px-2 py-0.5 font-display text-[0.625rem] font-black text-brand-onAccent">
                      {p.coa.purity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[0.6875rem] text-brand-textMuted">{p.coa.method}</td>
                  <td className="px-4 py-3 text-[0.6875rem] text-brand-textMuted">{p.coa.lab}</td>
                  <td className="px-4 py-3 font-mono text-[0.6875rem] text-brand-textMuted">
                    {p.coa.testDate}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setSelectedCOAProduct(p)}
                      className="inline-flex items-center gap-1.5 border border-brand-borderLight px-3 py-1.5 font-display text-[0.625rem] font-extrabold uppercase tracking-[0.1em] text-brand-heading transition-colors hover:border-brand-accent hover:text-brand-accentGlow"
                    >
                      <FileText className="h-3 w-3" />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      <p className="text-[0.6875rem] leading-relaxed text-brand-textMuted">
        Reports are published per lot. If the lot on your vial is not listed here, contact us with the
        number printed on the label and we will send the matching analysis.
      </p>
    </div>
  );
}
