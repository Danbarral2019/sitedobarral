import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface TimelinePeriod {
  period: string; // "2024-11" formato ano-mês
  label: string; // "Novembro 2024" para display
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
  { params }: { params: { numero: string } }
) {
  try {
    const articleNumber = params.numero;
    const searchParams = request.nextUrl.searchParams;

    // Filtros opcionais
    const period = searchParams.get('period'); // "30d" | "6m" | "1y" | "all"
    const category = searchParams.get('category');

    if (!articleNumber) {
      return NextResponse.json(
        { error: 'Número do artigo é obrigatório' },
        { status: 400 }
      );
    }

    // Calcular data de início baseado no período
    let dateFilter: Date | undefined;
    const now = new Date();

    switch (period) {
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

    // Buscar documentos que mencionam este artigo
    const documents = await prisma.document.findMany({
      where: {
        leiArticles: {
          contains: articleNumber,
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
      return NextResponse.json({
        articleNumber,
        timeline: [],
        stats: {
          total: 0,
          oldestDate: null,
          newestDate: null,
          categories: {},
        },
      });
    }

    // Agrupar por período (ano-mês)
    const periodMap = new Map<string, TimelinePeriod>();
    const categoryCount: { [key: string]: number } = {};

    documents.forEach((doc) => {
      const date = new Date(doc.uploadedAt);
      const periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      // Criar período se não existir
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

      // Adicionar documento ao período
      const period = periodMap.get(periodKey)!;
      period.documents.push({
        id: doc.id,
        title: doc.title,
        category: doc.category,
        type: doc.type,
        uploadedAt: doc.uploadedAt.toISOString(),
      });
      period.count++;

      // Contar categorias
      categoryCount[doc.category] = (categoryCount[doc.category] || 0) + 1;
    });

    // Converter para array e ordenar por data (mais recente primeiro)
    const timeline = Array.from(periodMap.values()).sort((a, b) => {
      return b.period.localeCompare(a.period);
    });

    // Estatísticas
    const stats: TimelineStats = {
      total: documents.length,
      oldestDate: documents[documents.length - 1].uploadedAt.toISOString(),
      newestDate: documents[0].uploadedAt.toISOString(),
      categories: categoryCount,
    };

    return NextResponse.json({
      articleNumber,
      timeline,
      stats,
      filters: {
        period: period || 'all',
        category: category || null,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar timeline:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar timeline do artigo' },
      { status: 500 }
    );
  }
}
