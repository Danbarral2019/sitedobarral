import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { semanticSearch, multiQuerySearch, buildContextForLLM } from '@/lib/embeddings/vector-search';
import type { SearchResult } from '@/lib/embeddings/vector-search';
import { queryGeminiText } from '@/lib/gemini/cached-client';
import { checkRateLimit, withCache, CACHE_TTL } from '@/lib/cache/redis-client';
import { trackServerEvent } from '@/lib/monitoring/events';
import {
  extractCitedArticles,
  buildLeiContext,
  findRelatedActs,
  buildLayeredContext,
  formatActsContext,
  buildLegalSources,
  type LegalSource,
} from '@/lib/legal-context';

// ===========================
// Types
// ===========================

interface QueryFilters {
  courseId?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  tags?: string[];
  isPublic?: boolean;
  ticMode?: boolean;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface QueryRequest {
  query: string;
  filters?: QueryFilters;
  maxResults?: number;
  includeContent?: boolean;
  useCache?: boolean;
  conversationHistory?: ConversationMessage[];
}

interface DocumentResult {
  documentId: string;
  title: string;
  category: string;
  geminiResponse: string;
  relevance: number;
  excerpt: string;
  url?: string;
  uploadedAt: string;
  tags?: string[];
  courseIds?: string[];
}

interface QueryResponse {
  success: boolean;
  results: DocumentResult[];
  totalDocuments: number;
  cached: boolean;
  latency: number;
  query: string;
  error?: string;
  synthesizedAnswer?: string;
  legalSources?: LegalSource[];
}

// ===========================
// Main Handler
// ===========================

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Verify authentication
    const authResult = await verifyAuth(req);

