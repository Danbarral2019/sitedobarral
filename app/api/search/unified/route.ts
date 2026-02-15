import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

// ===========================
// Types
// ===========================

interface SearchFilters {
  courseId?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  tags?: string[];
  isPublic?: boolean;
  resultType?: 'document' | 'article' | 'all'; // NEW: Filter by result type
}

interface SearchRequest {
  query: string;
  filters?: SearchFilters;
  maxResults?: number;
}

// Base result interface with common fields
interface BaseSearchResult {
  resultType: 'document' | 'article';
  id: string;
  title: string;
  description: string;
  relevance: number;
  url: string;
}

// Document-specific result
interface DocumentSearchResult extends BaseSearchResult {
  resultType: 'document';
  category: string;
  isPublic: boolean;
  uploadedAt: string;
  tags?: string[];
  courseIds?: string[];
}

// Article-specific result
interface ArticleSearchResult extends BaseSearchResult {
  resultType: 'article';
  numero: string;
  capitulo: string;
  secao?: string;
}

type UnifiedSearchResult = DocumentSearchResult | ArticleSearchResult;

interface SearchResponse {
  success: boolean;
  results: UnifiedSearchResult[];
  breakdown: {
    documents: number;
    articles: number;
    total: number;
  };
  query: string;
  latency: number;
  error?: string;
}

// ===========================
// Helper Functions
// ===========================

/**
 * Parse tags from JSON or CSV format
 */
function parseTags(tagsField: string | null): string[] {
  if (!tagsField) return [];

  try {
    return JSON.parse(tagsField);
  } catch {
    return tagsField.split(',').map(t => t.trim());
  }
}

/**
 * Calculate basic relevance score based on keyword matching
 */
