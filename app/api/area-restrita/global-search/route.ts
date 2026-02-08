import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { searchLeiArticlesWithExcerpts } from '@/data/lei-14133-artigos';
import { courses } from '@/data/courses';
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
} from '@/lib/types/global-search';

// Helper to get course name by ID
function getCourseName(courseId: string): string {
  const course = courses.find(c => c.id === courseId);
  return course?.title || 'Curso';
}

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authPayload = await verifyToken(token);
    if (!authPayload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get enrolled course IDs
    const enrolledCourseIds = isAdmin
      ? courses.map(c => c.id)
      : user.enrollments.map(e => e.courseId);

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q')?.trim() || '';
    const typesParam = searchParams.get('types'); // comma-separated types to search
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    // Parse types filter
    const requestedTypes: ContentType[] = typesParam
      ? (typesParam.split(',') as ContentType[])
      : ['document', 'lei', 'glossary', 'video', 'site', 'legislative-act'];

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
          site: 0,
          'legislative-act': 0,
          total: 0,
        },
        hasMore: false,
      } as GlobalSearchResponse);
    }

    const results: SearchResultItem[] = [];
    const counts = {
      document: 0,
      lei: 0,
      glossary: 0,
      video: 0,
      site: 0,
      'legislative-act': 0,
      total: 0,
    };

    // Run searches in parallel
    const searchPromises: Promise<void>[] = [];

    // 1. Search Documents
    if (requestedTypes.includes('document')) {
      searchPromises.push(
        (async () => {
          const documents = await prisma.document.findMany({
            where: {
              OR: [
                { title: { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } },
                { tags: { contains: query, mode: 'insensitive' } },
                { content: { contains: query, mode: 'insensitive' } },
              ],
              AND: [
                {
                  OR: [
                    { isCommon: true },
                    { isPublic: true },
                    ...(enrolledCourseIds.length > 0
                      ? [{ courseId: { in: enrolledCourseIds } }]
                      : []),
                  ],
                },
              ],
            },
            select: {
              id: true,
              title: true,
              description: true,
              category: true,
              type: true,
              url: true,
              courseId: true,
              tags: true,
              uploadedAt: true,
              isPublic: true,
            },
            orderBy: { uploadedAt: 'desc' },
            take: limit,
          });

          counts.document = documents.length;

          documents.forEach((doc) => {
            results.push({
              type: 'document',
              data: {
                id: doc.id,
                title: doc.title,
                description: doc.description,
                category: doc.category,
                type: doc.type,
                url: doc.url,
                courseId: doc.courseId,
                courseName: doc.courseId ? getCourseName(doc.courseId) : undefined,
                tags: doc.tags,
                uploadedAt: doc.uploadedAt.toISOString(),
                isPublic: doc.isPublic,
              } as DocumentResult,
            });
          });
        })()
      );
    }

    // 2. Search Lei 14.133 Articles
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

    // 3. Search Glossary Terms
    if (requestedTypes.includes('glossary')) {
      searchPromises.push(
        (async () => {
          const terms = await prisma.glossaryTerm.findMany({
            where: {
              isPublic: true,
              OR: [
                { term: { contains: query, mode: 'insensitive' } },
                { definition: { contains: query, mode: 'insensitive' } },
                { shortDef: { contains: query, mode: 'insensitive' } },
              ],
            },
            select: {
              id: true,
              term: true,
              slug: true,
              definition: true,
              shortDef: true,
              category: true,
            },
            orderBy: { viewCount: 'desc' },
            take: limit,
          });

          counts.glossary = terms.length;

          terms.forEach((term) => {
            results.push({
              type: 'glossary',
              data: {
                id: term.id,
                term: term.term,
                slug: term.slug,
                definition: term.definition,
                shortDef: term.shortDef,
                category: term.category,
              } as GlossaryResult,
            });
          });
        })()
      );
    }

    // 4. Search Videos
    if (requestedTypes.includes('video')) {
      searchPromises.push(
        (async () => {
          const videos = await prisma.courseVideo.findMany({
            where: {
              isActive: true,
              courseId: { in: enrolledCourseIds },
              OR: [
                { title: { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } },
              ],
            },
            select: {
              id: true,
              title: true,
              description: true,
              youtubeUrl: true,
              youtubeId: true,
              thumbnailUrl: true,
              courseId: true,
            },
            orderBy: { displayOrder: 'asc' },
            take: limit,
          });

          counts.video = videos.length;

          videos.forEach((video) => {
            results.push({
              type: 'video',
              data: {
                id: video.id,
                title: video.title,
                description: video.description,
                youtubeUrl: video.youtubeUrl,
                youtubeId: video.youtubeId,
                thumbnailUrl: video.thumbnailUrl,
                courseId: video.courseId,
                courseName: getCourseName(video.courseId),
              } as VideoResult,
            });
          });
        })()
      );
    }

    // 5. Search Recommended Sites
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

          const sites = await prisma.recommendedSite.findMany({
            where: {
              isActive: true,
              id: { in: siteIds },
              OR: [
                { title: { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } },
              ],
            },
            select: {
              id: true,
              title: true,
              description: true,
              url: true,
              faviconUrl: true,
              category: true,
            },
            orderBy: { displayOrder: 'asc' },
            take: limit,
          });

          counts.site = sites.length;

          sites.forEach((site) => {
            results.push({
              type: 'site',
              data: {
                id: site.id,
                title: site.title,
                description: site.description,
                url: site.url,
                faviconUrl: site.faviconUrl,
                category: site.category,
              } as SiteResult,
            });
          });
        })()
      );
    }

    // 6. Search Legislative Acts
    if (requestedTypes.includes('legislative-act')) {
      searchPromises.push(
        (async () => {
          const acts = await prisma.legislativeAct.findMany({
            where: {
              OR: [
                { title: { contains: query, mode: 'insensitive' } },
                { ementa: { contains: query, mode: 'insensitive' } },
                { fullNumber: { contains: query, mode: 'insensitive' } },
              ],
            },
            select: {
              id: true,
              type: true,
              fullNumber: true,
              title: true,
              ementa: true,
              summary: true,
              issuer: true,
              publishDate: true,
              hierarchyLevel: true,
              leiArticles: true,
              officialUrl: true,
              pdfUrl: true,
            },
            orderBy: [
              { hierarchyLevel: 'asc' },
              { year: 'desc' },
            ],
            take: limit,
          });

          counts['legislative-act'] = acts.length;

          acts.forEach((act) => {
            results.push({
              type: 'legislative-act',
              data: {
                id: act.id,
                type: act.type,
                fullNumber: act.fullNumber,
                title: act.title,
                ementa: act.ementa,
                summary: act.summary,
                issuer: act.issuer,
                publishDate: act.publishDate.toISOString(),
                hierarchyLevel: act.hierarchyLevel,
                leiArticles: act.leiArticles ? JSON.parse(act.leiArticles) : [],
                officialUrl: act.officialUrl,
                pdfUrl: act.pdfUrl,
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
      counts.video +
      counts.site +
      counts['legislative-act'];

    // Sort results by type priority: glossary first (exact matches), then documents, lei, faq, video, site
    const typePriority: Record<ContentType, number> = {
      glossary: 1,
      document: 2,
      lei: 3,
      'legislative-act': 4,
      video: 5,
      site: 6,
    };

    results.sort((a, b) => typePriority[a.type] - typePriority[b.type]);

    return NextResponse.json({
      query,
      results,
      counts,
      hasMore: results.length >= limit,
    } as GlobalSearchResponse);
  } catch (error) {
    console.error('[Global Search] Error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
