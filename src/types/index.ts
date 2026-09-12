export interface Product {
  id: string;
  name: string;
  slug: string;
  category: string;
  categorySlug: string;
  price: number;
  salePrice?: number;
  inStock: boolean;
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
  /** Uploaded certificate PDF, when the dashboard has one for this product. */
  coaUrl?: string;
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
}
