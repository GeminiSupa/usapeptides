'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { categories as fallback } from '@/data/categories';
import type { Category } from '@/types';

const toCategory = (row: { id: string; name: string; slug: string; description: string }, count = 0): Category => ({
  ...row,
  count,
  iconName: 'Boxes',
  bgGradient: '',
});

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>(fallback);

  useEffect(() => {
    if (!supabase) return;
    void (async () => {
      const [{ data, error }, { data: products }] = await Promise.all([
        supabase
          .from('product_categories')
          .select('id,name,slug,description')
          .eq('is_active', true)
          .order('sort_order')
          .order('name'),
        supabase.from('products').select('category_slug').eq('is_live', true),
      ]);
      if (error || !data?.length) return;
      const counts = new Map<string, number>();
      for (const product of products ?? []) {
        const slug = String(product.category_slug ?? '');
        counts.set(slug, (counts.get(slug) ?? 0) + 1);
      }
      setCategories(data.map((category) => toCategory(category, counts.get(category.slug) ?? 0)));
    })();
  }, []);

  return categories;
}

export function useCategory(slug: string) {
  const fallbackCategory = fallback.find((category) => category.slug === slug) ?? null;
  const [category, setCategory] = useState<Category | null>(fallbackCategory);
  const [loading, setLoading] = useState(Boolean(supabase) && !fallbackCategory);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void (async () => {
      const { data, error } = await supabase
        .from('product_categories')
        .select('id,name,slug,description')
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle();
      if (!active) return;
      if (!error && data) setCategory(toCategory(data));
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [slug]);

  return { category, loading };
}
