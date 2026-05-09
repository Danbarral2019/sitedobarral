'use client';

import { useEffect, useState } from 'react';
import type { LeiArticle } from '@/data/lei-14133-artigos';

/**
 * Hook compartilhado pra carregar todos os artigos da Lei 14.133.
 *
 * Cache module-level: o fetch acontece UMA vez e é compartilhado entre todos os
 * componentes que usam o hook. Em caso de falha do fetch, faz dynamic import do
 * mapa estático como fallback (sem inflar o bundle inicial).
 */

type ArticlesMap = Record<string, LeiArticle>;

let cachedArticles: ArticlesMap | null = null;
let inflightPromise: Promise<ArticlesMap> | null = null;

async function loadArticles(): Promise<ArticlesMap> {
  if (cachedArticles) return cachedArticles;
  if (inflightPromise) return inflightPromise;

  inflightPromise = (async () => {
    try {
      const response = await fetch('/api/lei-14133/artigos');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data.success || !data.artigos) throw new Error('payload inválido');
      cachedArticles = data.artigos as ArticlesMap;
      return cachedArticles;
    } catch (error) {
      console.error('Erro ao buscar artigos da Lei 14.133, usando fallback estático:', error);
      const { LEI_14133_ARTIGOS } = await import('@/data/lei-14133-artigos');
      cachedArticles = LEI_14133_ARTIGOS;
      return cachedArticles;
    } finally {
      inflightPromise = null;
    }
  })();

  return inflightPromise;
}

export interface UseLeiArticlesResult {
  articles: ArticlesMap;
  isLoading: boolean;
  getArticle: (numero: string) => LeiArticle | undefined;
}

export function useLeiArticles(): UseLeiArticlesResult {
  const [articles, setArticles] = useState<ArticlesMap>(cachedArticles ?? {});
  const [isLoading, setIsLoading] = useState(cachedArticles === null);

  useEffect(() => {
    if (cachedArticles) {
      setArticles(cachedArticles);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    loadArticles().then(loaded => {
      if (!cancelled) {
        setArticles(loaded);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    articles,
    isLoading,
    getArticle: (numero: string) => articles[numero],
  };
}
