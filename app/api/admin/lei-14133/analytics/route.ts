import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/admin/lei-14133/analytics
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação admin
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.role !== 'admin') {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      );
    }

    // Parse query params para filtros opcionais
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 1. Métricas Gerais
    const totalQuestions = await prisma.articleQuestion.count({
      where: {
        createdAt: { gte: startDate },
        isPlaceholder: false,
      },
    });

    const questionsWithFeedback = await prisma.articleQuestion.count({
      where: {
        createdAt: { gte: startDate },
        isPlaceholder: false,
        wasHelpful: { not: null },
      },
    });

    const positiveFeedback = await prisma.articleQuestion.count({
      where: {
        createdAt: { gte: startDate },
        isPlaceholder: false,
        wasHelpful: true,
      },
    });

    const negativeFeedback = await prisma.articleQuestion.count({
      where: {
        createdAt: { gte: startDate },
        isPlaceholder: false,
        wasHelpful: false,
      },
    });

    // Calcular taxa de satisfação
    const satisfactionRate = questionsWithFeedback > 0
      ? (positiveFeedback / questionsWithFeedback) * 100
      : 0;

    // Tokens e latência média
    const tokensStats = await prisma.articleQuestion.aggregate({
      where: {
        createdAt: { gte: startDate },
        isPlaceholder: false,
        geminiTokens: { not: null },
      },
      _avg: {
        geminiTokens: true,
        geminiLatency: true,
      },
      _sum: {
        geminiTokens: true,
      },
    });

    // 2. Artigos Mais Perguntados
    const topArticles = await prisma.articleQuestion.groupBy({
      by: ['articleNumber'],
      where: {
        createdAt: { gte: startDate },
        isPlaceholder: false,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 10,
    });

    // 3. Perguntas Recentes (últimas 20)
    const recentQuestions = await prisma.articleQuestion.findMany({
      where: {
        createdAt: { gte: startDate },
        isPlaceholder: false,
      },
      select: {
        id: true,
        articleNumber: true,
        question: true,
        wasHelpful: true,
        createdAt: true,
        geminiLatency: true,
        geminiCached: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
    });

    // 4. Perguntas por Dia (últimos 7 dias)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      return date;
    }).reverse();

    const questionsByDay = await Promise.all(
      last7Days.map(async (date) => {
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);

        const count = await prisma.articleQuestion.count({
          where: {
            createdAt: {
              gte: date,
              lt: nextDay,
            },
            isPlaceholder: false,
          },
        });

        return {
          date: date.toISOString().split('T')[0],
          count,
        };
      })
    );

    // 5. Distribuição por Hora (últimas 24h)
    const last24h = new Date();
    last24h.setHours(last24h.getHours() - 24);

    const questionsByHour = await prisma.articleQuestion.findMany({
      where: {
        createdAt: { gte: last24h },
        isPlaceholder: false,
      },
      select: {
        createdAt: true,
      },
    });

    const hourDistribution = Array.from({ length: 24 }, (_, hour) => {
      const count = questionsByHour.filter((q) => {
        const qHour = new Date(q.createdAt).getHours();
        return qHour === hour;
      }).length;

      return { hour, count };
    });

    // 6. Usuários mais ativos
    const topUsers = await prisma.articleQuestion.groupBy({
      by: ['userId'],
      where: {
        createdAt: { gte: startDate },
        isPlaceholder: false,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 10,
    });

    // Buscar dados dos usuários
    const topUsersWithDetails = await Promise.all(
      topUsers.map(async (u) => {
        const user = await prisma.user.findUnique({
          where: { id: u.userId },
          select: { name: true, email: true },
        });
        return {
          userId: u.userId,
          name: user?.name || 'Usuário Desconhecido',
          email: user?.email || '',
          questionsCount: u._count.id,
        };
      })
    );

    // 7. Cache Hit Rate
    const totalWithCacheInfo = await prisma.articleQuestion.count({
      where: {
        createdAt: { gte: startDate },
        isPlaceholder: false,
        geminiCached: { not: null },
      },
    });

    const cachedQuestions = await prisma.articleQuestion.count({
      where: {
        createdAt: { gte: startDate },
        isPlaceholder: false,
        geminiCached: true,
      },
    });

    const cacheHitRate = totalWithCacheInfo > 0
      ? (cachedQuestions / totalWithCacheInfo) * 100
      : 0;

    // Montar resposta
    return NextResponse.json({
      success: true,
      period: {
        days,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
      overview: {
        totalQuestions,
        questionsWithFeedback,
        feedbackRate: questionsWithFeedback > 0
          ? ((questionsWithFeedback / totalQuestions) * 100).toFixed(1)
          : '0.0',
        satisfactionRate: satisfactionRate.toFixed(1),
        positiveFeedback,
        negativeFeedback,
        avgTokens: Math.round(tokensStats._avg.geminiTokens || 0),
        totalTokens: tokensStats._sum.geminiTokens || 0,
        avgLatency: Math.round(tokensStats._avg.geminiLatency || 0),
        cacheHitRate: cacheHitRate.toFixed(1),
      },
      topArticles: topArticles.map((a) => ({
        articleNumber: a.articleNumber,
        questionsCount: a._count.id,
      })),
      recentQuestions: recentQuestions.map((q) => ({
        id: q.id,
        articleNumber: q.articleNumber,
        question: q.question.substring(0, 100) + (q.question.length > 100 ? '...' : ''),
        wasHelpful: q.wasHelpful,
        createdAt: q.createdAt.toISOString(),
        latency: q.geminiLatency,
        cached: q.geminiCached,
        user: {
          name: q.user?.name || 'Anônimo',
          email: q.user?.email || '',
        },
      })),
      questionsByDay,
      hourDistribution,
      topUsers: topUsersWithDetails,
    });
  } catch (error) {
    console.error('Erro ao buscar analytics:', error);
    return NextResponse.json(
      { error: 'Erro ao processar analytics' },
      { status: 500 }
    );
  }
}
