/**
 * Funções auxiliares para enriquecimento de contexto legal
 *
 * Usado pela API /api/documents/query para montar contexto em 3 camadas:
 * Lei 14.133 > Atos Normativos > Documentos/Jurisprudência
 */

import { LEI_14133_ARTIGOS } from '@/data/lei-14133-artigos';
import { prisma } from '@/lib/prisma';
import type { SearchResult } from '@/lib/embeddings/vector-search';

// ===========================
// Types
// ===========================

export interface LegalSource {
  type: 'lei-article' | 'legislative-act';
  title: string;
  url: string;
  articleNumber?: string;
}

// ===========================
// Extract cited articles from search results
// ===========================

/**
 * Extrai números de artigos da Lei 14.133 citados nos documentos retornados
 * pelo pgvector (campo leiArticles dos docs).
 * Prioriza artigos citados por mais documentos (frequência) e limita o total.
 */
export function extractCitedArticles(
  results: Array<SearchResult & { leiArticles?: string | null }>,
  maxArticles: number = 8
): string[] {
  const articleCounts = new Map<string, number>();

  for (const result of results) {
    if (!result.leiArticles) continue;

    let articles: string[] = [];
    try {
      articles = JSON.parse(result.leiArticles);
    } catch {
      articles = result.leiArticles.split(',').map(s => s.trim()).filter(Boolean);
    }

    for (const art of articles) {
      const key = String(art);
      articleCounts.set(key, (articleCounts.get(key) || 0) + 1);
    }
  }

  return Array.from(articleCounts.entries())
    .sort((a, b) => {
      // Mais frequente primeiro
      if (b[1] !== a[1]) return b[1] - a[1];
      // Desempate: número do artigo crescente
      const numA = parseInt(a[0].replace(/[^0-9]/g, '')) || 0;
      const numB = parseInt(b[0].replace(/[^0-9]/g, '')) || 0;
      return numA - numB;
    })
    .slice(0, maxArticles)
    .map(([art]) => art);
}

// ===========================
// Build lei context from article numbers
// ===========================

/**
 * Monta texto dos artigos da Lei 14.133 a partir dos números
 * Usado para artigos citados nos docs que NÃO apareceram na busca semântica
 */
export function buildLeiContext(articleNumbers: string[], maxLength: number = 3000): string {
  let context = '';

  for (const num of articleNumbers) {
    const artigo = LEI_14133_ARTIGOS[num];
    if (!artigo) continue;

    const entry = `**Art. ${num} - Lei 14.133/2021**\n${artigo.ementa}\n\n`;

    if (context.length + entry.length > maxLength) break;
    context += entry;
  }

  return context.trim();
}

// ===========================
// Find related legislative acts
// ===========================

/**
 * Busca atos normativos relacionados aos artigos citados
 * que NÃO apareceram na busca semântica
 */
export async function findRelatedActs(
  articleNumbers: string[],
  alreadyFoundTitles: string[],
  limit: number = 5
): Promise<Array<{ title: string; ementa: string; url: string; leiArticles: string[] }>> {
  if (articleNumbers.length === 0) return [];

  // Filtrar no SQL: busca atos que contenham ao menos um dos artigos citados
  const articleConditions = articleNumbers.map(art =>
    `"leiArticles"::text LIKE '%"${art.replace(/'/g, "''")}"%'`
  ).join(' OR ');

  const excludeTitles = alreadyFoundTitles.length > 0
    ? alreadyFoundTitles.map(t => `'${t.replace(/'/g, "''")}'`).join(',')
    : "''";

  const acts = await prisma.$queryRawUnsafe<Array<{
    full_number: string;
    ementa: string;
    official_url: string | null;
    lei_articles: string | null;
  }>>(`
    SELECT "fullNumber" as full_number, ementa, "officialUrl" as official_url, "leiArticles" as lei_articles
    FROM "LegislativeAct"
    WHERE "leiArticles" IS NOT NULL
      AND (${articleConditions})
      AND "fullNumber" NOT IN (${excludeTitles})
    LIMIT ${limit * 3}
  `);

  // Contar matches e ordenar por relevância
  const matched = acts.map(act => {
    let actArticles: string[] = [];
    try {
      actArticles = JSON.parse(act.lei_articles!);
    } catch {
      actArticles = (act.lei_articles || '').split(',').map(s => s.trim()).filter(Boolean);
    }

    const matchCount = actArticles.filter(a => articleNumbers.includes(a)).length;
    return {
      title: act.full_number,
      ementa: act.ementa,
      url: act.official_url || '',
      leiArticles: actArticles,
      matchCount,
    };
  });

  return matched
    .sort((a, b) => b.matchCount - a.matchCount)
    .slice(0, limit)
    .map(({ matchCount: _matchCount, ...rest }) => rest);
}

