import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCache, CacheKeys, CACHE_TTL } from '@/lib/cache/redis-client';

interface TimelinePeriod {
  period: string;
  label: string;
  documents: {
    id: string;
    title: string;
    category: string;
    type: string;
    uploadedAt: string;
  }[];
  count: number;
}

interface TimelineStats {
  total: number;
  oldestDate: string | null;
  newestDate: string | null;
  categories: { [key: string]: number };
}

// GET /api/artigos/[numero]/timeline - Timeline cronológica de documentos
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string }> }
) {
  try {
    const { numero: articleNumber } = await params;
    const searchParams = request.nextUrl.searchParams;

    const periodParam = searchParams.get('period');
    const category = searchParams.get('category');

    if (!articleNumber) {
      return NextResponse.json(
        { error: 'Número do artigo é obrigatório' },
        { status: 400 }
      );
    }

    const result = await withCache(
      CacheKeys.articleDetails(articleNumber, `tl:${periodParam || 'all'}:${category || 'all'}`),
      async () => {
        let dateFilter: Date | undefined;
        const now = new Date();

        switch (periodParam) {
          case '30d':
            dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case '6m':
            dateFilter = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
            break;
          case '1y':
            dateFilter = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            break;
          case 'all':
          default:
            dateFilter = undefined;
        }

        const documents = await prisma.document.findMany({
          where: {
            leiArticlesArr: {
              has: articleNumber,
            },
            ...(dateFilter && {
              uploadedAt: {
                gte: dateFilter,
              },
            }),
            ...(category && {
              category: category,
            }),
          },
          select: {
            id: true,
            title: true,
            category: true,
            type: true,
            uploadedAt: true,
          },
          orderBy: {
            uploadedAt: 'desc',
          },
        });

        if (documents.length === 0) {
          return {
            articleNumber,
            timeline: [],
            stats: {
              total: 0,
              oldestDate: null,
              newestDate: null,
              categories: {},
            },
          };
        }

        const periodMap = new Map<string, TimelinePeriod>();
        const categoryCount: { [key: string]: number } = {};

        documents.forEach((doc) => {
          const date = new Date(doc.uploadedAt);
          const periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

          if (!periodMap.has(periodKey)) {
            const monthNames = [
              'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
              'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
            ];
            const monthName = monthNames[date.getMonth()];
            const year = date.getFullYear();

            periodMap.set(periodKey, {
              period: periodKey,
              label: `${monthName} ${year}`,
              documents: [],
              count: 0,
            });
          }

          const p = periodMap.get(periodKey)!;
          p.documents.push({
            id: doc.id,
            title: doc.title,
            category: doc.category,
            type: doc.type,
            uploadedAt: doc.uploadedAt.toISOString(),
          });
          p.count++;

          categoryCount[doc.category] = (categoryCount[doc.category] || 0) + 1;
        });

        const timeline = Array.from(periodMap.values()).sort((a, b) => {
          return b.period.localeCompare(a.period);
        });

        const stats: TimelineStats = {
          total: documents.length,
          oldestDate: documents[documents.length - 1].uploadedAt.toISOString(),
          newestDate: documents[0].uploadedAt.toISOString(),
          categories: categoryCount,
        };

        return {
          articleNumber,
          timeline,
          stats,
          filters: {
            period: periodParam || 'all',
            category: category || null,
          },
        };
      },
      CACHE_TTL.ARTICLE_DETAILS,
      { prefix: 'article' }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Erro ao buscar timeline:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar timeline do artigo' },
      { status: 500 }
    );
  }
}
