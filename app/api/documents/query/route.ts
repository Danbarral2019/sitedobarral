import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { queryGeminiWithFile, queryMultipleFiles } from '@/lib/gemini/cached-client';
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
}

// ===========================
// Helper Functions
// ===========================

/**
 * Calculate relevance score based on Gemini response quality
 * Simple heuristic: longer responses = more relevant
 */
function calculateRelevance(response: string, query: string): number {
  const responseLength = response.length;
  const queryWords = query.toLowerCase().split(' ');

  // Check how many query words appear in response
  const matchingWords = queryWords.filter(word =>
    response.toLowerCase().includes(word)
  ).length;

  const wordMatchScore = matchingWords / queryWords.length;
  const lengthScore = Math.min(responseLength / 500, 1); // Cap at 500 chars

  // Combined score (weighted average)
  return (wordMatchScore * 0.7 + lengthScore * 0.3);
}

/**
 * Generate excerpt from Gemini response
 */
function generateExcerpt(response: string, maxLength: number = 200): string {
  if (response.length <= maxLength) {
    return response;
  }

  // Try to cut at sentence boundary
  const truncated = response.substring(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');

  if (lastPeriod > maxLength * 0.7) {
    return truncated.substring(0, lastPeriod + 1);
  }

  return truncated + '...';
}

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

    // 2. Rate limiting (10 queries per minute for non-admins)
    if (!isAdmin) {
      const rateLimitKey = `query-rate-limit:${userEmail}`;
      const allowed = await checkRateLimit(rateLimitKey, 10, 60);

      if (!allowed) {
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
      includeContent = false,
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

    console.log(`🔍 Query from ${userEmail}: "${query}"`);
    console.log(`   Filters:`, filters);

    // 5. Build database query with filters
    const whereClause: any = {
      geminiIndexed: true,
      geminiFileId: { not: null },
    };

    // Apply filters
    if (filters.courseId) {
      whereClause.OR = [
        { courseId: filters.courseId },
        { isCommon: true }, // Common documents are available to all courses
      ];
    }

    if (filters.category) {
      whereClause.category = filters.category;
    }

    if (filters.dateFrom || filters.dateTo) {
      whereClause.uploadedAt = {};
      if (filters.dateFrom) {
        whereClause.uploadedAt.gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        whereClause.uploadedAt.lte = new Date(filters.dateTo);
      }
    }

    if (filters.tags && filters.tags.length > 0) {
      // Tags stored as JSON array - use Prisma JSON filter
      whereClause.tags = {
        array_contains: filters.tags,
      };
    }

    // Public/private filter (non-admins can only see public or their enrolled courses)
    if (!isAdmin) {
      if (filters.isPublic !== undefined) {
        whereClause.isPublic = filters.isPublic;
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

        // Default: show public documents + documents from enrolled courses + common documents
        whereClause.OR = [
          { isPublic: true },
          { isCommon: true },
          ...(enrolledCourseIds.length > 0
            ? [{ courseId: { in: enrolledCourseIds } }]
            : []),
        ];
      }
    }

    // 6. Fetch documents from database
    const documents = await prisma.document.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        category: true,
        geminiFileId: true,
        url: true,
        uploadedAt: true,
        tags: true,
        courseId: true,
        isCommon: true,
      },
      orderBy: { uploadedAt: 'desc' },
      take: maxResults * 2, // Fetch more to allow for filtering by relevance
    });

    console.log(`   📄 Found ${documents.length} indexed documents`);

    if (documents.length === 0) {
      return NextResponse.json<QueryResponse>({
        success: true,
        results: [],
        totalDocuments: 0,
        cached: false,
        latency: Date.now() - startTime,
        query,
      });
    }

    // 7. Query Gemini for each document
    const geminiQueries = documents.map(doc => ({
      documentId: doc.id,
      fileId: doc.geminiFileId!,
      title: doc.title,
      category: doc.category,
      url: doc.url,
      uploadedAt: doc.uploadedAt,
      tags: parseTags(doc.tags),
      courseId: doc.courseId,
      isCommon: doc.isCommon,
    }));

    console.log(`   🤖 Querying ${geminiQueries.length} documents via Gemini...`);

    const geminiResults = await queryMultipleFiles(
      geminiQueries.map(q => q.fileId),
      query,
      { useCache }
    );

    // 8. Process results and calculate relevance
    const results: DocumentResult[] = geminiQueries
      .map((doc, index) => {
        const geminiResult = geminiResults[index];

        // Build courseIds array (single courseId or empty if isCommon)
        const courseIds = doc.isCommon
          ? [] // Common documents don't have specific courseId
          : doc.courseId
          ? [doc.courseId]
          : [];

        return {
          documentId: doc.documentId,
          title: doc.title,
          category: doc.category,
          geminiResponse: geminiResult.response,
          relevance: calculateRelevance(geminiResult.response, query),
          excerpt: generateExcerpt(geminiResult.response),
          url: doc.url || undefined,
          uploadedAt: doc.uploadedAt.toISOString(),
          tags: doc.tags.length > 0 ? doc.tags : undefined,
          courseIds: courseIds.length > 0 ? courseIds : undefined,
        };
      })
      .sort((a, b) => b.relevance - a.relevance) // Sort by relevance
      .slice(0, maxResults); // Take top N results

    // 9. Check if any result was cached
    const anyCached = geminiResults.some(r => r.cached);

    const latency = Date.now() - startTime;

    console.log(`   ✅ Returned ${results.length} results (latency: ${latency}ms, cached: ${anyCached})`);

    // 10. Return response
    return NextResponse.json<QueryResponse>({
      success: true,
      results,
      totalDocuments: documents.length,
      cached: anyCached,
      latency,
      query,
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