    if (!authResult.valid || !authResult.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = authResult.user.userId;

    // 2. Rate limiting (10 queries per minute for non-admins)
    if (authResult.user.role !== 'admin') {
      const rateLimitKey = `query-rate-limit:${userId}`;
      const rateLimitResult = await checkRateLimit(rateLimitKey, 10, 60);

      if (!rateLimitResult.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: 'Rate limit exceeded. Maximum 10 queries per minute.'
          },
          { status: 429 }
        );
      }
    }

    // 3. Parse request body
    const body: QueryRequest = await req.json();
    const {
      query,
      filters = {},
      maxResults = 5,
      useCache = true,
      conversationHistory,
    } = body;

    // 4. Validate query
    if (!query || query.trim().length < 3) {
      return NextResponse.json(
        {
          success: false,
          error: 'Query must be at least 3 characters long'
        },
        { status: 400 }
      );
    }

    if (maxResults < 1 || maxResults > 40) {
      return NextResponse.json(
        {
          success: false,
          error: 'maxResults must be between 1 and 40'
        },
        { status: 400 }
      );
    }

    // 4b. Enrich query with conversation context for better semantic retrieval
    let semanticQuery = query;
    if (conversationHistory && conversationHistory.length > 0) {
      const previousUserQueries = conversationHistory
        .filter(m => m.role === 'user')
        .map(m => m.content);
      if (previousUserQueries.length > 0) {
        // Combine the original topic with the refinement query
        // e.g. "diálogo competitivo" + "algum acórdão do TCU sobre esse assunto"
        semanticQuery = `${previousUserQueries[previousUserQueries.length - 1]} ${query}`;
      }
    }

    // 4c. TIC mode: enrich query with TIC context
    if (filters.ticMode) {
      semanticQuery = `No âmbito de contratações de TIC (Tecnologia da Informação e Comunicação) pela Administração Pública Federal, conforme INs e Portarias da SGD/MGI: ${semanticQuery}`;
    }

    console.log(`🔍 Query from user ${userId}: "${query}"`);
    if (semanticQuery !== query) {
      console.log(`   🔗 Enhanced query with context: "${semanticQuery}"`);
    }
    if (filters.ticMode) {
      console.log(`   🖥️ TIC mode ativado`);
    }
    console.log(`   Filters:`, filters);

    // 5. Query expansion: generate alternative queries for better recall
    let expandedQueries: string[] = [semanticQuery];
    try {
      const expansionCacheKey = `query-expansion:${hashQueryStr(semanticQuery)}`;
      const expanded = await withCache(
        expansionCacheKey,
        async () => {
          const expansionPrompt = `Você é um especialista em Direito Administrativo e Licitações (Lei 14.133/2021).
Gere 2 variações da pergunta abaixo usando sinônimos jurídicos e termos técnicos alternativos.
Responda APENAS com um JSON array de strings, sem texto adicional.

Pergunta: "${semanticQuery}"

Exemplo de resposta: ["variação 1", "variação 2"]`;

          const result = await queryGeminiText(expansionPrompt, {
            temperature: 0.5,
            maxOutputTokens: 256,
            useCache: false,
          });

          let parsed: string[] = [];
          try {
            let text = result.response.trim();
            if (text.includes('```json')) text = text.split('```json')[1].split('```')[0].trim();
            else if (text.includes('```')) text = text.split('```')[1].split('```')[0].trim();
            parsed = JSON.parse(text);
          } catch { /* ignore parse errors */ }

          return Array.isArray(parsed) ? parsed.slice(0, 2) : [];
        },
        CACHE_TTL.GEMINI_QUERY
      );
      if (expanded.length > 0) {
        expandedQueries = [semanticQuery, ...expanded];
        console.log(`   🔄 Query expansion: ${expandedQueries.length} queries`);
      }
    } catch (err) {
      console.warn('   ⚠️ Query expansion failed:', err instanceof Error ? err.message : err);
    }

    // 5a. Perform semantic search using embeddings (multi-query if expanded)
    // Busca mais resultados para garantir diversidade de categorias
    let searchResponse: Awaited<ReturnType<typeof semanticSearch>>;

    if (expandedQueries.length > 1) {
      const multiResults = await multiQuerySearch(expandedQueries, {
        category: filters.category,
        excludeCategories: ['boa_pratica'],
        limit: Math.max(maxResults * 5, 60),
        threshold: 0.40,
        useCache,
        includeChunkContent: true,
      });
      searchResponse = {
        results: multiResults,
        query: semanticQuery,
        totalFound: multiResults.length,
        latency: 0,
        cached: false,
      };
    } else {
      searchResponse = await semanticSearch(semanticQuery, {
        category: filters.category,
        excludeCategories: ['boa_pratica'],
        limit: Math.max(maxResults * 5, 60),
        threshold: 0.40,
        useCache,
        includeChunkContent: true,
      });
    }

    console.log(`   📄 Found ${searchResponse.results.length} relevant documents`);

    if (searchResponse.results.length === 0) {
      return NextResponse.json<QueryResponse>({
        success: true,
        results: [],
        totalDocuments: 0,
        cached: searchResponse.cached,
        latency: Date.now() - startTime,
        query,
      });
    }

    // 5b. Complementary search: find priority sources (enunciados, ONs, apostilas) by leiArticles
    // These may not appear in semantic search due to volume of acórdãos
    const semanticDocIds = new Set(searchResponse.results.map(r => r.documentId));
    const citedArticlesFromSemantic = extractCitedArticles(
      searchResponse.results as Array<SearchResult & { leiArticles?: string | null }>
    );

    let complementaryResults: SearchResult[] = [];
    if (citedArticlesFromSemantic.length > 0) {
      // Use exact JSON match: '"23"' matches ["23","75"] but not ["123","456"]
      const exactArticleMatches = citedArticlesFromSemantic.slice(0, 12).map(art => ({
        leiArticles: { contains: `"${art}"` },
      }));

      // Also search by description/content keywords from the query
      const queryKeywords = query.split(/\s+/).filter(w => w.length >= 4);
      const keywordMatches = queryKeywords.map(kw => ({
        description: { contains: kw, mode: 'insensitive' as const },
      }));

      const priorityDocs = await prisma.document.findMany({
        where: {
          category: { in: ['enunciados', 'orientacao-normativa', 'apostila', 'conteudo-programatico'] },
          id: { notIn: [...semanticDocIds] },
          OR: [...exactArticleMatches, ...keywordMatches],
        },
        select: {
          id: true,
          title: true,
          category: true,
          description: true,
          url: true,
          courseId: true,
          isCommon: true,
          tags: true,
          leiArticles: true,
        },
        // No take limit — we fetch all candidates and rank by relevance scoring
      });

      // Rank complementary results: docs mentioning query keywords in description score higher
      const queryLower = query.toLowerCase();
      const scoredDocs = priorityDocs.map(doc => {
        let score = 0.50;
        const desc = (doc.description || '').toLowerCase();
        // Boost if description contains query keywords
        for (const kw of queryKeywords) {
          if (desc.includes(kw.toLowerCase())) score += 0.05;
        }
        // Boost if description contains full query phrase
        if (desc.includes(queryLower)) score += 0.10;
        // Boost enunciados/apostilas slightly over ONs
        if (['enunciados', 'apostila'].includes(doc.category)) score += 0.02;
        return { doc, score: Math.min(score, 0.70) };
      });

      // Sort by score descending, take top results (scaled with maxResults)
      scoredDocs.sort((a, b) => b.score - a.score);

      complementaryResults = scoredDocs.slice(0, Math.ceil(maxResults / 2)).map(({ doc, score }) => ({
        documentId: doc.id,
        documentTitle: doc.title,
        category: doc.category,
        similarity: score,
        chunkContent: doc.description || doc.title,
        chunkIndex: 0,
        url: doc.url || undefined,
        courseId: doc.courseId || undefined,
        isCommon: doc.isCommon,
        tags: doc.tags ? JSON.parse(doc.tags) : undefined,
        leiArticles: doc.leiArticles,
        sourceType: 'document' as const,
      }));

      console.log(`   🔍 Complementary priority sources: ${complementaryResults.length} (from ${priorityDocs.length} candidates)`);
    }

    // 6. Separate results by type
    const allResults = [...searchResponse.results, ...complementaryResults];
    const leiResults = allResults.filter(r => r.category === 'lei-artigo');
    const actResults = allResults.filter(r => r.category === 'ato-normativo');
    // Semantic legislative acts from LegislativeActChunk (via UNION ALL)
    const semanticLegActResults = allResults.filter(r => r.sourceType === 'legislative-act');
    const rawDocResults = allResults.filter(
      r => !['lei-artigo', 'ato-normativo'].includes(r.category) && r.sourceType !== 'legislative-act'
    );

    // Diversify doc results with priority tiers
    const docResults = diversifyResults(rawDocResults, maxResults);

    // Cap semantic legislative acts: top 3 per act type to avoid flooding
    const legActsByType = new Map<string, typeof semanticLegActResults>();
    for (const act of semanticLegActResults) {
      const arr = legActsByType.get(act.category) || [];
      arr.push(act);
      legActsByType.set(act.category, arr);
    }
    const cappedLegActs: typeof semanticLegActResults = [];
    for (const [, acts] of legActsByType) {
      cappedLegActs.push(...acts.sort((a, b) => b.similarity - a.similarity).slice(0, 3));
    }

    console.log(`   📜 Lei: ${leiResults.length}, Atos(doc): ${actResults.length}, Atos(semantic): ${cappedLegActs.length}, Docs: ${docResults.length} (raw: ${rawDocResults.length})`);

    // 7. Enrich: extract cited articles from docs and find missing ones
    const citedArticles = extractCitedArticles(
      docResults as Array<SearchResult & { leiArticles?: string | null }>
    );
    const leiResultArticleNums = leiResults.map(r => {
      const match = r.documentTitle.match(/Art\.\s*(\d+[\w-]*)/);
      return match ? match[1] : '';
    }).filter(Boolean);

    const missingArticles = citedArticles.filter(
      n => !leiResultArticleNums.includes(n)
    );

    // Build lei context from semantic results + extra cited articles
    const semanticLeiContext = buildContextForLLM(leiResults, 2000);
    const extraLeiContext = buildLeiContext(missingArticles, 1500);
    const fullLeiContext = [semanticLeiContext, extraLeiContext].filter(Boolean).join('\n\n');

    // 8. Find related legislative acts not already in results
    const alreadyFoundActTitles = [
      ...actResults.map(r => r.documentTitle),
      ...cappedLegActs.map(r => r.documentTitle),
    ];
    const allCitedArticles = [...new Set([...citedArticles, ...leiResultArticleNums])];
    const extraActs = await findRelatedActs(allCitedArticles, alreadyFoundActTitles, 3);

    // Build acts context (includes Document-based acts + semantic LegislativeAct acts)
    const allActContextResults = [...actResults, ...cappedLegActs];
    const semanticActsContext = buildContextForLLM(allActContextResults, 2000);
    const extraActsFormatted = formatActsContext(extraActs, 1000);
    const fullActsContext = [semanticActsContext, extraActsFormatted].filter(Boolean).join('\n\n');

    // Build docs context (increased to fit more diverse results)
    const docsContext = buildContextForLLM(docResults, 10000);

    // 8b. TIC mode: enrich acts context with TIC-specific legislative acts
    let ticActsContext = '';
    if (filters.ticMode) {
      try {
        const ticActs = await prisma.legislativeAct.findMany({
          where: { themes: { contains: '"tic"' } },
          select: { fullNumber: true, ementa: true, officialUrl: true, leiArticles: true },
          orderBy: { hierarchyLevel: 'asc' },
          take: 10,
        });
        if (ticActs.length > 0) {
          ticActsContext = '\nATOS NORMATIVOS DE TIC (SGD/MGI):\n' +
            ticActs.map(act => {
              const arts = act.leiArticles ? JSON.parse(act.leiArticles) : [];
              const artsStr = arts.length > 0 ? ` (Art. ${arts.join(', ')})` : '';
              return `**${act.fullNumber}**${artsStr}\n${act.ementa}`;
            }).join('\n\n');
          console.log(`   🖥️ TIC context: ${ticActs.length} atos normativos adicionados ao contexto`);
        }
      } catch (err) {
        console.warn('   ⚠️ TIC context enrichment failed:', err instanceof Error ? err.message : err);
      }
    }

    // 9. Build layered context (increased from 15000 to 20000 for richer answers)
    const combinedActsContext = ticActsContext
      ? `${fullActsContext}\n\n${ticActsContext}`
      : fullActsContext;
    const fullContext = buildLayeredContext(fullLeiContext, combinedActsContext, docsContext, 20000);

    // 10. Build conversation history context
    let historyContext = '';
    if (conversationHistory && conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-5);
      historyContext = '\nHISTÓRICO DA CONVERSA:\n' +
        recentHistory.map(m =>
          `${m.role === 'user' ? 'USUÁRIO' : 'ASSISTENTE'}: ${m.content.slice(0, 300)}`
        ).join('\n') + '\n';
    }

    // 11. Build legal sources and display results BEFORE prompt (needed for source listing)
    const allLeiArticleNums = [...new Set([...leiResultArticleNums, ...missingArticles])].slice(0, 15);
    const allActsForSources = [
      ...actResults.map(r => ({ title: r.documentTitle, url: r.url || '' })),
      ...cappedLegActs.map(r => ({ title: r.documentTitle, url: r.url || '' })),
      ...extraActs.map(a => ({ title: a.title, url: a.url })),
    ];
    const legalSources = buildLegalSources(allLeiArticleNums, allActsForSources);

    const allDisplayResults = docResults
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxResults);

    // 12. Synthesize answer with enhanced prompt
    const sourcesList = allDisplayResults.map(r => `- ${r.documentTitle} (${r.category})`).join('\n');
    const articlesList = allLeiArticleNums.map(n => `Art. ${n}`).join(', ');

    const synthesisPrompt = `Você é um assistente especializado em Licitações e Contratos Administrativos (Lei 14.133/2021).

${fullContext}
${historyContext}
PERGUNTA DO USUÁRIO:
${query}

FONTES DISPONÍVEIS NO CONTEXTO:
Artigos da Lei 14.133: ${articlesList || 'nenhum'}
Documentos:
${sourcesList || 'nenhum'}

INSTRUÇÕES:
1. Responda de forma completa e estruturada, usando TODAS as fontes relevantes do contexto acima
2. PRIORIDADE DE CITAÇÃO (siga esta ordem):
   a) Materiais do curso (apostilas, infográficos, materiais de apoio) — cite PRIMEIRO se disponíveis
   b) Enunciados de instituições (IBDA, INCP, etc.) e Orientações Normativas da AGU — SEMPRE cite quando pertinentes, são fontes de alto valor
   c) Artigos da Lei 14.133/2021 — cite CADA artigo relevante do contexto
   d) Atos normativos regulamentadores (INs, Decretos)
   e) Acórdãos do TCU e Manual do TCU — cite com número/ano (ex: "Acórdão TCU 1234/2024 - Plenário")
   f) Informativos e Súmulas do TCU — cite com número (ex: "Informativo TCU nº 350", "Súmula TCU nº 247")
   g) Pareceres da AGU (DECOR, Pareceres Vinculantes)
3. Cite enunciados, pareceres, orientações normativas e manuais do contexto — NÃO omita nenhuma fonte relevante
4. Para enunciados, sempre indique o órgão emissor (ex: "Enunciado IBDA nº 7", "Enunciado INCP nº 12")
5. Diferencie fontes normativas VINCULANTES (lei, decreto, súmula vinculante) de fontes DOUTRINÁRIAS (apostilas, manuais) e JURISPRUDENCIAIS (acórdãos, informativos)
6. Use linguagem técnica jurídica com citações precisas (ex: "Conforme o Art. 23 da Lei 14.133...", "O Enunciado nº 7 do INCP dispõe...")
7. Seja completo mas organizado — use parágrafos distintos para cada aspecto
8. Se os documentos não contiverem informação suficiente, diga isso

RESPOSTA:`;

    let synthesizedAnswer: string | undefined;

    try {
      const geminiResult = await queryGeminiText(synthesisPrompt, {
        temperature: 0.3,
        maxOutputTokens: 3000,
        useCache,
      });
      synthesizedAnswer = geminiResult.response;
    } catch (error) {
      console.error('Error synthesizing answer:', error);
    }

    const results: DocumentResult[] = await Promise.all(
      allDisplayResults.map(async (result) => {
        const doc = await prisma.document.findUnique({
          where: { id: result.documentId },
          select: {
            uploadedAt: true,
            tags: true,
            courseId: true,
            isCommon: true,
          },
        });

        const courseIds = result.isCommon
          ? []
          : result.courseId
          ? [result.courseId]
          : [];

        return {
          documentId: result.documentId,
          title: result.documentTitle,
          category: result.category,
          geminiResponse: result.chunkContent,
          relevance: result.similarity,
          excerpt: generateExcerpt(result.chunkContent),
          url: result.url,
          uploadedAt: doc?.uploadedAt?.toISOString() || new Date().toISOString(),
          tags: result.tags,
          courseIds: courseIds.length > 0 ? courseIds : undefined,
        };
      })
    );

    const latency = Date.now() - startTime;

    console.log(`   ✅ Returned ${results.length} results + ${legalSources.length} legal sources (latency: ${latency}ms)`);
    trackServerEvent('ai_search', { resultCount: results.length });

    // 14. Return response
    return NextResponse.json<QueryResponse>({
      success: true,
      results,
      totalDocuments: searchResponse.totalFound,
      cached: searchResponse.cached,
      latency,
      query,
      synthesizedAnswer,
      legalSources: legalSources.length > 0 ? legalSources : undefined,
    });

  } catch (error) {
    console.error('❌ Query error:', error);

    return NextResponse.json<QueryResponse>(
      {
        success: false,
        results: [],
        totalDocuments: 0,
        cached: false,
        latency: Date.now() - startTime,
        query: '',
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// ===========================
// Helper Functions
// ===========================

/**
 * Hash simples para cache key de query expansion
 */
function hashQueryStr(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Diversify results with priority tiers:
 * Tier 1: Professor's materials (apostila, conteudo-programatico, outro, bibliografia, sumula, parecer)
 * Tier 2: Enunciados + ONs AGU (enunciados, orientacao-normativa)
 * Tier 3: Acórdãos TCU + Manual TCU (acordao, manual-tcu)
 * Tier 4: Pareceres AGU (decor, parecer-vinculante)
 *
 * Within each tier, picks best by similarity. Then fills remaining by similarity.
 */
function diversifyResults(results: SearchResult[], maxResults: number): SearchResult[] {
  if (results.length <= maxResults) return results;

  // Priority tiers (lower = higher priority)
  const CATEGORY_TIER: Record<string, number> = {
    'apostila': 1,
    'conteudo-programatico': 1,
    'outro': 1,
    'bibliografia': 1,
    'parecer': 1,
    'enunciados': 2,
    'orientacao-normativa': 2,
    'sumula': 2,
    'acordao': 3,
    'manual-tcu': 3,
    'consulta_tcu': 3,
    'informativo': 3,
    'decor': 4,
    'parecer-vinculante': 4,
  };

  // Per-category caps
  const CATEGORY_CAPS: Record<string, number> = {
    'manual-tcu': 1,
  };
  const DEFAULT_CAP = 3;
  const getCap = (cat: string) => CATEGORY_CAPS[cat] ?? DEFAULT_CAP;
  const getTier = (cat: string) => CATEGORY_TIER[cat] ?? 5;

  const byCategory = new Map<string, SearchResult[]>();
  for (const r of results) {
    const arr = byCategory.get(r.category) || [];
    arr.push(r);
    byCategory.set(r.category, arr);
  }

  const diverse: SearchResult[] = [];
  const usedIds = new Set<string>();
  const categoryCounts = new Map<string, number>();

  // Sort categories by tier priority, then pick best from each
  const sortedCategories = [...byCategory.entries()].sort(
    (a, b) => getTier(a[0]) - getTier(b[0])
  );

  // Phase 1: Best result from each category, in tier order
  for (const [, items] of sortedCategories) {
    if (diverse.length >= maxResults) break;
    diverse.push(items[0]);
    usedIds.add(items[0].documentId);
    categoryCounts.set(items[0].category, 1);
  }

  // Phase 2: Fill remaining slots respecting caps, prioritizing by tier then similarity
  const remaining = results
    .filter(r => !usedIds.has(r.documentId))
    .sort((a, b) => {
      const tierDiff = getTier(a.category) - getTier(b.category);
      if (tierDiff !== 0) return tierDiff;
      return b.similarity - a.similarity;
    });

  for (const r of remaining) {
    if (diverse.length >= maxResults) break;
    const catCount = categoryCounts.get(r.category) || 0;
    if (catCount >= getCap(r.category)) continue;
    diverse.push(r);
    usedIds.add(r.documentId);
    categoryCounts.set(r.category, catCount + 1);
  }

  // Phase 3: If still under maxResults, relax caps by +1
  if (diverse.length < maxResults) {
    for (const r of results) {
      if (diverse.length >= maxResults) break;
      if (usedIds.has(r.documentId)) continue;
      const catCount = categoryCounts.get(r.category) || 0;
      if (catCount >= getCap(r.category) + 1) continue;
      diverse.push(r);
      usedIds.add(r.documentId);
      categoryCounts.set(r.category, catCount + 1);
    }
  }

  return diverse.slice(0, maxResults);
}

/**
 * Generate excerpt from chunk content
 */
function generateExcerpt(content: string, maxLength: number = 200): string {
  if (content.length <= maxLength) {
    return content;
  }

  const truncated = content.substring(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');

  if (lastPeriod > maxLength * 0.7) {
    return truncated.substring(0, lastPeriod + 1);
  }

  return truncated + '...';
}
