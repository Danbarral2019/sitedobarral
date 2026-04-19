/**
 * Engine RAG do módulo Planejamento.
 *
 * Compõe as peças já prontas do projeto:
 *   - `semanticSearch` (lib/embeddings/vector-search.ts)
 *   - `rerankResults` (lib/embeddings/reranker.ts)
 *   - `extractCitedArticles`, `selectRelevantArticles`, `findRelatedActs`,
 *     `buildLeiContext`, `formatActsContext`, `buildLayeredContext`,
 *     `buildLegalSources` (lib/legal-context.ts)
 *   - `buildContextForLLM`, `formatSources` (lib/embeddings/vector-search.ts)
 *   - LEI_14133_ARTIGOS (data/lei-14133-artigos.ts) para ementas dos artigos
 */

import { semanticSearch, type SearchResult } from "@/lib/embeddings/vector-search";
import { rerankResults } from "@/lib/embeddings/reranker";
import {
  extractCitedArticles,
  selectRelevantArticles,
  findRelatedActs,
  buildLeiContext,
  formatActsContext,
  buildLayeredContext,
  buildLegalSources,
  type LegalSource,
} from "@/lib/legal-context";
import { LEI_14133_ARTIGOS } from "@/data/lei-14133-artigos";
import type {
  SectionDefinition,
  PlanningSectionSource,
} from "@/data/planejamento/types";

export interface PlanningSectionContext {
  /** Resultados crus (após rerank) usados no prompt do LLM. */
  ragHits: SearchResult[];
  /** Excertos curtos (chunkContent truncado) para o painel didático. */
  excerpts: Array<{
    id: string;
    title: string;
    category: string;
    similarity: number;
    snippet: string;
    url?: string;
    sourceType: SearchResult["sourceType"];
  }>;
  /** Artigos da Lei 14.133 relevantes (número + ementa curta). */
  articles: Array<{ numero: string; ementa: string }>;
  /** Atos normativos relacionados (portarias, INs, decretos). */
  relatedActs: Array<{
    title: string;
    ementa: string;
    url: string;
    leiArticles: string[];
  }>;
  /** Contexto em 3 camadas para alimentar o prompt do LLM. */
  layeredContext: string;
  /** Lista achatada para o rodapé de citações no texto gerado. */
  sources: PlanningSectionSource[];
  /** Cobertura de ancoragem: 0 = nada ancorado, 1 = muito bem ancorado. */
  anchorageScore: number;
  /** Conveniência: média de similaridade dos top-3 hits (0 se vazio). */
  topSimilarity: number;
}

interface BuildOpts {
  /** Texto livre de entrada (descrição da contratação) */
  descricaoLivre: string;
  /** Texto já escrito na seção, quando existir — entra na query para refinar */
  contentMd?: string | null;
  /** Curso ativo, se quiser restringir */
  courseId?: string;
  /** Overrides de RAG (debug / teste) */
  limitOverride?: number;
}

/**
 * Monta todo o contexto RAG de uma seção. É função pura-ish: lê DB/embeddings
 * mas não persiste nada. Chame-a tanto para alimentar o painel didático (UI)
 * quanto para alimentar o prompt do `section-generator`.
 */
