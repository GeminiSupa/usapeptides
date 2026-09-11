'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Flame, 
  Zap, 
  Shield, 
  Sun, 
  Activity, 
  Cpu, 
  Dna, 
  Sparkles, 
  Layers, 
  Droplet,
  ArrowRight
} from 'lucide-react';
import { categories } from '@/data/categories';

const iconMap: Record<string, React.ReactNode> = {
  Flame: <Flame className="w-5 h-5 text-amber-400" />,
  Zap: <Zap className="w-5 h-5 text-blue-400" />,
  Shield: <Shield className="w-5 h-5 text-emerald-400" />,
  Sun: <Sun className="w-5 h-5 text-rose-400" />,
  Activity: <Activity className="w-5 h-5 text-purple-400" />,
  Cpu: <Cpu className="w-5 h-5 text-cyan-400" />,
  Dna: <Dna className="w-5 h-5 text-teal-400" />,
  Sparkles: <Sparkles className="w-5 h-5 text-fuchsia-400" />,
  Layers: <Layers className="w-5 h-5 text-sky-400" />,
  Droplet: <Droplet className="w-5 h-5 text-slate-300" />,
};

export default function CategoryNav() {
  return (
    <section className="py-16 bg-brand-dark/40 border-b border-brand-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <div className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-1">
              Analytical Categorization
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Shop By Research Pathway
            </h2>
          </div>
          <Link
            href="/shop"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <span>View All Categories</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Category Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/category/${cat.slug}`}
              className="group p-4 rounded-2xl bg-brand-card hover:bg-brand-cardHover border border-brand-border hover:border-cyan-500/40 transition-all duration-200 flex flex-col justify-between shadow-md"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-brand-darker border border-brand-border flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  {iconMap[cat.iconName] || <Zap className="w-5 h-5 text-cyan-400" />}
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-cyan-400 transition-colors mb-1 line-clamp-2">
                  {cat.name}
                </h3>
                <p className="text-[11px] text-gray-400 line-clamp-2 mb-3 leading-relaxed">
                  {cat.description}
                </p>
              </div>

              <div className="flex items-center justify-between text-[11px] pt-2 border-t border-brand-border/40 text-brand-textMuted">
                <span>{cat.count} compounds</span>
                <span className="text-cyan-400 font-semibold group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </Link>
          ))}
        </div>

      </div>
    </section>
  );
}
