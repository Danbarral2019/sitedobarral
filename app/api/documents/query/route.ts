import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { semanticSearch, buildContextForLLM } from '@/lib/embeddings/vector-search';
import type { SearchResult } from '@/lib/embeddings/vector-search';
import { queryGeminiText } from '@/lib/gemini/cached-client';
import { checkRateLimit } from '@/lib/cache/redis-client';
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

    if (maxResults < 1 || maxResults > 20) {
      return NextResponse.json(
        {
          success: false,
          error: 'maxResults must be between 1 and 20'
        },
        { status: 400 }
      );
    }

    console.log(`🔍 Query from user ${userId}: "${query}"`);
    console.log(`   Filters:`, filters);

    // 5. Perform semantic search using embeddings
    // Busca mais resultados para compensar separação por tipo
    const searchResponse = await semanticSearch(query, {
      category: filters.category,
      limit: Math.max(maxResults, 10),
      threshold: 0.45,
      useCache,
      includeChunkContent: true,
    });

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

    // 6. Separate results by type
    const leiResults = searchResponse.results.filter(r => r.category === 'lei-artigo');
    const actResults = searchResponse.results.filter(r => r.category === 'ato-normativo');
    const docResults = searchResponse.results.filter(
      r => !['lei-artigo', 'ato-normativo'].includes(r.category)
    );

    console.log(`   📜 Lei: ${leiResults.length}, Atos: ${actResults.length}, Docs: ${docResults.length}`);

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
    const alreadyFoundActTitles = actResults.map(r => r.documentTitle);
    const allCitedArticles = [...new Set([...citedArticles, ...leiResultArticleNums])];
    const extraActs = await findRelatedActs(allCitedArticles, alreadyFoundActTitles, 3);

    // Build acts context
    const semanticActsContext = buildContextForLLM(actResults, 1500);
    const extraActsFormatted = formatActsContext(extraActs, 1000);
    const fullActsContext = [semanticActsContext, extraActsFormatted].filter(Boolean).join('\n\n');

    // Build docs context
    const docsContext = buildContextForLLM(docResults, 3000);

    // 9. Build layered context
    const fullContext = buildLayeredContext(fullLeiContext, fullActsContext, docsContext, 8000);

    // 10. Build conversation history context
    let historyContext = '';
    if (conversationHistory && conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-5);
      historyContext = '\nHISTÓRICO DA CONVERSA:\n' +
        recentHistory.map(m =>
          `${m.role === 'user' ? 'USUÁRIO' : 'ASSISTENTE'}: ${m.content.slice(0, 300)}`
        ).join('\n') + '\n';
    }

    // 11. Synthesize answer with enhanced prompt
    const synthesisPrompt = `Você é um assistente especializado em Licitações e Contratos Administrativos (Lei 14.133/2021).

${fullContext}
${historyContext}
PERGUNTA DO USUÁRIO:
${query}

INSTRUÇÕES:
1. Comece pela fundamentação legal (artigos da Lei 14.133/2021) quando houver preceitos legais relevantes
2. Cite atos normativos regulamentadores quando relevantes
3. Reforce com jurisprudência e documentos técnicos
4. Use linguagem técnica jurídica e cite fontes com precisão (ex: "Conforme o Art. 75 da Lei 14.133...", "O Decreto nº X regulamenta...")
5. Seja conciso mas completo
6. Se os documentos não contiverem informação suficiente, diga isso

RESPOSTA:`;

    let synthesizedAnswer: string | undefined;

    try {
      const geminiResult = await queryGeminiText(synthesisPrompt, {
        temperature: 0.3,
        maxOutputTokens: 1024,
        useCache,
      });
      synthesizedAnswer = geminiResult.response;
    } catch (error) {
      console.error('Error synthesizing answer:', error);
    }

    // 12. Build legal sources for response
    const allLeiArticleNums = [...new Set([...leiResultArticleNums, ...missingArticles])];
    const allActsForSources = [
      ...actResults.map(r => ({ title: r.documentTitle, url: r.url || '' })),
      ...extraActs.map(a => ({ title: a.title, url: a.url })),
    ];
    const legalSources = buildLegalSources(allLeiArticleNums, allActsForSources);

    // 13. Format results for response (only docs, not lei/acts which go in legalSources)
    const allDisplayResults = [...docResults, ...leiResults, ...actResults]
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxResults);

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
