'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { products } from '@/data/products';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import BulkPricingTable from '@/components/BulkPricingTable';
import ProductCard from '@/components/ProductCard';
import { 
  ShieldCheck, 
  Truck, 
  FileText, 
  Heart, 
  Minus, 
  Plus, 
  ShoppingBag, 
  Check, 
  FlaskConical, 
  ChevronRight, 
  Calculator,
  Lock,
  Layers,
  Activity
} from 'lucide-react';

interface ProductDetailPageProps {
  params: {
    slug: string;
  };
}

export default function ProductDetailClient({ slug }: { slug: string }) {
  const params = { slug };
  const { addToCart, setSelectedCOAProduct } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  
  const product = products.find((p) => p.slug === params.slug);

  if (!product) {
    notFound();
  }

  const [quantity, setQuantity] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'overview' | 'specs' | 'coa' | 'reconstitution'>('overview');
  const [added, setAdded] = useState<boolean>(false);

  const isFavorited = isInWishlist(product.id);

  // Calculate volume discount for the selected quantity
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <Link href="/" className="hover:text-cyan-400">Home</Link>
        <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
        <Link href="/shop" className="hover:text-cyan-400">Shop</Link>
        <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
        <Link href={`/category/${product.categorySlug}`} className="hover:text-cyan-400 truncate">
          {product.category}
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
        <span className="text-white font-medium truncate">{product.name}</span>
      </div>

      {/* Main Product Showcase Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Left: Product Image & Badges */}
        <div className="lg:col-span-6 space-y-4">
          <div className="aspect-square rounded-3xl bg-brand-card border border-brand-border p-8 flex items-center justify-center relative overflow-hidden shadow-2xl">
            {/* Background ambient glow */}
            <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/10 via-transparent to-blue-600/10" />

            <img
              src={product.image}
              alt={product.name}
              className="w-4/5 h-4/5 object-contain filter drop-shadow-[0_20px_30px_rgba(0,180,255,0.2)] relative z-10 transition-transform duration-500 hover:scale-105"
            />

            {/* Top right badges */}
            <div className="absolute top-4 left-4 flex flex-col gap-2 z-20">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/90 border border-emerald-500/50 text-emerald-400 text-xs font-bold shadow-lg">
                <ShieldCheck className="w-4 h-4" />
                <span>{product.purity} HPLC Purity</span>
              </span>
              <span className="px-3 py-1 rounded-full bg-brand-dark/90 border border-brand-border text-cyan-300 text-xs font-semibold">
                Lot: {product.coa.lotNumber}
              </span>
            </div>

            <button
              onClick={() => toggleWishlist(product)}
              className={`absolute top-4 right-4 p-3 rounded-2xl border transition-colors shadow-lg z-20 ${
                isFavorited
                  ? 'bg-rose-950/90 border-rose-500 text-rose-400'
                  : 'bg-brand-dark/80 border-brand-border text-gray-400 hover:text-white'
              }`}
            >
              <Heart className={`w-5 h-5 ${isFavorited ? 'fill-rose-400' : ''}`} />
            </button>
          </div>

          {/* Quick Value Points */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-xl bg-brand-darker border border-brand-border">
              <ShieldCheck className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
              <div className="text-[11px] font-bold text-white">Janoshik Audited</div>
              <div className="text-[9px] text-gray-500">HPLC + ESI-MS</div>
            </div>
            <div className="p-3 rounded-xl bg-brand-darker border border-brand-border">
              <Truck className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
              <div className="text-[11px] font-bold text-white">Same-Day USA</div>
              <div className="text-[9px] text-gray-500">Tracked Shipping</div>
            </div>
            <div className="p-3 rounded-xl bg-brand-darker border border-brand-border">
              <Lock className="w-4 h-4 text-blue-400 mx-auto mb-1" />
              <div className="text-[11px] font-bold text-white">Inert Sealed</div>
              <div className="text-[9px] text-gray-500">Type I Borosilicate</div>
            </div>
          </div>
        </div>

        {/* Right: Product Info & Purchasing Actions */}
        <div className="lg:col-span-6 space-y-6">
          <div className="space-y-2">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest block">
              {product.category}
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
              {product.name}
            </h1>
            <div className="flex items-center gap-3 text-xs text-gray-400 pt-1">
              <span>SKU: <strong className="text-gray-200 font-mono">{product.sku}</strong></span>
              <span>•</span>
              <span className="text-emerald-400 font-semibold">● In Stock ({product.stockCount} vials)</span>
            </div>
          </div>

          {/* Pricing & Volume Tier Dynamic Readout */}
          <div className="p-5 rounded-2xl bg-brand-card border border-brand-border space-y-3">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-black text-white">
                    ${unitPrice.toFixed(2)}
                  </span>
                  {discountPercent > 0 && (
                    <span className="text-sm text-gray-500 line-through">
                      ${product.price.toFixed(2)}
                    </span>
                  )}
                  <span className="text-xs text-gray-400">/ vial</span>
                </div>
                {discountPercent > 0 && (
                  <span className="text-xs font-bold text-emerald-400">
                    Bulk discount ({discountPercent}% OFF) applied!
                  </span>
                )}
              </div>

              <button
                onClick={() => setSelectedCOAProduct(product)}
                className="px-3 py-1.5 rounded-lg bg-brand-dark hover:bg-brand-card border border-cyan-500/40 text-cyan-400 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>View Full COA</span>
              </button>
            </div>

            {/* Quantity Selector & Add to Cart */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2">
              <div className="sm:col-span-4 flex items-center justify-between border border-brand-border rounded-xl bg-brand-dark p-1">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-brand-card transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-sm font-bold text-white font-mono">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-brand-card transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className="sm:col-span-8">
                <button
                  onClick={handleAddToCart}
                  className={`w-full py-3.5 px-6 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-lg ${
                    added
                      ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                      : 'bg-gradient-to-r from-brand-accent to-blue-600 hover:from-blue-500 hover:to-brand-accent text-white shadow-brand-accent/25 active:scale-98 border border-cyan-400/30'
                  }`}
                >
                  {added ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Added {quantity} to Research Cart!</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-4 h-4" />
                      <span>Add to Cart • ${(totalPrice).toFixed(2)}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Automatic Bulk Pricing Table */}
          <BulkPricingTable product={product} />

          {/* Quick Description */}
          <p className="text-xs text-gray-300 leading-relaxed">
            {product.description}
          </p>

          {/* Reconstitution Tool Link */}
          <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Calculator className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-gray-200">Need help calculating BAC water &amp; dosage units?</span>
            </div>
            <Link
              href="/calculator"
              className="text-xs font-bold text-cyan-400 hover:underline flex-shrink-0"
            >
              Open Calc →
            </Link>
          </div>
        </div>

      </div>

      {/* Tabs: Specifications, Full COA, Reconstitution Guide */}
      <div className="pt-6 border-t border-brand-border space-y-6">
        <div className="flex border-b border-brand-border gap-4 sm:gap-8 overflow-x-auto text-xs font-semibold">
          {[
            { id: 'overview', label: 'Compound Overview' },
            { id: 'specs', label: 'Chemical Specifications' },
            { id: 'coa', label: 'Certificate of Analysis (COA)' },
            { id: 'reconstitution', label: 'Reconstitution & Storage' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-3 border-b-2 transition-colors flex-shrink-0 ${
                activeTab === tab.id
                  ? 'border-cyan-400 text-cyan-400 font-bold'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6 rounded-2xl bg-brand-card border border-brand-border text-xs text-gray-300 leading-relaxed">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white">Laboratory Overview & Description</h3>
              <p>{product.description}</p>
              <ul className="list-disc list-inside space-y-1.5 text-gray-400 pt-2">
                {product.details.map((det, i) => (
                  <li key={i}>{det}</li>
                ))}
              </ul>
            </div>
          )}

          {activeTab === 'specs' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white">Chemical & Physical Properties</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {product.sequence && (
                  <div className="p-3 bg-brand-darker rounded-xl border border-brand-border col-span-1 sm:col-span-2">
                    <span className="text-[10px] text-gray-500 uppercase block">Amino Acid Sequence</span>
                    <span className="font-mono text-cyan-300 text-xs break-all">{product.sequence}</span>
                  </div>
                )}
                {product.casNumber && (
                  <div className="p-3 bg-brand-darker rounded-xl border border-brand-border">
                    <span className="text-[10px] text-gray-500 uppercase block">CAS Number</span>
                    <span className="font-mono text-white text-xs">{product.casNumber}</span>
                  </div>
                )}
                {product.molarMass && (
                  <div className="p-3 bg-brand-darker rounded-xl border border-brand-border">
                    <span className="text-[10px] text-gray-500 uppercase block">Molar Mass / Molecular Weight</span>
                    <span className="font-mono text-white text-xs">{product.molarMass}</span>
                  </div>
                )}
                {product.formula && (
                  <div className="p-3 bg-brand-darker rounded-xl border border-brand-border">
                    <span className="text-[10px] text-gray-500 uppercase block">Molecular Formula</span>
                    <span className="font-mono text-white text-xs">{product.formula}</span>
                  </div>
                )}
                <div className="p-3 bg-brand-darker rounded-xl border border-brand-border">
                  <span className="text-[10px] text-gray-500 uppercase block">Storage Protocol</span>
                  <span className="text-white text-xs">{product.storage}</span>
                </div>
                <div className="p-3 bg-brand-darker rounded-xl border border-brand-border">
                  <span className="text-[10px] text-gray-500 uppercase block">Physical Appearance</span>
                  <span className="text-white text-xs">{product.appearance}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'coa' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Analytical Quality & HPLC Certificate</h3>
                <button
                  onClick={() => setSelectedCOAProduct(product)}
                  className="px-3 py-1 bg-brand-accent text-white rounded-lg text-xs font-bold"
                >
                  Open Full Inspector Modal
                </button>
              </div>

              <div className="p-4 rounded-xl bg-brand-darker border border-brand-border grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs">
                <div>
                  <span className="text-[10px] text-gray-500 block">Lot Number:</span>
                  <span className="text-cyan-400 font-bold">{product.coa.lotNumber}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 block">Testing Date:</span>
                  <span className="text-white">{product.coa.testDate}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 block">HPLC Purity:</span>
                  <span className="text-emerald-400 font-bold">{product.coa.purity}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 block">Auditing Lab:</span>
                  <span className="text-white">{product.coa.lab}</span>
                </div>
              </div>

              <p className="text-xs text-gray-400">
                Chromatographic peak evaluation: <span className="text-cyan-300">{product.coa.chromatogramPeak}</span>. Analysis carried out using high-pressure liquid chromatography UV-detection at 214nm wavelength paired with Electrospray Ionization Mass Spectrometry.
              </p>
            </div>
          )}

          {activeTab === 'reconstitution' && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white">Reconstitution & Laboratory Handling Protocols</h3>
              <p>
                1. <strong>Solvent selection:</strong> Reconstitute using sterile Bacteriostatic 0.9% Benzyl Alcohol Water (BAC Water).
              </p>
              <p>
                2. <strong>Dissolution:</strong> Direct the liquid stream against the inner vial wall. Gently swirl—never shake vigorously.
              </p>
              <p>
                3. <strong>Storage:</strong> Store lyophilized vials in freezer at -20°C for up to 36 months. Store reconstituted liquid in refrigerator at 2°C to 8°C for up to 30 days.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Related Peptides */}
      {relatedProducts.length > 0 && (
        <div className="space-y-6 pt-6">
          <h2 className="text-xl sm:text-2xl font-extrabold text-white">
            Related Compounds in this Pathway
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {relatedProducts.map((rel) => (
              <ProductCard key={rel.id} product={rel} />
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