// ===========================
// Build layered context for LLM
// ===========================

/**
 * Monta contexto em 3 camadas para o prompt do Gemini:
 * 1. Lei 14.133 (artigos)
 * 2. Atos normativos regulamentadores
 * 3. Documentos e jurisprudência
 */
export function buildLayeredContext(
  leiContext: string,
  actsContext: string,
  docsContext: string,
  maxTotal: number = 8000
): string {
  const parts: string[] = [];
  let remaining = maxTotal;

  // Camada 1: Lei (prioridade máxima, até 30% do espaço)
  if (leiContext) {
    const maxLei = Math.min(leiContext.length, Math.floor(maxTotal * 0.30));
    const trimmedLei = leiContext.slice(0, maxLei);
    parts.push(`PRECEITOS LEGAIS (Lei 14.133/2021):\n${trimmedLei}`);
    remaining -= trimmedLei.length + 50;
  }

  // Camada 2: Atos normativos (até 20% do espaço)
  if (actsContext) {
    const maxActs = Math.min(actsContext.length, Math.floor(maxTotal * 0.20));
    const trimmedActs = actsContext.slice(0, maxActs);
    parts.push(`ATOS NORMATIVOS REGULAMENTADORES:\n${trimmedActs}`);
    remaining -= trimmedActs.length + 50;
  }

  // Camada 3: Documentos/jurisprudência (resto do espaço, ~50%)
  if (docsContext) {
    const trimmedDocs = docsContext.slice(0, Math.max(remaining, 2000));
    parts.push(`DOCUMENTOS E JURISPRUDÊNCIA:\n${trimmedDocs}`);
  }

  return parts.join('\n\n---\n\n');
}

// ===========================
// Build acts context string
// ===========================

/**
 * Formata atos normativos como texto para o prompt
 */
export function formatActsContext(
  acts: Array<{ title: string; ementa: string; url: string; leiArticles: string[] }>,
  maxLength: number = 2000
): string {
  let context = '';

  for (const act of acts) {
    const articles = act.leiArticles.length > 0
      ? ` (Art. ${act.leiArticles.slice(0, 5).join(', ')}${act.leiArticles.length > 5 ? '...' : ''})`
      : '';
    const entry = `**${act.title}**${articles}\n${act.ementa}\n\n`;

    if (context.length + entry.length > maxLength) break;
    context += entry;
  }

  return context.trim();
}

// ===========================
// Build legal sources for API response
// ===========================

/**
 * Monta array de fontes legais para retornar na API
 */
export function buildLegalSources(
  leiArticleNumbers: string[],
  acts: Array<{ title: string; url: string }>
): LegalSource[] {
  const sources: LegalSource[] = [];

  // Artigos da lei
  for (const num of leiArticleNumbers) {
    const artigo = LEI_14133_ARTIGOS[num];
    if (!artigo) continue;
    sources.push({
      type: 'lei-article',
      title: `Art. ${num} - Lei 14.133`,
      url: `/area-restrita/artigo/${num}`,
      articleNumber: num,
    });
  }

  // Atos normativos
  for (const act of acts) {
    sources.push({
      type: 'legislative-act',
      title: act.title,
      url: act.url,
    });
  }

  return sources;
}
