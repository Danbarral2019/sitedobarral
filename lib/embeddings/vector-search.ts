/**
 * Vector Search para Busca Semantica
 *
 * Busca por similaridade coseno usando pgvector no PostgreSQL
 */

import { prisma } from '@/lib/prisma';
import { generateQueryEmbedding, embeddingToSql } from './gemini-embeddings';
import { withCache, CACHE_TTL } from '@/lib/cache/redis-client';

// ===========================
// Types
// ===========================

export interface SearchResult {
  documentId: string;
  documentTitle: string;
  category: string;
  chunkContent: string;
  chunkIndex: number;
  similarity: number; // 0-1 (1 = identico)
  url?: string;
  courseId?: string;
  isCommon: boolean;
  tags?: string[];
  leiArticles?: string | null;
  uploadedAt?: string;
  sourceType: 'document' | 'legislative-act'; // Tipo de fonte
}

export interface SearchOptions {
  courseId?: string;      // Filtrar por curso
  category?: string;      // Filtrar por categoria
  excludeCategories?: string[];  // Categories to exclude from results
  limit?: number;         // Numero maximo de resultados (default: 5)
  threshold?: number;     // Similaridade minima (0-1, default: 0.5)
  useCache?: boolean;     // Usar cache (default: true)
  includeChunkContent?: boolean; // Incluir conteudo do chunk (default: true)
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
  totalFound: number;
  latency: number;
  cached: boolean;
}

// ===========================
// Main Search Function
// ===========================

/**
 * Busca semantica por similaridade
 *
 * @param query - Texto da pergunta/busca
 * @param options - Opcoes de busca
 * @returns Resultados ordenados por relevancia
 */
