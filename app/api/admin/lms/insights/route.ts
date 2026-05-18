import { NextRequest, NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { ValidationError } from '@/lib/errors/api-error';
import { prisma } from '@/lib/prisma';
import { withTiming } from '@/lib/lms/query-timing';
import { getQuizStatsBatch } from '@/lib/lms/analytics-queries';

export const GET = withAdminApi(async (request) => {
  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get('courseId');

  if (!courseId) {
    throw new ValidationError('courseId obrigatorio');
  }

  return withTiming(`lms.insights.course.${courseId}`, async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // 1. Frequent queries: SearchHistory from enrolled users in last 30 days
    const enrolledUserIds = (
      await prisma.enrollment.findMany({
        where: { courseId },
        select: { userId: true },
      })
    ).map(e => e.userId);

    const searchHistories = enrolledUserIds.length > 0
      ? await prisma.searchHistory.findMany({
          where: {
            userId: { in: enrolledUserIds },
            createdAt: { gte: thirtyDaysAgo },
          },
          select: { query: true },
          orderBy: { createdAt: 'desc' },
          take: 500,
        })
      : [];

    // Group queries by normalized text and count frequency
    const queryCounts = new Map<string, number>();
    for (const sh of searchHistories) {
      const normalized = sh.query.trim().toLowerCase().replace(/\s+/g, ' ');
      if (normalized.length < 3) continue;
      queryCounts.set(normalized, (queryCounts.get(normalized) || 0) + 1);
    }

    const frequentQueries = [...queryCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));

    // 2. Quiz alerts: quizzes with passRate < 60%
    const modules = await prisma.module.findMany({
      where: { courseId, isPublished: true },
      include: {
        lessons: {
          where: { isPublished: true },
          select: {
            id: true,
            title: true,
            quiz: { select: { id: true, passingScore: true } },
          },
        },
      },
    });

    const lessonByQuizId = new Map<string, string>();
    const allQuizIds: string[] = [];
    for (const mod of modules) {
      for (const lesson of mod.lessons) {
        if (lesson.quiz) {
          lessonByQuizId.set(lesson.quiz.id, lesson.title);
          allQuizIds.push(lesson.quiz.id);
        }
      }
    }

    const statsByQuiz = await getQuizStatsBatch(allQuizIds);
    const quizAlerts: Array<{
      lessonTitle: string;
      passRate: number;
      avgScore: number;
      totalAttempts: number;
    }> = [];

    for (const [quizId, stats] of statsByQuiz) {
      if (stats.totalAttempts < 3) continue;
      if (stats.passRate >= 60) continue;
      const lessonTitle = lessonByQuizId.get(quizId);
      if (!lessonTitle) continue;
      quizAlerts.push({
        lessonTitle,
        passRate: stats.passRate,
        avgScore: stats.avgScore,
        totalAttempts: stats.totalAttempts,
      });
    }

    quizAlerts.sort((a, b) => a.passRate - b.passRate);

    // 3. Suggestions based on quiz alerts and query patterns
    const suggestions: string[] = [];

    if (quizAlerts.length > 0) {
      suggestions.push(
        `${quizAlerts.length} quiz(zes) com taxa de aprovacao abaixo de 60%. Considere revisar o conteudo das aulas correspondentes ou simplificar as perguntas.`
      );
    }

    if (frequentQueries.length > 0) {
      const topTopic = frequentQueries[0].query;
      suggestions.push(
        `"${topTopic}" e o tema mais buscado pelos alunos (${frequentQueries[0].count}x). Considere criar uma aula ou arquivo rapido sobre este tema.`
      );
    }

    if (enrolledUserIds.length > 0) {
      const progressCount = await prisma.lessonProgress.count({
        where: {
          userId: { in: enrolledUserIds },
          lesson: { module: { courseId } },
          status: 'completed',
        },
      });

      const totalLessons = modules.reduce((s, m) => s + m.lessons.length, 0);
      const avgCompletion = totalLessons > 0
        ? Math.round((progressCount / (enrolledUserIds.length * totalLessons)) * 100)
        : 0;

      if (avgCompletion < 30) {
        suggestions.push(
          `A taxa de conclusao media e de apenas ${avgCompletion}%. Considere enviar lembretes ou tornar as primeiras aulas mais engajantes.`
        );
      }
    }

    const response = NextResponse.json({
      frequentQueries,
      quizAlerts,
      suggestions,
    });

    response.headers.set('Cache-Control', 'public, max-age=60');
    return response;
  });
});