function calculateRelevance(text: string, query: string): number {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const queryWords = lowerQuery.split(' ').filter(w => w.length > 2);

  let score = 0;

  // Exact phrase match = +50
  if (lowerText.includes(lowerQuery)) {
    score += 50;
  }

  // Count matching words
  const matchingWords = queryWords.filter(word => lowerText.includes(word));
  const wordMatchRatio = matchingWords.length / Math.max(queryWords.length, 1);
  score += wordMatchRatio * 40;

  // Bonus for title matches
  const titleWords = text.substring(0, 200).toLowerCase();
  if (titleWords.includes(lowerQuery)) {
    score += 10;
  }

  return Math.min(score, 100);
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

    const userEmail = authResult.user.email;
    const isAdmin = authResult.user.role === 'admin';

    // 2. Parse request body
    const body: SearchRequest = await req.json();
    const {
      query,
      filters = {},
      maxResults = 10,
    } = body;

    // 3. Validate query
    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        {
          success: false,
          error: 'Query must be at least 2 characters long'
        },
        { status: 400 }
      );
    }

    if (maxResults < 1 || maxResults > 50) {
      return NextResponse.json(
        {
          success: false,
          error: 'maxResults must be between 1 and 50'
        },
        { status: 400 }
      );
    }

    console.log(`🔍 Unified search from ${userEmail}: "${query}"`);
    console.log(`   Filters:`, filters);

    const resultType = filters.resultType || 'all';
    const shouldSearchDocuments = resultType === 'all' || resultType === 'document';
    const shouldSearchArticles = resultType === 'all' || resultType === 'article';

    // 4. Search Documents (if enabled)
    let documentResults: DocumentSearchResult[] = [];

    if (shouldSearchDocuments) {
      const documentWhere: Record<string, unknown> = {};

      // Apply filters
      if (filters.courseId) {
        documentWhere.OR = [
          { courseId: filters.courseId },
          { isCommon: true },
        ];
      }

      if (filters.category) {
        documentWhere.category = filters.category;
      }

      if (filters.dateFrom || filters.dateTo) {
        const uploadedAtFilter: Record<string, Date> = {};
        if (filters.dateFrom) {
          uploadedAtFilter.gte = new Date(filters.dateFrom);
        }
        if (filters.dateTo) {
          uploadedAtFilter.lte = new Date(filters.dateTo);
        }
        documentWhere.uploadedAt = uploadedAtFilter;
      }

      // Public/private filter (non-admins can only see public or their enrolled courses)
      if (!isAdmin) {
        if (filters.isPublic !== undefined) {
          documentWhere.isPublic = filters.isPublic;
        } else {
          // Get user's enrolled course IDs
          const user = await prisma.user.findUnique({
            where: { email: userEmail },
            select: {
              enrollments: {
                where: {
                  expiresAt: {
                    gte: new Date(), // Not expired
                  },
                },
                select: {
                  courseId: true,
                },
              },
            },
          });

          const enrolledCourseIds = user?.enrollments.map(e => e.courseId) || [];

          // Show public documents + documents from enrolled courses + common documents
          documentWhere.OR = [
            { isPublic: true },
            { isCommon: true },
            ...(enrolledCourseIds.length > 0
              ? [{ courseId: { in: enrolledCourseIds } }]
              : []),
          ];
        }
      }

      // Text search across multiple fields
      documentWhere.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { content: { contains: query, mode: 'insensitive' } },
      ];

      const documents = await prisma.document.findMany({
        where: documentWhere,
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          url: true,
          isPublic: true,
          uploadedAt: true,
          tags: true,
          courseId: true,
          isCommon: true,
          content: true,
        },
        take: maxResults * 2, // Fetch more for sorting by relevance
      });

      // Map and calculate relevance
      documentResults = documents
        .map(doc => {
          const searchableText = `${doc.title} ${doc.description || ''} ${doc.content || ''}`;
          const relevance = calculateRelevance(searchableText, query);

          // Build courseIds array
          const courseIds = doc.isCommon
            ? []
            : doc.courseId
            ? [doc.courseId]
            : [];

          return {
            resultType: 'document' as const,
            id: doc.id,
            title: doc.title,
            description: doc.description || 'Sem descrição',
            category: doc.category,
            isPublic: doc.isPublic,
            url: doc.url,
            uploadedAt: doc.uploadedAt.toISOString(),
            tags: parseTags(doc.tags),
            courseIds: courseIds.length > 0 ? courseIds : undefined,
            relevance,
          };
        })
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, maxResults);

      console.log(`   📄 Found ${documentResults.length} documents`);
    }

    // 5. Search LeiArticle (if enabled)
    let articleResults: ArticleSearchResult[] = [];

    if (shouldSearchArticles) {
      // Search by article number, title, content (ementa)
      const articles = await prisma.leiArticle.findMany({
        where: {
          OR: [
            { numero: { contains: query, mode: 'insensitive' } },
            { titulo: { contains: query, mode: 'insensitive' } },
            { ementa: { contains: query, mode: 'insensitive' } },
            { capitulo: { contains: query, mode: 'insensitive' } },
            { secao: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          numero: true,
          titulo: true,
          ementa: true,
          capitulo: true,
          secao: true,
        },
        take: maxResults * 2,
      });

      // Map and calculate relevance
      articleResults = articles
        .map(article => {
          const searchableText = `${article.numero} ${article.titulo || ''} ${article.ementa} ${article.capitulo}`;
          const relevance = calculateRelevance(searchableText, query);

          return {
            resultType: 'article' as const,
            id: article.id,
            numero: article.numero,
            title: `Art. ${article.numero}${article.titulo ? ` - ${article.titulo}` : ''}`,
            description: article.ementa.substring(0, 200) + (article.ementa.length > 200 ? '...' : ''),
            capitulo: article.capitulo,
            secao: article.secao || undefined,
            url: `/artigo/${article.numero}`,
            relevance,
          };
        })
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, maxResults);

      console.log(`   ⚖️  Found ${articleResults.length} articles`);
    }

    // 6. Combine and sort all results by relevance
    const allResults: UnifiedSearchResult[] = [
      ...documentResults,
      ...articleResults,
    ]
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, maxResults);

    const latency = Date.now() - startTime;

    console.log(`   ✅ Unified search complete: ${allResults.length} results (${latency}ms)`);

    // 7. Return response
    return NextResponse.json<SearchResponse>({
      success: true,
      results: allResults,
      breakdown: {
        documents: documentResults.length,
        articles: articleResults.length,
        total: allResults.length,
      },
      query,
      latency,
    });

  } catch (error) {
    console.error('❌ Unified search error:', error);

    return NextResponse.json<SearchResponse>(
      {
        success: false,
        results: [],
        breakdown: {
          documents: 0,
          articles: 0,
          total: 0,
        },
        query: '',
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
