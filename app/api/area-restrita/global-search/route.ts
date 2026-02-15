import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { searchLeiArticlesWithExcerpts } from '@/data/lei-14133-artigos';
import { courses } from '@/data/courses';
import { handleApiError } from '@/lib/errors/error-handler';
import { AuthenticationError, NotFoundError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';
import {
  searchDocuments,
  searchGlossary,
  searchLegislativeActs,
  searchVideos,
  searchSites,
  searchBlogPosts,
  searchFAQs,
} from '@/lib/search/full-text-search';
import type {
  ContentType,
  GlobalSearchResponse,
  SearchResultItem,
  DocumentResult,
  LeiArticleResult,
  GlossaryResult,
  VideoResult,
  SiteResult,
  LegislativeActResult,
  FAQResult,
  BlogPostResult,
} from '@/lib/types/global-search';

// Helper to get course name by ID
function getCourseName(courseId: string): string {
  const course = courses.find(c => c.id === courseId);
  return course?.title || 'Curso';
}

// Safe JSON array parser
function safeParseArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      throw new AuthenticationError();
    }

    const authPayload = await verifyToken(token);
    if (!authPayload) {
      throw new AuthenticationError();
    }

    const isAdmin = authPayload.role === 'admin';

    // Fetch user with enrollments from database (select only needed fields)
    const user = await prisma.user.findUnique({
      where: { id: authPayload.userId },
      select: {
        id: true,
        enrollments: {
          select: {
            courseId: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('Usuário');
    }

    // Get enrolled course IDs
    const enrolledCourseIds = isAdmin
      ? courses.map(c => c.id)
      : user.enrollments.map(e => e.courseId);

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q')?.trim() || '';
    const typesParam = searchParams.get('types'); // comma-separated types to search
    const limit = Math.min(parseInt(searchParams.get('limit') || '500'), 500);

    // Parse types filter
    const requestedTypes: ContentType[] = typesParam
      ? (typesParam.split(',') as ContentType[])
      : ['document', 'lei', 'glossary', 'faq', 'video', 'blog', 'site', 'legislative-act'];

    // Empty query - return empty results
    if (!query || query.length < 2) {
      return NextResponse.json({
        query: '',
        results: [],
        counts: {
          document: 0,
          lei: 0,
          glossary: 0,
          faq: 0,
          video: 0,
          blog: 0,
          site: 0,
          'legislative-act': 0,
          total: 0,
        },
        hasMore: false,
      } as GlobalSearchResponse);
    }

    const results: SearchResultItem[] = [];
    const counts: GlobalSearchResponse['counts'] = {
      document: 0,
      lei: 0,
      glossary: 0,
      faq: 0,
      video: 0,
      blog: 0,
      site: 0,
      'legislative-act': 0,
      total: 0,
    };

    // Run searches in parallel
    const searchPromises: Promise<void>[] = [];

    // 1. Search Documents (FTS)
    if (requestedTypes.includes('document')) {
      searchPromises.push(
        (async () => {
          const ftsResults = await searchDocuments(query, {
            enrolledCourseIds,
            limit,
          });

          counts.document = ftsResults.length;

          ftsResults.forEach(({ data: doc }) => {
            results.push({
              type: 'document',
              data: {
                id: doc.id,
                title: doc.title,
                description: doc.description,
                category: doc.category,
                type: doc.type,
                url: doc.url,
                courseId: doc.course_id,
                courseName: doc.course_id ? getCourseName(doc.course_id) : undefined,
                tags: doc.tags,
                uploadedAt: new Date(doc.uploaded_at).toISOString(),
                isPublic: doc.is_public,
              } as DocumentResult,
            });
          });
        })()
      );
    }

    // 2. Search Lei 14.133 Articles (in-memory, already fast)
    if (requestedTypes.includes('lei')) {
      searchPromises.push(
        (async () => {
          const articles = searchLeiArticlesWithExcerpts(query).slice(0, limit);
          counts.lei = articles.length;

          articles.forEach((art) => {
            results.push({
              type: 'lei',
              data: {
                numero: art.numero,
                titulo: art.titulo,
                ementa: art.ementa,
                capitulo: art.capitulo,
                secao: art.secao,
                excerpts: art.excerpts,
              } as LeiArticleResult,
            });
          });
        })()
      );
    }

    // 3. Search Glossary Terms (FTS)
    if (requestedTypes.includes('glossary')) {
      searchPromises.push(
        (async () => {
          const ftsResults = await searchGlossary(query, { limit });

          counts.glossary = ftsResults.length;

          ftsResults.forEach(({ data: term }) => {
            results.push({
              type: 'glossary',
              data: {
                id: term.id,
                term: term.term,
                slug: term.slug,
                definition: term.definition,
                shortDef: term.short_def,
                category: term.category,
              } as GlossaryResult,
            });
          });
        })()
      );
    }

    // 4. Search FAQs (FTS) — NEW
    if (requestedTypes.includes('faq')) {
      searchPromises.push(
        (async () => {
          const ftsResults = await searchFAQs(query, { limit });

          counts.faq = ftsResults.length;

          ftsResults.forEach(({ data: faq }) => {
            results.push({
              type: 'faq',
              data: {
                id: faq.id,
                question: faq.question,
                answer: faq.answer,
                category: faq.category,
              } as FAQResult,
            });
          });
        })()
      );
    }

    // 5. Search Videos (FTS)
    if (requestedTypes.includes('video')) {
      searchPromises.push(
        (async () => {
          const ftsResults = await searchVideos(query, {
            enrolledCourseIds,
            limit,
          });

          counts.video = ftsResults.length;

          ftsResults.forEach(({ data: video }) => {
            results.push({
              type: 'video',
              data: {
                id: video.id,
                title: video.title,
                description: video.description,
                youtubeUrl: video.youtube_url,
                youtubeId: video.youtube_id,
                thumbnailUrl: video.thumbnail_url,
                courseId: video.course_id,
                courseName: getCourseName(video.course_id),
              } as VideoResult,
            });
          });
        })()
      );
    }

    // 6. Search Blog Posts (FTS) — NEW
    if (requestedTypes.includes('blog')) {
      searchPromises.push(
        (async () => {
          const ftsResults = await searchBlogPosts(query, { limit });

          counts.blog = ftsResults.length;

          ftsResults.forEach(({ data: post }) => {
            results.push({
              type: 'blog',
              data: {
                id: post.id,
                slug: post.slug,
                title: post.title,
                excerpt: post.excerpt,
                author: post.author,
                publishedAt: new Date(post.published_at).toISOString(),
                tags: post.tags,
              } as BlogPostResult,
            });
          });
        })()
      );
    }

    // 7. Search Recommended Sites (FTS)
    if (requestedTypes.includes('site')) {
      searchPromises.push(
        (async () => {
          // Get sites that are linked to enrolled courses
          const siteToCourses = await prisma.siteToCourse.findMany({
            where: {
              courseId: { in: enrolledCourseIds },
            },
            select: {
              siteId: true,
            },
          });

          const siteIds = [...new Set(siteToCourses.map((s) => s.siteId))];

          const ftsResults = await searchSites(query, { siteIds, limit });

          counts.site = ftsResults.length;

          ftsResults.forEach(({ data: site }) => {
            results.push({
              type: 'site',
              data: {
                id: site.id,
                title: site.title,
                description: site.description,
                url: site.url,
                faviconUrl: site.favicon_url,
                category: site.category,
              } as SiteResult,
            });
          });
        })()
      );
    }

    // 8. Search Legislative Acts (FTS)
    if (requestedTypes.includes('legislative-act')) {
      searchPromises.push(
        (async () => {
          const ftsResults = await searchLegislativeActs(query, { limit });

          counts['legislative-act'] = ftsResults.length;

          ftsResults.forEach(({ data: act }) => {
            results.push({
              type: 'legislative-act',
              data: {
                id: act.id,
                type: act.type,
                fullNumber: act.full_number,
                title: act.title,
                ementa: act.ementa,
                summary: act.summary,
                issuer: act.issuer,
                publishDate: new Date(act.publish_date).toISOString(),
                hierarchyLevel: act.hierarchy_level,
                leiArticles: safeParseArray(act.lei_articles),
                officialUrl: act.official_url,
                pdfUrl: act.pdf_url,
              } as LegislativeActResult,
            });
          });
        })()
      );
    }

    // Wait for all searches to complete
    await Promise.all(searchPromises);

    // Calculate total
    counts.total =
      counts.document +
      counts.lei +
      counts.glossary +
      counts.faq +
      counts.video +
      counts.blog +
      counts.site +
      counts['legislative-act'];

    // Sort results by type priority, then sub-sort documents by category priority
    const typePriority: Record<string, number> = {
      glossary: 1,
      faq: 1.5,
      'course-material': 2,
      document: 3,
      'legislative-act': 4,
      lei: 5,
      video: 6,
      blog: 6.5,
      site: 7,
    };

    // Category priority within the 'document' type
    const docCategoryPriority: Record<string, number> = {
      'apostila': 1,
      'conteudo-programatico': 1,
      'outro': 2,
      'bibliografia': 2,
      'enunciados': 3,
      'orientacao-normativa': 3,
      'lei-artigo': 4,
      'ato-normativo': 4,
      'acordao': 5,
      'manual-tcu': 5,
      'decor': 6,
      'parecer-vinculante': 6,
      'sumula': 7,
      'parecer': 7,
    };

    results.sort((a, b) => {
      const typeA = typePriority[a.type] ?? 10;
      const typeB = typePriority[b.type] ?? 10;
      if (typeA !== typeB) return typeA - typeB;

      // Sub-sort documents by category
      if (a.type === 'document' && b.type === 'document') {
        const catA = docCategoryPriority[(a.data as { category: string }).category] ?? 10;
        const catB = docCategoryPriority[(b.data as { category: string }).category] ?? 10;
        return catA - catB;
      }

      return 0;
    });

    apiLogger.info({ query, total: counts.total }, 'Global search completed');

    return NextResponse.json({
      query,
      results,
      counts,
      hasMore: results.length >= limit,
    } as GlobalSearchResponse);
  } catch (error) {
    return handleApiError(error);
  }
}
