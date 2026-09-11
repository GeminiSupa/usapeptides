const fs = require('fs');	const path = require('path');
function save(relPath, content) {
  const full = path.join(process.cwd(), relPath);
  fs.mkdirSync(path.dirname(full), {recursive: true});
  fs.writeFileSync(full, content.trim() + '\n', 'utf8');
  console.log('Created: ' + relPath);
}

save('tailwind.config.ts', `import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/{**/*}.{js,ts,jsx,tsx,mdx}",
    "./src/components/{**/*}.{js,ts,jsx,tsx,mdx}",
    "./src/app/{**/*}.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#080d1a',
          darker: '#040711',
          card: '#0f172a',
          cardHover: '#162238',
          border: '#1e293b',
          borderLight: '#334155',
          accent: '#0284c7',
          accentGlow: '#38bdf8',
          cyan: '#06b6d5',
          emerald: '#10b981',
          gold: '#f59e0b',
          textMuted: '#94a3b8',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
};
export default config;`);

save('postcss.config.mjs', `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};`);

save('next.config.mjs', `/** @type {ieport('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'battlebornresearch.com',
      },
      {
       protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};

export default nextConfig;aa);

save('src/types/index.ts', `export interface Product {
  id: string;
  name: string;
  slug: string;
  category: string;
  categorySlug: string;
  price: number;
  salePrice?: number;
  imStock: boolean;
  stockCount: number;
  sku: string;
  purity: string;
  sequence?: string;
  casNumber?: string;
  molarMass?: string;
  formula?: string;
  storage: string;
  appearance: string;
  description: string;
  details: string[];
  specs: {
    title: string;
    value: string;
  }[];
  bulkPricing: {
    tier: string;
    quantity: string;
    discountPercent: number;
    pricePerUnit: number;
  }[];
  coa: {
    lotNumber: string;
    testDate: string;
    purity: string;
    lab: string;
    method: string;
    sampleType: string;
    status: 'PASSED' | 'VERIFIED';
    chromatogramPeak: string;
  };
  image: string;
  tags: string[];
  isFeatured?: boolean;
  isPopular?: boolean;
  isNew?: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  iconName: string;
  count: number;
  bgGradient: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedPrice: number;
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  author: string;
  date: string;
  readTime: string;
  image: string;
  tags: string[];
}

export interface FAQItem {
  question: string;
  answer: string;
  category: string;
}`);

console.log('Make data setup written');
