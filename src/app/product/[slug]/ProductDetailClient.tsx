'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { useCatalogue } from '@/hooks/useCatalogue';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import BulkPricingTable from '@/components/BulkPricingTable';
import ProductCard from '@/components/ProductCard';
import WhatsAppOrderButton from '@/components/WhatsAppOrderButton';
import {
  FileText,
  Heart,
  Minus,
  Plus,
  Check,
  ChevronRight,
  Calculator,
  ShieldCheck,
  Truck,
  Lock,
} from 'lucide-react';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'specs', label: 'Specifications' },
  { id: 'coa', label: 'Test report' },
  { id: 'reconstitution', label: 'Handling' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function ProductDetailClient({ slug }: { slug: string }) {
  const { addToCart, setSelectedCOAProduct } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { products, loading } = useCatalogue();

  // Every hook runs before the two exits below, so the set of hooks is the
  // same on the loading render and the loaded one.
  const [quantity, setQuantity] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [added, setAdded] = useState<boolean>(false);

  const product = products.find((p) => p.slug === slug);

  // A product added in the dashboard is not in the bundled catalogue, so
  // "not found" has to wait until the live one has actually been fetched -
  // otherwise a brand new product 404s for a moment before appearing.
  if (!product && loading) {
    return (
      <div className="shell py-32 text-center text-xs text-brand-textMuted">
        Loading product...
      </div>
    );
  }

  if (!product) {
    notFound();
  }

  const isFavorited = isInWishlist(product.id);

  // Volume tiers mirror the bulk pricing table.
  let discountPercent = 0;
  if (quantity >= 10) discountPercent = 20;
  else if (quantity >= 5) discountPercent = 15;
  else if (quantity >= 3) discountPercent = 10;

  const unitPrice = Number((product.price * (1 - discountPercent / 100)).toFixed(2));
  const totalPrice = Number((unitPrice * quantity).toFixed(2));

  const handleAddToCart = () => {
    addToCart(product, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  const relatedProducts = products
    .filter((p) => p.categorySlug === product.categorySlug && p.id !== product.id)
    .slice(0, 4);

  return (
    <div className="shell space-y-14 py-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-[0.6875rem] uppercase tracking-[0.1em] text-brand-textMuted">
        <Link href="/" className="hover:text-brand-accentGlow">Home</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/shop" className="hover:text-brand-accentGlow">Shop</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href={`/category/${product.categorySlug}`} className="truncate hover:text-brand-accentGlow">
          {product.category}
        </Link>
      </nav>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        {/* Image */}
        <div className="space-y-4 lg:col-span-6">
          <div className="relative flex aspect-square items-center justify-center border border-brand-border bg-brand-card p-8">
            <img
              src={product.image}
              alt={product.name}
              className="relative z-10 h-4/5 w-4/5 object-contain"
            />

            <div className="absolute left-4 top-4 z-20 flex flex-col items-start gap-2">
              <span className="bg-brand-accent px-2.5 py-1 font-display text-[0.625rem] font-black uppercase tracking-[0.1em] text-brand-onAccent">
                {product.purity} HPLC
              </span>
              <span className="border border-brand-border bg-brand-dark px-2.5 py-1 font-mono text-[0.625rem] text-brand-body">
                Lot {product.coa.lotNumber}
              </span>
            </div>

            <button
              onClick={() => toggleWishlist(product)}
              aria-label={isFavorited ? 'Remove from wishlist' : 'Add to wishlist'}
              className={`absolute right-4 top-4 z-20 border p-2.5 transition-colors ${
                isFavorited
                  ? 'border-brand-accent bg-brand-accent text-brand-onAccent'
                  : 'border-brand-border bg-brand-dark text-brand-textMuted hover:text-brand-heading'
              }`}
            >
              <Heart className={`h-4 w-4 ${isFavorited ? 'fill-current' : ''}`} />
            </button>
          </div>

          {/* Assurance strip */}
          <div className="grid grid-cols-3 divide-x divide-brand-border border border-brand-border">
            {[
              { icon: ShieldCheck, t: 'Independently tested', s: 'HPLC + ESI-MS' },
              { icon: Truck, t: 'Ships from the USA', s: 'Tracked delivery' },
              { icon: Lock, t: 'Sealed under argon', s: 'Type I borosilicate' },
            ].map(({ icon: Icon, t, s }) => (
              <div key={t} className="px-3 py-4 text-center">
                <Icon className="mx-auto mb-2 h-4 w-4 text-brand-accentGlow" strokeWidth={1.75} />
                <div className="font-display text-[0.6875rem] font-extrabold text-brand-heading">{t}</div>
                <div className="text-[0.625rem] text-brand-textMuted">{s}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Purchase panel */}
        <div className="space-y-6 lg:col-span-6">
          <div>
            <p className="eyebrow mb-2.5">{product.category}</p>
            <h1 className="font-display text-[1.75rem] font-extrabold leading-tight text-brand-heading">
              {product.name}
            </h1>
            <div className="mt-3 flex items-center gap-3 text-[0.6875rem] text-brand-textMuted">
              <span>
                SKU <strong className="font-mono text-brand-body">{product.sku}</strong>
              </span>
              <span>&middot;</span>
              <span className="text-brand-accentGlow">In stock &mdash; {product.stockCount} vials</span>
            </div>
          </div>

          <div className="border border-brand-border bg-brand-card">
            <div className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-[2rem] font-black leading-none text-brand-heading">
                      ${unitPrice.toFixed(2)}
                    </span>
                    {discountPercent > 0 && (
                      <span className="text-xs text-brand-textMuted line-through">
                        ${product.price.toFixed(2)}
                      </span>
                    )}
                    <span className="text-[0.6875rem] text-brand-textMuted">/ vial</span>
                  </div>
                  {discountPercent > 0 && (
                    <span className="mt-1 inline-block bg-brand-accent px-2 py-0.5 font-display text-[0.625rem] font-black uppercase tracking-[0.1em] text-brand-onAccent">
                      {discountPercent}% volume discount applied
                    </span>
                  )}
                </div>

                <button
                  onClick={() => setSelectedCOAProduct(product)}
                  className="flex flex-shrink-0 items-center gap-1.5 border border-brand-borderLight px-3 py-2 font-display text-[0.625rem] font-extrabold uppercase tracking-[0.1em] text-brand-heading transition-colors hover:border-brand-accent hover:text-brand-accentGlow"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Test report</span>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                <div className="flex items-center justify-between border border-brand-border bg-brand-dark sm:col-span-4">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="p-3 text-brand-textMuted transition-colors hover:text-brand-heading"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="font-mono text-sm font-bold text-brand-heading">{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="p-3 text-brand-textMuted transition-colors hover:text-brand-heading"
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <button
                  onClick={handleAddToCart}
                  className={`flex w-full items-center justify-center gap-2 border px-6 py-3.5 font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.12em] transition-colors sm:col-span-8 ${
                    added
                      ? 'border-whatsapp bg-whatsapp text-whatsapp-ink'
                      : 'border-action bg-action text-white hover:border-action-hover hover:bg-action-hover'
                  }`}
                >
                  {added ? (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Added &mdash; {quantity} vial{quantity > 1 ? 's' : ''}</span>
                    </>
                  ) : (
                    <span>Add to cart &mdash; ${totalPrice.toFixed(2)}</span>
                  )}
                </button>
              </div>

              <WhatsAppOrderButton
                className="w-full"
                lines={[{ name: product.name, quantity, unitPrice }]}
                total={totalPrice}
              />
            </div>
          </div>

          <BulkPricingTable product={product} />

          <p className="text-xs leading-relaxed text-brand-body">{product.description}</p>

          <div className="flex items-center justify-between border border-brand-border bg-brand-card px-4 py-3">
            <div className="flex items-center gap-2.5">
              <Calculator className="h-4 w-4 text-brand-accentGlow" />
              <span className="text-xs text-brand-body">Working out diluent volume?</span>
            </div>
            <Link
              href="/calculator"
              className="flex-shrink-0 font-display text-[0.625rem] font-extrabold uppercase tracking-[0.1em] text-brand-accentGlow hover:text-brand-heading"
            >
              Open calculator
            </Link>
          </div>
        </div>
      </div>

      {/* Detail tabs */}
      <div className="space-y-6 border-t border-brand-border pt-8">
        <div className="flex gap-6 overflow-x-auto border-b border-brand-border sm:gap-8">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 border-b-2 pb-3 font-display text-[0.6875rem] font-extrabold uppercase tracking-[0.12em] transition-colors ${
                activeTab === tab.id
                  ? 'border-brand-accent text-brand-accentGlow'
                  : 'border-transparent text-brand-textMuted hover:text-brand-heading'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="border border-brand-border bg-brand-card p-6 text-xs leading-relaxed text-brand-body">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <p>{product.description}</p>
              <ul className="space-y-2">
                {product.details.map((det, i) => (
                  <li key={i} className="flex gap-2.5">
                    <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-brand-accentGlow" />
                    <span className="text-brand-textMuted">{det}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {activeTab === 'specs' && (
            <dl className="divide-y divide-brand-border border-y border-brand-border">
              {[
                product.sequence && ['Amino acid sequence', product.sequence, true],
                product.casNumber && ['CAS number', product.casNumber, false],
                product.molarMass && ['Molar mass', product.molarMass, false],
                product.formula && ['Molecular formula', product.formula, false],
                ['Storage', product.storage, false],
                ['Appearance', product.appearance, false],
              ]
                .filter(Boolean)
                .map((row) => {
                  const [label, value, wide] = row as [string, string, boolean];
                  return (
                    <div
                      key={label}
                      className={`gap-3 py-3 ${wide ? '' : 'flex items-baseline justify-between'}`}
                    >
                      <dt className="text-[0.625rem] uppercase tracking-[0.1em] text-brand-textMuted">
                        {label}
                      </dt>
                      <dd
                        className={`font-mono text-[0.6875rem] text-brand-heading ${
                          wide ? 'mt-1.5 break-all' : 'text-right'
                        }`}
                      >
                        {value}
                      </dd>
                    </div>
                  );
                })}
            </dl>
          )}

          {activeTab === 'coa' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-display text-[0.8125rem] font-extrabold uppercase tracking-[0.08em] text-brand-heading">
                  Independent analysis
                </h3>
                <div className="flex flex-wrap gap-2">
                  {product.coaUrl && (
                    <a
                      href={product.coaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 bg-action px-3 py-1.5 font-display text-[0.625rem] font-extrabold uppercase tracking-[0.1em] text-white transition-colors hover:bg-action-hover"
                    >
                      <FileText className="h-3 w-3" />
                      Download certificate
                    </a>
                  )}
                  <button
                    onClick={() => setSelectedCOAProduct(product)}
                    className="bg-brand-accent px-3 py-1.5 font-display text-[0.625rem] font-extrabold uppercase tracking-[0.1em] text-brand-onAccent transition-colors hover:bg-brand-accentHover"
                  >
                    Open full report
                  </button>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-px border border-brand-border bg-brand-border sm:grid-cols-4">
                {[
                  ['Lot', product.coa.lotNumber],
                  ['Tested', product.coa.testDate],
                  ['Purity', product.coa.purity],
                  ['Laboratory', product.coa.lab],
                ].map(([k, v]) => (
                  <div key={k} className="bg-brand-dark p-3">
                    <dt className="text-[0.625rem] uppercase tracking-[0.1em] text-brand-textMuted">{k}</dt>
                    <dd className="mt-1 font-mono text-[0.6875rem] font-bold text-brand-heading">{v}</dd>
                  </div>
                ))}
              </dl>

              <p className="text-brand-textMuted">
                Peak evaluation: <span className="text-brand-body">{product.coa.chromatogramPeak}</span>.
                Analysis by reverse-phase HPLC with UV detection at 214nm, paired with electrospray
                ionization mass spectrometry.
              </p>
            </div>
          )}

          {activeTab === 'reconstitution' && (
            <ol className="space-y-3">
              {[
                ['Solvent', 'Reconstitute with sterile bacteriostatic water (0.9% benzyl alcohol).'],
                ['Dissolution', 'Run the stream down the inner vial wall and swirl gently. Do not shake.'],
                ['Storage', 'Lyophilized vials keep at -20°C. Once in solution, hold at 2–8°C and use within 30 days.'],
              ].map(([label, body], i) => (
                <li key={label} className="flex gap-3">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center bg-brand-accent font-display text-[0.625rem] font-black text-brand-onAccent">
                    {i + 1}
                  </span>
                  <span>
                    <strong className="text-brand-heading">{label}.</strong>{' '}
                    <span className="text-brand-textMuted">{body}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* Related */}
      {relatedProducts.length > 0 && (
        <div className="space-y-6 border-t border-brand-border pt-10">
          <div>
            <p className="eyebrow mb-2.5">Same pathway</p>
            <h2 className="section-title">Related compounds</h2>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {relatedProducts.map((rel) => (
              <ProductCard key={rel.id} product={rel} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
