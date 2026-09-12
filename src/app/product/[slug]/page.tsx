import { products } from '@/data/products';
import ProductDetailClient from './ProductDetailClient';

/**
 * Prerenders the bundled catalogue at build time. Products added in the
 * dashboard afterwards are not listed here and are rendered on demand instead,
 * which is why this is a hint rather than the full set.
 */
export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

interface ProductDetailPageProps {
  params: {
    slug: string;
  };
}

export default function ProductDetailPage({ params }: ProductDetailPageProps) {
  return <ProductDetailClient slug={params.slug} />;
}