export async function buildSectionContext(
  def: SectionDefinition,
  opts: BuildOpts,
): Promise<PlanningSectionContext> {
  const query = buildQuery(def, opts);

  const ragFilter = def.ragFilter;
  const limit = opts.limitOverride ?? ragFilter.limit ?? 10;

  // 1) Busca semântica ampla (mais candidatos para o reranker)
  const searchRes = await semanticSearch(query, {
    limit: Math.min(limit * 3, 30),
    threshold: ragFilter.minSimilarity,
    courseId: opts.courseId,
    includeTribunalDecisions: ragFilter.includeTribunalDecisions ?? false,
  });

  const primaryHits = filterBySourceTypes(searchRes.results, ragFilter.sourceTypes);

  // 2) Rerank
  const reranked =
    primaryHits.length > 0 ? await rerankResults(query, primaryHits, limit) : [];

  // 3) Artigos da Lei 14.133 (citados + semanticamente relevantes)
  const cited = extractCitedArticles(reranked, 8);
  const articleNumbers = await selectRelevantArticles(query, cited, 6);
  const articles = articleNumbers
    .map((n) => ({
      numero: n,
      ementa: LEI_14133_ARTIGOS[n]?.ementa ?? "",
    }))
    .filter((a) => a.ementa.length > 0);

  // 4) Atos normativos relacionados (portarias, INs, decretos)
  const titlesJaEncontrados = reranked.map((r) => r.documentTitle);
  const relatedActs =
    articleNumbers.length > 0
      ? await findRelatedActs(articleNumbers, titlesJaEncontrados, 4)
      : [];

  // 5) Montagem dos 3 blocos de contexto
  const leiCtx = buildLeiContext(articleNumbers, 2200);
  const actsCtx = formatActsContext(relatedActs, 1800);
  const docsCtx = reranked
    .map((r) => {
      const head = `[${r.documentTitle}] (${Math.round(r.similarity * 100)}% relevância)`;
      return `${head}\n${r.chunkContent.slice(0, 1400)}`;
    })
    .join("\n\n---\n\n")
    .slice(0, 4500);
  const layeredContext = buildLayeredContext(leiCtx, actsCtx, docsCtx, 8000);

  // 6) Fontes planas para rodapé do texto gerado
  const legalSources = buildLegalSources(
    articleNumbers,
    relatedActs.map((a) => ({ title: a.title, url: a.url })),
  );
  const sources = toPlanningSources(reranked, legalSources);

  const topSimilarity =
    reranked.length === 0
      ? 0
      : reranked.slice(0, 3).reduce((acc, r) => acc + r.similarity, 0) /
        Math.min(3, reranked.length);

  const anchorageScore = computeAnchorage({
    hits: reranked.length,
    topSimilarity,
    articles: articles.length,
    relatedActs: relatedActs.length,
  });

  return {
    ragHits: reranked,
    excerpts: reranked.map((r) => ({
      id: `${r.sourceType}:${r.documentId}:${r.chunkIndex}`,
      title: r.documentTitle,
      category: r.category,
      similarity: r.similarity,
      snippet: truncate(r.chunkContent, 360),
      url: r.url,
      sourceType: r.sourceType,
    })),
    articles,
    relatedActs,
    layeredContext,
    sources,
    anchorageScore,
    topSimilarity,
  };
}

// ---------- helpers ----------

function buildQuery(def: SectionDefinition, opts: BuildOpts) {
  const base = [
    def.title,
    def.didactic.conceito,
    opts.descricaoLivre,
    opts.contentMd ?? "",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 1200);
  return base;
}

function filterBySourceTypes(
  results: SearchResult[],
  sourceTypes?: Array<PlanningSectionSource["sourceType"]>,
) {
  if (!sourceTypes || sourceTypes.length === 0) return results;
  // lei-article nunca vem do semanticSearch (é montado via legal-context).
  const allow = new Set(sourceTypes.filter((t) => t !== "lei-article"));
  if (allow.size === 0) return results;
  return results.filter((r) => allow.has(r.sourceType));
}

function toPlanningSources(
  hits: SearchResult[],
  legalSources: LegalSource[],
): PlanningSectionSource[] {
  const out: PlanningSectionSource[] = [];

  for (const h of hits) {
    out.push({
      sourceType: h.sourceType,
      id: `${h.sourceType}:${h.documentId}:${h.chunkIndex}`,
      title: h.documentTitle,
      url: h.url,
      similarity: h.similarity,
      snippet: truncate(h.chunkContent, 500),
    });
  }

  for (const ls of legalSources) {
    if (ls.type === "lei-article") {
      out.push({
        sourceType: "lei-article",
        id: `lei-article:${ls.articleNumber}`,
        title: ls.title,
        url: ls.url,
        articleNumber: ls.articleNumber,
      });
    } else {
      // evita duplicar atos que já vieram dos hits vetoriais
      if (out.some((o) => o.title === ls.title)) continue;
      out.push({
        sourceType: "legislative-act",
        id: `legislative-act:${ls.title}`,
        title: ls.title,
        url: ls.url,
      });
    }
  }

  return out;
}

function computeAnchorage(input: {
  hits: number;
  topSimilarity: number;
  articles: number;
  relatedActs: number;
}) {
  if (input.hits === 0 && input.articles === 0 && input.relatedActs === 0) {
    return 0;
  }
  let score = 0;
  if (input.hits >= 3 && input.topSimilarity >= 0.65) score += 0.6;
  else if (input.hits >= 2 && input.topSimilarity >= 0.55) score += 0.45;
  else if (input.hits >= 1) score += 0.25;
  if (input.articles >= 2) score += 0.25;
  else if (input.articles >= 1) score += 0.15;
  if (input.relatedActs >= 1) score += 0.15;
  return Math.min(1, score);
}

function truncate(s: string, max: number) {
  if (!s) return "";
  if (s.length <= max) return s;
  return s.slice(0, max).trimEnd() + "…";
}

export function classifyProvenance(ctx: PlanningSectionContext) {
  if (ctx.anchorageScore >= 0.7) return "RAG_ANCHORED" as const;
  if (ctx.anchorageScore >= 0.35) return "PARTIALLY_ANCHORED" as const;
  return "NOT_ANCHORED" as const;
}
