import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { semanticSearch, buildContextForLLM, formatSources } from '@/lib/embeddings/vector-search';
import { queryGeminiText } from '@/lib/gemini/cached-client';
import { checkRateLimit } from '@/lib/cache/redis-client';

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

interface QueryRequest {
  query: string;
  filters?: QueryFilters;
  maxResults?: number;
  includeContent?: boolean;
  useCache?: boolean;
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
    const isAdmin = authResult.user.role === 'admin';

    // 2. Rate limiting (10 queries per minute for non-admins)
    if (!isAdmin) {
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

    // 5. Determine course access for non-admins
    let allowedCourseId: string | undefined;

    if (!isAdmin) {
      // Get user's enrolled course IDs
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          enrollments: {
            where: {
              OR: [
                { expiresAt: { gte: new Date() } },
                { isLifetime: true },
              ],
            },
            select: {
              courseId: true,
            },
          },
        },
      });

      const enrolledCourseIds = user?.enrollments.map(e => e.courseId) || [];

      // If filter specifies a course, verify access
      if (filters.courseId) {
        if (!enrolledCourseIds.includes(filters.courseId)) {
          return NextResponse.json(
            { success: false, error: 'Not enrolled in this course' },
            { status: 403 }
          );
        }
        allowedCourseId = filters.courseId;
      } else if (enrolledCourseIds.length > 0) {
        // Default to first enrolled course if no filter
        allowedCourseId = enrolledCourseIds[0];
      }
    } else {
      // Admin can access any course
      allowedCourseId = filters.courseId;
    }

    // 6. Perform semantic search using embeddings
    const searchResponse = await semanticSearch(query, {
      courseId: allowedCourseId,
      category: filters.category,
      limit: maxResults,
      threshold: 0.5, // Minimum 50% similarity
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

    // 7. Build context and synthesize answer with Gemini
    const context = buildContextForLLM(searchResponse.results, 6000);

    const synthesisPrompt = `
Voce e um assistente especializado em Licitacoes e Contratos Administrativos (Lei 14.133/2021).
Com base nos documentos abaixo, responda a pergunta do usuario de forma clara e precisa.

DOCUMENTOS RELEVANTES:
${context}

PERGUNTA DO USUARIO:
${query}

INSTRUCOES:
1. Responda baseado APENAS nos documentos fornecidos
2. Cite as fontes quando relevante (ex: "Conforme o Acordao X...")
3. Se os documentos nao contiverem informacao suficiente, diga isso
4. Use linguagem tecnica juridica apropriada
5. Seja conciso mas completo

RESPOSTA:`;

    let synthesizedAnswer: string | undefined;

    try {
      const geminiResult = await queryGeminiText(synthesisPrompt, {
        temperature: 0.3, // Lower for more factual responses
        maxOutputTokens: 1024,
        useCache,
      });
      synthesizedAnswer = geminiResult.response;
    } catch (error) {
      console.error('Error synthesizing answer:', error);
      // Continue without synthesized answer
    }

    // 8. Format results for response
    const results: DocumentResult[] = await Promise.all(
      searchResponse.results.map(async (result) => {
        // Fetch additional document details
        const doc = await prisma.document.findUnique({
          where: { id: result.documentId },
          select: {
            uploadedAt: true,
            tags: true,
            courseId: true,
            isCommon: true,
          },
        });

        // Build courseIds array
        const courseIds = result.isCommon
          ? [] // Common documents don't have specific courseId
          : result.courseId
          ? [result.courseId]
          : [];

        return {
          documentId: result.documentId,
          title: result.documentTitle,
          category: result.category,
          geminiResponse: result.chunkContent, // Most relevant chunk
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

    console.log(`   ✅ Returned ${results.length} results (latency: ${latency}ms, cached: ${searchResponse.cached})`);

    // 9. Return response
    return NextResponse.json<QueryResponse>({
      success: true,
      results,
      totalDocuments: searchResponse.totalFound,
      cached: searchResponse.cached,
      latency,
      query,
      synthesizedAnswer,
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

  // Try to cut at sentence boundary
  const truncated = content.substring(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');

  if (lastPeriod > maxLength * 0.7) {
    return truncated.substring(0, lastPeriod + 1);
  }

  return truncated + '...';
}
