'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { articles as fallback } from '@/data/articles';
import type { Article } from '@/types';

type DbArticle = { id:string; slug:string; title:string; excerpt:string; content:string; category:string; author:string; image:string|null; tags:string[]|null; read_time:string; published_at:string|null };
const mapArticle = (row: DbArticle): Article => ({
  id: row.id, slug: row.slug, title: row.title, excerpt: row.excerpt, content: row.content,
  category: row.category, author: row.author,
  date: row.published_at ? new Date(row.published_at).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' }) : '',
  readTime: row.read_time, image: row.image || '/products/vial-1.jpg', tags: row.tags ?? [],
});
export function useArticles() {
  const [articles, setArticles] = useState<Article[]>(fallback); const [loading, setLoading] = useState(Boolean(supabase));
  useEffect(() => {
    if (!supabase) return;
    void (async () => {
      const { data, error } = await supabase!
        .from('articles')
        .select('id, slug, title, excerpt, content, category, author, image, tags, read_time, published_at')
        .order('published_at', { ascending: false });
      if (!error && data?.length) setArticles(data.map(mapArticle));
      setLoading(false);
    })();
  }, []);
  return { articles, loading };
}