export async function semanticSearch(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResponse> {
  const startTime = Date.now();

  const {
    courseId,
    category,
    limit = 5,
    threshold = 0.5,
    useCache = true,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    includeChunkContent = true,
  } = options;

  // Valida query
  if (!query || query.trim().length < 3) {
    return {
      results: [],
      query,
      totalFound: 0,
      latency: Date.now() - startTime,
      cached: false,
    };
  }

  // Cache key baseado na query e opcoes
  const cacheKey = `vector-search:${hashQuery(query)}:${courseId || 'all'}:${category || 'all'}:${limit}:${threshold}:${(options.excludeCategories || []).join(',')}`;

  // Tenta usar cache
  if (useCache) {
    const cachedResult = await withCache(
      cacheKey,
      async () => performSearch(query, options),
      CACHE_TTL.SEARCH_RESULTS
    );

    return {
      ...cachedResult,
      latency: Date.now() - startTime,
      cached: Date.now() - startTime < 500, // Provavelmente cache se < 500ms
    };
  }

  // Sem cache
  const results = await performSearch(query, options);

  return {
    ...results,
    latency: Date.now() - startTime,
    cached: false,
  };
}

// ===========================
// Core Search Implementation
// ===========================

/**
 * Executa a busca vetorial
 */
async function performSearch(
  query: string,
  options: SearchOptions
): Promise<Omit<SearchResponse, 'latency' | 'cached'>> {
  const {
    limit = 5,
    threshold: requestedThreshold,
  } = options;

  // Threshold dinâmico: tenta do mais restritivo ao mais permissivo
  const thresholds = requestedThreshold
    ? [requestedThreshold]
    : [0.55, 0.45, 0.35];

  for (const threshold of thresholds) {
    const result = await executeVectorSearch(query, { ...options, threshold });
    if (result.results.length >= Math.min(limit, 3)) {
      return result;
    }
    // Se já encontrou algo com o threshold mais baixo, retorna o que tem
    if (threshold === thresholds[thresholds.length - 1] && result.results.length > 0) {
      return result;
    }
  }

  // Fallback: retorna o que tiver com threshold mais baixo
  return executeVectorSearch(query, { ...options, threshold: 0.30 });
}

/**
 * Executa a busca vetorial com um threshold específico
 */
async function executeVectorSearch(
  query: string,
  options: SearchOptions & { threshold: number }
): Promise<Omit<SearchResponse, 'latency' | 'cached'>> {
  const {
    courseId,
    category,
    limit = 5,
    threshold,
    includeChunkContent = true,
  } = options;

  // 1. Gera embedding da query
  const { embedding } = await generateQueryEmbedding(query);
  const embeddingStr = embeddingToSql(embedding);

  // 2. Constroi filtros SQL com parâmetros posicionais (previne SQL injection)
  const params: unknown[] = [];
  let paramIndex = 1;

  let whereClause = `d."embeddingStatus" = 'completed'`;

  if (courseId) {
    whereClause += ` AND (d."courseId" = $${paramIndex} OR d."isCommon" = true)`;
    params.push(courseId);
    paramIndex++;
  }

  if (category) {
    whereClause += ` AND d."category" = $${paramIndex}`;
    params.push(category);
    paramIndex++;
  }

  const excludeCategories = options.excludeCategories || [];
  if (excludeCategories.length > 0) {
    const placeholders = excludeCategories.map((c) => {
      const ph = `$${paramIndex}`;
      params.push(c);
      paramIndex++;
      return ph;
    });
    whereClause += ` AND d."category" NOT IN (${placeholders.join(', ')})`;
  }

  // Parâmetros para threshold e limit (usados em ambos os CTEs)
  const thresholdParamIdx = paramIndex;
  params.push(threshold);
  paramIndex++;

  const docLimitParamIdx = paramIndex;
  params.push(limit * 2);
  paramIndex++;

  const actThresholdParamIdx = paramIndex;
  params.push(threshold);
  paramIndex++;

  const actLimitParamIdx = paramIndex;
  params.push(limit * 2);
  paramIndex++;

  const finalLimitParamIdx = paramIndex;
  params.push(limit * 3);
  paramIndex++;

  // 3. Executa busca vetorial com pgvector (UNION ALL: DocumentChunk + LegislativeActChunk)
  // Usa <=> para distancia coseno (1 - similaridade)
  // Ordena por similaridade (menor distancia = mais similar)
  // embeddingStr é gerado internamente pelo Gemini, seguro para inline
  const results = await prisma.$queryRawUnsafe<Array<{
    document_id: string;
    document_title: string;
    category: string;
    chunk_content: string;
    chunk_index: number;
    similarity: number;
    url: string | null;
    course_id: string | null;
    is_common: boolean;
    tags: string | null;
    lei_articles: string | null;
    source_type: string;
    uploaded_at: string | null;
  }>>(
    `
    WITH doc_scores AS (
      SELECT
        d.id as document_id,
        d.title as document_title,
        d.category,
        c.content as chunk_content,
        c."chunkIndex" as chunk_index,
        1 - (c.embedding <=> '${embeddingStr}'::vector) as similarity,
        d.url,
        d."courseId" as course_id,
        d."isCommon" as is_common,
        d.tags,
        d."leiArticles" as lei_articles,
        'document' as source_type,
        d."uploadedAt" as uploaded_at
      FROM "DocumentChunk" c
      JOIN "Document" d ON c."documentId" = d.id
      WHERE ${whereClause}
    ),
    act_scores AS (
      SELECT
        la.id as document_id,
        la."fullNumber" as document_title,
        la.type as category,
        lc.content as chunk_content,
        lc."chunkIndex" as chunk_index,
        1 - (lc.embedding <=> '${embeddingStr}'::vector) as similarity,
        la."officialUrl" as url,
        NULL as course_id,
        true as is_common,
        la.themes as tags,
        la."leiArticles" as lei_articles,
        'legislative-act' as source_type,
        la."publishedAt" as uploaded_at
      FROM "LegislativeActChunk" lc
      JOIN "LegislativeAct" la ON lc."legislativeActId" = la.id
      WHERE la."embeddingStatus" = 'completed'
    )
    SELECT * FROM (
      (SELECT * FROM doc_scores WHERE similarity >= $${thresholdParamIdx} ORDER BY similarity DESC LIMIT $${docLimitParamIdx})
      UNION ALL
      (SELECT * FROM act_scores WHERE similarity >= $${actThresholdParamIdx} ORDER BY similarity DESC LIMIT $${actLimitParamIdx})
    ) combined
    ORDER BY similarity DESC
    LIMIT $${finalLimitParamIdx}
    `,
    ...params
  );

  // 4. Agrupa por documento com multi-chunk (até 3 chunks dos top docs)
  const documentChunks = new Map<string, typeof results>();

  for (const row of results) {
    const docId = row.document_id;
    const chunks = documentChunks.get(docId) || [];
    chunks.push(row);
    documentChunks.set(docId, chunks);
  }

  const documentMap = new Map<string, SearchResult>();

  for (const [docId, chunks] of documentChunks) {
    // Ordena chunks por similaridade e depois por índice (adjacência)
    const sorted = chunks.sort((a, b) => b.similarity - a.similarity);
    const bestChunk = sorted[0];

    // Para os top-5 documentos por similaridade, concatena até 3 chunks
    // Para os demais, usa apenas o melhor chunk
    let combinedContent = includeChunkContent ? bestChunk.chunk_content : '';

    if (includeChunkContent && sorted.length > 1) {
      // Pega até 3 chunks, priorizando adjacentes ao melhor
      const selectedChunks = [bestChunk];
      const usedIndices = new Set([bestChunk.chunk_index]);

      // Primeiro, tenta chunks adjacentes (index ± 1)
      for (const chunk of sorted) {
        if (selectedChunks.length >= 3) break;
        if (usedIndices.has(chunk.chunk_index)) continue;
        if (Math.abs(chunk.chunk_index - bestChunk.chunk_index) <= 1) {
          selectedChunks.push(chunk);
          usedIndices.add(chunk.chunk_index);
        }
      }
      // Depois, completa com os mais relevantes restantes
      for (const chunk of sorted) {
        if (selectedChunks.length >= 3) break;
        if (usedIndices.has(chunk.chunk_index)) continue;
        selectedChunks.push(chunk);
        usedIndices.add(chunk.chunk_index);
      }

      // Concatena na ordem do documento (por chunkIndex)
      selectedChunks.sort((a, b) => a.chunk_index - b.chunk_index);
      combinedContent = selectedChunks.map(c => c.chunk_content).join('\n\n');
    }

    documentMap.set(docId, {
      documentId: docId,
      documentTitle: bestChunk.document_title,
      category: bestChunk.category,
      chunkContent: combinedContent,
      chunkIndex: bestChunk.chunk_index,
      similarity: bestChunk.similarity,
      url: bestChunk.url || undefined,
      courseId: bestChunk.course_id || undefined,
      isCommon: bestChunk.is_common,
      tags: bestChunk.tags ? safeParseArray(bestChunk.tags) : undefined,
      leiArticles: bestChunk.lei_articles,
      uploadedAt: bestChunk.uploaded_at ? new Date(bestChunk.uploaded_at).toISOString() : undefined,
      sourceType: bestChunk.source_type as 'document' | 'legislative-act',
    });
  }

  // 5. Converte para array e limita resultados
  const searchResults = Array.from(documentMap.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return {
    results: searchResults,
    query,
    totalFound: searchResults.length,
  };
}

// ===========================
// Specialized Search Functions
// ===========================

/**
 * Busca documentos relacionados a um documento especifico
 */
export async function findRelatedDocuments(
  documentId: string,
  limit: number = 5
): Promise<SearchResult[]> {
  // Busca o primeiro chunk do documento para usar como query
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      extractedText: true,
      courseId: true,
    },
  });

  if (!document?.extractedText) {
    return [];
  }

  // Usa os primeiros 500 caracteres como query
  const queryText = document.extractedText.slice(0, 500);

  const response = await semanticSearch(queryText, {
    courseId: document.courseId || undefined,
    limit: limit + 1, // +1 para excluir o proprio documento
    threshold: 0.6,
  });

  // Remove o proprio documento dos resultados
  return response.results.filter(r => r.documentId !== documentId);
}

