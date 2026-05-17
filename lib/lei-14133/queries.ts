/**
 * Server-only queries para a Direção C "Edição Comentada" do /lei-14133.
 *
 * Agregam contagens de Document↔leiArticles por capítulo / artigo, e
 * stats globais. Cache via React `cache` (per-request) — Vercel ISR
 * (revalidate 1h) é configurado no nível da página.
 */

import { cache } from 'react';
import { prisma } from '../prisma';
import { parseLeiArticles } from '../lei-articles';
import { LEI_14133_CAPITULOS, LEI_14133_STRUCTURE_STATS } from '../../data/lei-14133-capitulos';

// Categorias de Document que contam como "jurisprudência relacionada"
const ACORDAO_CATEGORIES = ['acordao', 'sumula', 'consulta_tcu', 'informativo'] as const;

// Categorias que contam como "pareceres/orientações"
const PARECER_ON_CATEGORIES = [
  'parecer',
  'parecer-vinculante',
  'decor',
  'orientacao-normativa',
  'manual-tcu',
  'enunciados',
] as const;

export interface ArticleCounts {
  acordaos: number;
  pareceresOns: number;
}

export interface ChapterCounts extends ArticleCounts {
  artigos: number;
}

export interface LeiStats {
  totalArtigos: number;
  totalCapitulos: number;
  totalAcordaos: number;
  totalPareceresOns: number;
  totalReferencias: number;
}

/**
 * Conta documentos publicados que referenciam pelo menos 1 artigo da Lei 14.133.
 * Resultado: { numeroArtigo: { acordaos, pareceresOns } }.
 */
export const getArticleCounts = cache(async (): Promise<Record<string, ArticleCounts>> => {
  const result: Record<string, ArticleCounts> = {};

  try {
    const docs = await prisma.document.findMany({
      where: {
        isPublic: true,
        leiArticles: { not: null },
        category: { in: [...ACORDAO_CATEGORIES, ...PARECER_ON_CATEGORIES] },
      },
      select: { category: true, leiArticles: true },
    });

    for (const doc of docs) {
      const articles = parseLeiArticles(doc.leiArticles);
      if (articles.length === 0) continue;
      const isAcordao = (ACORDAO_CATEGORIES as readonly string[]).includes(doc.category);
      for (const num of articles) {
        if (!result[num]) result[num] = { acordaos: 0, pareceresOns: 0 };
        if (isAcordao) result[num].acordaos++;
        else result[num].pareceresOns++;
      }
    }
  } catch {
    // DB indisponível (ex.: build CI) — devolve vazio, página renderiza sem contagens
  }

  return result;
});

/**
 * Soma contagens por artigo em contagens por capítulo.
 */
export const getChapterCounts = cache(async (): Promise<Record<string, ChapterCounts>> => {
  const articleCounts = await getArticleCounts();
  const result: Record<string, ChapterCounts> = {};

  for (const cap of LEI_14133_CAPITULOS) {
    let acordaos = 0;
    let pareceresOns = 0;
    for (const art of cap.articles) {
      const c = articleCounts[art];
      if (c) {
        acordaos += c.acordaos;
        pareceresOns += c.pareceresOns;
      }
    }
    result[cap.id] = { artigos: cap.articles.length, acordaos, pareceresOns };
  }

  return result;
});

/**
 * Stats globais — conta DOCUMENTS DISTINTOS que referenciam pelo menos
 * 1 artigo da Lei 14.133. Não soma os counts por artigo (isso superestima
 * porque o mesmo Document aparece em múltiplos artigos).
 */
export const getLeiStats = cache(async (): Promise<LeiStats> => {
  let totalAcordaos = 0;
  let totalPareceresOns = 0;

  try {
    const docs = await prisma.document.findMany({
      where: {
        isPublic: true,
        leiArticles: { not: null },
        category: { in: [...ACORDAO_CATEGORIES, ...PARECER_ON_CATEGORIES] },
      },
      select: { id: true, category: true, leiArticles: true },
    });

    // Filtra só docs que de fato referenciam ALGUM artigo (não apenas null/empty)
    for (const doc of docs) {
      if (parseLeiArticles(doc.leiArticles).length === 0) continue;
      const isAcordao = (ACORDAO_CATEGORIES as readonly string[]).includes(doc.category);
      if (isAcordao) totalAcordaos++;
      else totalPareceresOns++;
    }
  } catch {
    // DB indisponível
  }

  return {
    totalArtigos: LEI_14133_STRUCTURE_STATS.totalArtigos,
    totalCapitulos: LEI_14133_STRUCTURE_STATS.totalCapitulos,
    totalAcordaos,
    totalPareceresOns,
    totalReferencias: totalAcordaos + totalPareceresOns,
  };
});

/**
 * Para a página de detalhe de artigo: lista os documentos relacionados
 * agrupados por categoria.
 */
export const getRelatedForArticle = cache(
  async (
    articleNumber: string
  ): Promise<{
    acordaos: { id: string; title: string; description: string | null; url: string; category: string }[];
    pareceres: { id: string; title: string; description: string | null; url: string; category: string }[];
    total: number;
  }> => {
    try {
      const docs = await prisma.document.findMany({
        where: {
          isPublic: true,
          leiArticles: { contains: `"${articleNumber}"` },
          category: { in: [...ACORDAO_CATEGORIES, ...PARECER_ON_CATEGORIES] },
        },
        select: {
          id: true,
          title: true,
          description: true,
          url: true,
          category: true,
        },
        orderBy: { uploadedAt: 'desc' },
        take: 50,
      });

      const acordaos = docs.filter((d) =>
        (ACORDAO_CATEGORIES as readonly string[]).includes(d.category)
      );
      const pareceres = docs.filter(
        (d) => !(ACORDAO_CATEGORIES as readonly string[]).includes(d.category)
      );

      return {
        acordaos,
        pareceres,
        total: docs.length,
      };
    } catch {
      return { acordaos: [], pareceres: [], total: 0 };
    }
  }
);
