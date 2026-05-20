/**
 * Funções auxiliares para enriquecimento de contexto legal
 *
 * Usado pela API /api/documents/query para montar contexto em 3 camadas:
 * Lei 14.133 > Atos Normativos > Documentos/Jurisprudência
 */

import { LEI_14133_ARTIGOS } from '@/data/lei-14133-artigos';
import { prisma } from '@/lib/prisma';
import { generateQueryEmbedding, embeddingToSql } from '@/lib/embeddings/gemini-embeddings';
import { parseLeiArticles, getLeiArticles } from '@/lib/lei-articles';
import { getHierarchyInfo } from '@/lib/legislative-acts/hierarchy';
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

    const articles: string[] = getLeiArticles(result);

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
// Semantic article selection (Fase 5B)
// ===========================

/**
 * Combina artigos citados nos documentos + artigos semanticamente relevantes à query.
 * Busca vetorial na tabela LeiArticleEmbedding para encontrar artigos pertinentes
 * mesmo quando nenhum documento retornado os cita.
 *
 * Graceful degradation: se a tabela estiver vazia, retorna apenas citados.
 */
export async function selectRelevantArticles(
  query: string,
  citedArticles: string[],
  maxArticles: number = 10
): Promise<string[]> {
  // Citados nos docs (até 60% do espaço)
  const maxCited = Math.ceil(maxArticles * 0.6);
  const cited = citedArticles.slice(0, maxCited);

  try {
    // Verificar se a tabela tem dados (graceful degradation)
    const countResult = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) as count FROM "LeiArticleEmbedding"`
    );
    if (Number(countResult[0].count) === 0) {
      return citedArticles.slice(0, maxArticles);
    }

    // Gerar embedding da query
    const { embedding } = await generateQueryEmbedding(query);
    const embSql = embeddingToSql(embedding);

    // Busca semântica na tabela LeiArticleEmbedding
    const semanticArticles = await prisma.$queryRawUnsafe<
      Array<{ articleNumber: string; similarity: number }>
    >(`
      SELECT "articleNumber", 1 - (embedding <=> '${embSql}'::vector) as similarity
      FROM "LeiArticleEmbedding"
      WHERE 1 - (embedding <=> '${embSql}'::vector) >= 0.45
      ORDER BY similarity DESC
      LIMIT ${maxArticles}
    `);

    // Merge: citados primeiro, depois semânticos (sem duplicatas)
    const all = [...cited];
    for (const art of semanticArticles) {
      if (!all.includes(art.articleNumber)) {
        all.push(art.articleNumber);
      }
      if (all.length >= maxArticles) break;
    }

    return all;
  } catch (error) {
    // Fallback: tabela pode não existir ou outro erro
    console.warn('⚠️ selectRelevantArticles fallback (error):', error instanceof Error ? error.message : error);
    return citedArticles.slice(0, maxArticles);
  }
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
 * Busca atos normativos relacionados aos artigos citados na resposta/contexto
 * que NÃO apareceram na busca semântica.
 *
 * R1 (2026-04-29): expandido para retornar mais atos (limit default 5 → 8) e
 * ordenar por (matchCount desc, hierarchyLevel asc) — atos de hierarquia mais
 * alta (Lei > Decreto > Portaria > IN) sobem quando empatam em matchCount.
 * Esses atos são tratados como "regulamentadores diretos" no caller e entram
 * no contexto FORA do cap por tipo (R3).
 */
export async function findRelatedActs(
  articleNumbers: string[],
  alreadyFoundTitles: string[],
  limit: number = 8
): Promise<Array<{ title: string; ementa: string; url: string; leiArticles: string[]; hierarchyLevel: number }>> {
  if (articleNumbers.length === 0) return [];

  // Onda 4.5.5b: array nativo + GIN. Bug fix de brinde — `LIKE '%"75"%'` matchava "175"/"750".
  const articleConditions = articleNumbers.map(art =>
    `"leiArticlesArr" @> ARRAY['${art.replace(/'/g, "''")}']::text[]`
  ).join(' OR ');

  const excludeTitles = alreadyFoundTitles.length > 0
    ? alreadyFoundTitles.map(t => `'${t.replace(/'/g, "''")}'`).join(',')
    : "''";

  const acts = await prisma.$queryRawUnsafe<Array<{
    full_number: string;
    ementa: string;
    official_url: string | null;
    lei_articles: string | null;
    hierarchy_level: number;
  }>>(`
    SELECT "fullNumber" as full_number, ementa, "officialUrl" as official_url,
           "leiArticles" as lei_articles, "hierarchyLevel" as hierarchy_level
    FROM "LegislativeAct"
    WHERE (${articleConditions})
      AND "fullNumber" NOT IN (${excludeTitles})
    LIMIT ${limit * 3}
  `);

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
      hierarchyLevel: act.hierarchy_level,
      matchCount,
    };
  });

  return matched
    .sort((a, b) => {
      // 1. mais artigos casados primeiro
      if (a.matchCount !== b.matchCount) return b.matchCount - a.matchCount;
      // 2. hierarquia mais alta (1=Lei) ganha desempate
      return a.hierarchyLevel - b.hierarchyLevel;
    })
    .slice(0, limit)
    .map(({ matchCount: _matchCount, ...rest }) => rest);
}

// ===========================
// Build layered context for LLM
// ===========================

/**
 * Monta contexto em 3 camadas para o prompt do Gemini:
 * 1. Lei 14.133 (artigos) — 30%
 * 2. Atos normativos regulamentadores — 30% (era 20%)
 * 3. Documentos e jurisprudência — 40% (era 50%)
 *
 * R2 (2026-04-29): aumentamos a camada 2 para dar mais espaço a decretos/INs/
 * portarias que regulamentam matérias específicas; antes ficavam prensados
 * em 20% e raramente apareciam nas respostas IA, mesmo quando recuperados.
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

  // Camada 2: Atos normativos (até 30% do espaço)
  if (actsContext) {
    const maxActs = Math.min(actsContext.length, Math.floor(maxTotal * 0.30));
    const trimmedActs = actsContext.slice(0, maxActs);
    parts.push(`ATOS NORMATIVOS REGULAMENTADORES:\n${trimmedActs}`);
    remaining -= trimmedActs.length + 50;
  }

  // Camada 3: Documentos/jurisprudência (resto do espaço, ~40%)
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
 * Formata atos normativos como texto para o prompt.
 *
 * R1 (2026-04-29): atos vindos com hierarchyLevel (regulamentadores diretos)
 * recebem prefixo de hierarquia (Lei/Decreto/Portaria/IN) — o LLM entende
 * que tem autoridade variada e cita preferencialmente os mais altos.
 */
export function formatActsContext(
  acts: Array<{ title: string; ementa: string; url: string; leiArticles: string[]; hierarchyLevel?: number }>,
  maxLength: number = 2000
): string {
  let context = '';

  for (const act of acts) {
    const articles = act.leiArticles.length > 0
      ? ` (Art. ${act.leiArticles.slice(0, 5).join(', ')}${act.leiArticles.length > 5 ? '...' : ''})`
      : '';
    const hierInfo = getHierarchyInfo(act.hierarchyLevel);
    const prefix = hierInfo ? `[${hierInfo.label}] ` : '';
    const entry = `**${prefix}${act.title}**${articles}\n${act.ementa}\n\n`;

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