/**
 * Busca por artigo da Lei 14.133
 */
export async function searchByLeiArticle(
  articleNumber: string,
  query: string,
  limit: number = 5
): Promise<SearchResponse> {
  // Adiciona contexto do artigo na query
  const enrichedQuery = `Art. ${articleNumber} da Lei 14.133/2021: ${query}`;

  return semanticSearch(enrichedQuery, {
    limit,
    threshold: 0.5,
  });
}

/**
 * Busca multi-query (combina resultados de varias queries)
 */
export async function multiQuerySearch(
  queries: string[],
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const allResults: SearchResult[] = [];
  const seenDocuments = new Set<string>();

  // Executa todas as queries em paralelo
  const responses = await Promise.all(
    queries.map(query => semanticSearch(query, {
      ...options,
      limit: (options.limit || 5) * 2,
    }))
  );

  for (const response of responses) {
    for (const result of response.results) {
      if (!seenDocuments.has(result.documentId)) {
        seenDocuments.add(result.documentId);
        allResults.push(result);
      } else {
        // Manter maior similaridade
        const existing = allResults.find(r => r.documentId === result.documentId);
        if (existing && result.similarity > existing.similarity) {
          existing.similarity = result.similarity;
          existing.chunkContent = result.chunkContent;
        }
      }
    }
  }

  // Ordena por maior similaridade e limita
  return allResults
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, options.limit || 5);
}

// ===========================
// Context Builder for LLM
// ===========================

/**
 * Constroi contexto para enviar ao LLM
 */
export function buildContextForLLM(
  results: SearchResult[],
  maxLength: number = 8000
): string {
  let context = '';

  for (const result of results) {
    const yearStr = result.uploadedAt ? ` | Ano: ${new Date(result.uploadedAt).getFullYear()}` : '';
    const source = `[${result.documentTitle}] (${Math.round(result.similarity * 100)}% relevância${yearStr})`;
    const chunk = result.chunkContent;

    const entry = `${source}\n${chunk}\n\n---\n\n`;

    if (context.length + entry.length > maxLength) {
      break;
    }

    context += entry;
  }

  return context.trim();
}

/**
 * Formata fontes para citacao
 */
export function formatSources(results: SearchResult[]): Array<{
  title: string;
  relevance: number;
  url?: string;
  category: string;
}> {
  return results.map(r => ({
    title: r.documentTitle,
    relevance: Math.round(r.similarity * 100),
    url: r.url,
    category: r.category,
  }));
}

// ===========================
// Helper Functions
// ===========================

/**
 * Hash simples para cache key
 */
function hashQuery(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Parse seguro de array JSON ou CSV
 */
function safeParseArray(value: string | null): string[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Tenta como CSV
    return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }
}

// ===========================
// Export
// ===========================

const vectorSearch = {
  semanticSearch,
  findRelatedDocuments,
  searchByLeiArticle,
  multiQuerySearch,
  buildContextForLLM,
  formatSources,
};
export default vectorSearch;
