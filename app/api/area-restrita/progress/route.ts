import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/errors/error-handler';
import { AuthenticationError } from '@/lib/errors/api-error';
import { courses } from '@/data/courses';
import { BADGE_TYPES, type BadgeType } from '@/lib/gamification';
import { withTiming } from '@/lib/lms/query-timing';
import { getEnrolledUserQuizPassRates } from '@/lib/lms/analytics-queries';

export async function GET(req: NextRequest) {
  try {
    const authResult = await verifyAuth(req);
    if (!authResult.valid || !authResult.user) {
      throw new AuthenticationError();
    }

    const userId = authResult.user.userId;

    return await withTiming(`lms.progress.user.${userId}`, async () => {
    // Buscar dados em paralelo
    const [enrollments, badges, certificates, streaks, recentActivity] = await Promise.all([
      // Enrollments ativos
      prisma.enrollment.findMany({
        where: {
          userId,
          OR: [
            { isLifetime: true },
            { expiresAt: { gte: new Date() } },
          ],
        },
        select: { courseId: true },
      }),

      // Badges
      prisma.badge.findMany({
        where: { userId },
        orderBy: { awardedAt: 'desc' },
      }),

      // Certificados
      prisma.certificate.findMany({
        where: { userId },
        select: {
          id: true,
          courseId: true,
          certificateNumber: true,
          courseTitle: true,
          issuedAt: true,
        },
      }),

      // Streaks por curso
      prisma.userStreak.findMany({
        where: { userId },
      }),

      // Ultimas 5 atividades
      prisma.lessonProgress.findMany({
        where: { userId, lastAccessedAt: { not: null } },
        orderBy: { lastAccessedAt: 'desc' },
        take: 5,
        include: {
          lesson: {
            select: { title: true, moduleId: true, module: { select: { courseId: true } } },
          },
        },
      }),
    ]);

    const courseIds = enrollments.map(e => e.courseId);

    // Para cada curso matriculado, buscar progresso
    const courseProgressPromises = courseIds.map(async (courseId) => {
      const course = courses.find(c => c.id === courseId);
      if (!course) return null;

      // Buscar modulos e aulas publicadas
      const modules = await prisma.module.findMany({
        where: { courseId, isPublished: true },
        include: {
          lessons: {
            where: { isPublished: true },
            select: { id: true },
            orderBy: { displayOrder: 'asc' },
          },
        },
      });

      const allLessonIds = modules.flatMap(m => m.lessons.map(l => l.id));
      const totalLessons = allLessonIds.length;

      // Contar aulas completas
      const completedLessons = totalLessons > 0
        ? await prisma.lessonProgress.count({
            where: { userId, lessonId: { in: allLessonIds }, status: 'completed' },
          })
        : 0;

      // Contar quizzes publicados e aprovados
      const publishedQuizzes = totalLessons > 0
        ? await prisma.quiz.findMany({
            where: { lessonId: { in: allLessonIds }, isPublished: true },
            select: { id: true },
          })
        : [];
      const totalQuizzes = publishedQuizzes.length;
      const passedQuizzes = await getEnrolledUserQuizPassRates(
        userId,
        publishedQuizzes.map(q => q.id),
      );

      const streak = streaks.find(s => s.courseId === courseId);

      return {
        courseId,
        courseTitle: course.title,
        courseSlug: course.slug,
        totalLessons,
        completedLessons,
        totalQuizzes,
        passedQuizzes,
        progressPercent: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
        quizPercent: totalQuizzes > 0 ? Math.round((passedQuizzes / totalQuizzes) * 100) : 0,
        currentStreak: streak?.currentStreak ?? 0,
        longestStreak: streak?.longestStreak ?? 0,
        totalXp: streak?.totalXp ?? 0,
      };
    });

    const courseProgress = (await Promise.all(courseProgressPromises)).filter(Boolean);

    // Tempo total de estudo
    const totalTimeResult = await prisma.lessonProgress.aggregate({
      where: { userId },
      _sum: { timeSpentSeconds: true },
    });
    const totalStudyTimeSeconds = totalTimeResult._sum.timeSpentSeconds ?? 0;

    // XP total (somar de todos os cursos)
    const totalXp = streaks.reduce((sum, s) => sum + s.totalXp, 0);

    // Melhor streak atual e longest
    const bestCurrentStreak = streaks.reduce((max, s) => Math.max(max, s.currentStreak), 0);
    const bestLongestStreak = streaks.reduce((max, s) => Math.max(max, s.longestStreak), 0);

    // Formatar badges
    const formattedBadges = badges.map(b => ({
      id: b.id,
      ...(BADGE_TYPES[b.type as BadgeType] || { type: b.type, label: b.type, icon: '🏆', description: '' }),
      courseId: b.courseId,
      awardedAt: b.awardedAt.toISOString(),
    }));

    // Formatar atividades recentes
    const formattedActivity = recentActivity.map(a => ({
      lessonTitle: a.lesson.title,
      courseId: a.lesson.module.courseId,
      status: a.status,
      lastAccessedAt: a.lastAccessedAt?.toISOString() ?? null,
    }));

    return NextResponse.json({
      totalXp,
      currentStreak: bestCurrentStreak,
      longestStreak: bestLongestStreak,
      totalStudyTimeSeconds,
      courseProgress,
      badges: formattedBadges,
      certificates,
      recentActivity: formattedActivity,
    });
    }); // end withTiming
  } catch (error) {
    return handleApiError(error);
  }
}
