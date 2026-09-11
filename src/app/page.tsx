'use client';

import React from 'react';
import Link from 'next/link';
import Hero from '@/components/Hero';
import CategoryNav from '@/components/CategoryNav';
import ProductCard from '@/components/ProductCard';
import ReconstitutionCalculator from '@/components/ReconstitutionCalculator';
import { products } from '@/data/products';
import { articles } from '@/data/articles';
import { 
  ShieldCheck, 
  Truck, 
  FlaskConical, 
  Award, 
  ArrowRight, 
  Sparkles, 
  CheckCircle2, 
  Star,
  FileText
} from 'lucide-react';

export default function HomePage() {
  const featuredProducts = products.filter((p) => p.isFeatured || p.isPopular).slice(0, 8);
  const metabolicProducts = products.filter((p) => p.categorySlug === 'incretin-metabolic-receptor-compounds');
  const ghrhProducts = products.filter((p) => p.categorySlug === 'ghrh-ghrelin-receptor-peptides');

  return (
    <div className="space-y-16">
      {/* 1. Hero Section */}
      <Hero />

      {/* 2. Value Proposition Strip */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-gradient-to-br from-brand-card via-brand-dark to-brand-card border border-brand-border hover:border-cyan-500/40 transition-all shadow-xl flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 flex-shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white mb-1">Guaranteed &gt;99% Purity</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Reverse-Phase HPLC and ESI mass spectrometry batch testing ensuring laboratory-grade peptide integrity.
              </p>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-gradient-to-br from-brand-card via-brand-dark to-brand-card border border-brand-border hover:border-cyan-500/40 transition-all shadow-xl flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-950/80 border border-blue-500/40 flex items-center justify-center text-blue-400 flex-shrink-0">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white mb-1">USA Same-Day Fulfillment</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Orders placed before 2:00 PM EST ship same-day with USPS Priority or FedEx 2-Day. Free on orders $100+.
              </p>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-gradient-to-br from-brand-card via-brand-dark to-brand-card border border-brand-border hover:border-cyan-500/40 transition-all shadow-xl flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-950/80 border border-purple-500/40 flex items-center justify-center text-purple-400 flex-shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white mb-1">Tiered Bulk Savings</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Save up to 20% on volume vial purchases with instant automated discounts applied directly in cart.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Featured & Trending Peptides Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Analytical Highlights</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Featured Research Peptides
            </h2>
          </div>
          <Link
            href="/shop"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <span>View Full 30+ Catalog</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* 4. Categorization Matrix */}
      <CategoryNav />

      {/* 5. GHRH & Incretin Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-1">
              Metabolic & Incretin Research
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              GLP-1, GIP &amp; Triple Co-Agonists
            </h2>
          </div>
          <Link
            href="/category/incretin-metabolic-receptor-compounds"
            className="text-xs font-bold text-cyan-400 hover:underline flex items-center gap-1"
          >
            <span>Explore Incretin Compounds</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {metabolicProducts.slice(0, 4).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* 6. Interactive Reconstitution Calculator Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ReconstitutionCalculator />
      </section>

      {/* 7. Laboratory Quality Assurance & Analytical Standards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-gradient-to-br from-brand-card via-brand-dark to-brand-darker border border-brand-border p-8 sm:p-12 shadow-2xl relative overflow-hidden">
          <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-brand-accent/10 rounded-full blur-3xl pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            <div className="lg:col-span-7 space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs font-semibold">
                <FlaskConical className="w-3.5 h-3.5" />
                <span>Analytical Rigor & Third-Party Auditing</span>
              </div>

              <h2 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
                Why Researchers Rely on Battle Born Peptides
              </h2>

              <p className="text-sm text-gray-300 leading-relaxed">
                Consistency, sequence validation, and precise peptide content are critical to reproducible laboratory trials. Every peptide synthesis undergoes independent testing before release.
              </p>

              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white text-xs block">Reverse-Phase HPLC UV-214nm Testing</strong>
                    <span className="text-xs text-gray-400">Published chromatograms verifying chromatographic purity &gt;99.0% with baseline separation.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white text-xs block">Electrospray Ionization Mass Spectrometry (ESI-MS)</strong>
                    <span className="text-xs text-gray-400">Confirmation of theoretical monoisotopic mass and absence of deletion truncated peptides.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white text-xs block">Strict Cold-Chain & Inert Gas Packaging</strong>
                    <span className="text-xs text-gray-400">Lyophilized cakes sealed under inert gas in Type I borosilicate vials to eliminate oxidation.</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex flex-wrap gap-4">
                <Link
                  href="/about-us"
                  className="px-6 py-3 rounded-xl bg-brand-accent hover:bg-blue-600 text-white font-bold text-xs transition-colors shadow-lg"
                >
                  Our Quality Assurance Process
                </Link>
                <Link
                  href="/blog/understanding-hplc-and-mass-spectrometry-purity"
                  className="px-6 py-3 rounded-xl bg-brand-dark hover:bg-brand-card border border-brand-border text-gray-200 text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                  <span>How We Test COAs</span>
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5 flex justify-center">
              <div className="p-6 rounded-2xl bg-brand-darker/90 border border-brand-border space-y-4 max-w-sm w-full shadow-2xl">
                <div className="flex items-center justify-between pb-3 border-b border-brand-border">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-cyan-400" />
                    <span className="text-xs font-bold text-white">Janoshik Analytical Audit</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950/80 px-2 py-0.5 rounded">
                    PASS
                  </span>
                </div>
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between text-gray-400">
                    <span>Compound:</span>
                    <span className="text-white font-bold">Retatrutide 10mg</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Target Mass:</span>
                    <span className="text-white">4731.33 Da</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Observed Mass:</span>
                    <span className="text-emerald-400 font-bold">4731.40 Da</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Purity (RP-HPLC):</span>
                    <span className="text-cyan-400 font-bold">99.64%</span>
                  </div>
                </div>
                <div className="text-[10px] text-gray-500 pt-2 border-t border-brand-border">
                  Tested under ISO 17025 accredited laboratory guidelines.
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 8. Recent Research Articles */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-1">
              Research &amp; Guides
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Scientific Publications & Protocols
            </h2>
          </div>
          <Link
            href="/blog"
            className="text-xs font-bold text-cyan-400 hover:underline flex items-center gap-1"
          >
            <span>Read All Articles</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {articles.map((art) => (
            <Link
              key={art.id}
              href={`/blog/${art.slug}`}
              className="group rounded-2xl bg-brand-card hover:bg-brand-cardHover border border-brand-border hover:border-cyan-500/40 p-5 flex flex-col justify-between transition-all shadow-lg"
            >
              <div className="space-y-3">
                <div className="aspect-video rounded-xl bg-brand-darker overflow-hidden">
                  <img
                    src={art.image}
                    alt={art.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="flex items-center gap-2 text-[10px] text-brand-textMuted">
                  <span className="text-cyan-400 font-semibold">{art.category}</span>
                  <span>•</span>
                  <span>{art.readTime}</span>
                </div>
                <h3 className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors line-clamp-2">
                  {art.title}
                </h3>
                <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                  {art.excerpt}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-brand-border/60 text-xs font-semibold text-cyan-400 flex items-center justify-between">
                <span>Read Full Protocol</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 9. Verified Researcher Testimonials */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-1">
            Research Feedback
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            Trusted by Academic &amp; Private Labs
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-brand-card border border-brand-border space-y-3">
            <div className="flex text-amber-400 gap-1">
              {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-amber-400" />)}
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              &quot;HPLC certificates matched our internal mass spec tests down to 0.1 Da. Delivery was fast, tracked, and securely packaged with zero degradation.&quot;
            </p>
            <div className="pt-2 text-xs">
              <span className="text-white font-bold block">Dr. M. Rodriguez</span>
              <span className="text-gray-500 text-[11px]">Cellular Biology Lab • Texas</span>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-brand-card border border-brand-border space-y-3">
            <div className="flex text-amber-400 gap-1">
              {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-amber-400" />)}
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              &quot;The Retatrutide and Tirzepatide compounds dissolved completely clear with zero precipitate. Excellent lyophilization and transparent testing.&quot;
            </p>
            <div className="pt-2 text-xs">
              <span className="text-white font-bold block">K. Thorne, MS</span>
              <span className="text-gray-500 text-[11px]">Endocrine Research Group • California</span>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-brand-card border border-brand-border space-y-3">
            <div className="flex text-amber-400 gap-1">
              {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-amber-400" />)}
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              &quot;Automated bulk tier pricing makes volume procurement for our department straightforward. Great customer service and rapid response.&quot;
            </p>
            <div className="pt-2 text-xs">
              <span className="text-white font-bold block">J. Henderson</span>
              <span className="text-gray-500 text-[11px]">Biotechnology Institute • Florida</span>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
