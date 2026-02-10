import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { handleApiError } from '@/lib/errors/error-handler';
import { AuthenticationError, AuthorizationError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;

    // Auth
    const token = request.cookies.get('auth-token')?.value;
    if (!token) throw new AuthenticationError();
    const payload = await verifyToken(token);
    if (!payload) throw new AuthenticationError();
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) throw new AuthenticationError();

    // Enrollment check (admin bypasses)
    if (user.role !== 'admin') {
      const enrollment = await prisma.enrollment.findFirst({
        where: { userId: user.id, courseId },
      });
      if (!enrollment) throw new AuthorizationError('Você não está matriculado neste curso.');
    }

    // Fetch all published modules and lessons
    const modules = await prisma.module.findMany({
      where: { courseId, isPublished: true },
      orderBy: { displayOrder: 'asc' },
      include: {
        lessons: {
          where: { isPublished: true },
          orderBy: { displayOrder: 'asc' },
          select: { id: true, title: true },
        },
      },
    });

    const allLessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));

    // Fetch all progress for this user in one query
    const progressRecords = await prisma.lessonProgress.findMany({
      where: {
        userId: user.id,
        lessonId: { in: allLessonIds },
      },
    });

    const progressMap = new Map(
      progressRecords.map((p) => [p.lessonId, p])
    );

    // Per-module breakdown
    const moduleBreakdown = modules.map((mod) => {
      const totalLessons = mod.lessons.length;
      const completedLessons = mod.lessons.filter(
        (l) => progressMap.get(l.id)?.status === 'completed'
      ).length;
      return {
        id: mod.id,
        title: mod.title,
        totalLessons,
        completedLessons,
        percentage: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
      };
    });

    // Overall progress
    const totalLessons = allLessonIds.length;
    const completedLessons = progressRecords.filter(
      (p) => p.status === 'completed'
    ).length;
    const percentage = totalLessons > 0
      ? Math.round((completedLessons / totalLessons) * 100)
      : 0;

    // Recent activity: last 5 lesson progress updates
    const recentActivity = progressRecords
      .filter((p) => p.lastAccessedAt)
      .sort((a, b) => {
        const dateA = a.lastAccessedAt ?? a.updatedAt;
        const dateB = b.lastAccessedAt ?? b.updatedAt;
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 5)
      .map((p) => {
        // Find lesson title from modules
        let lessonTitle = '';
        for (const mod of modules) {
          const lesson = mod.lessons.find((l) => l.id === p.lessonId);
          if (lesson) {
            lessonTitle = lesson.title;
            break;
          }
        }
        return {
          lessonId: p.lessonId,
          lessonTitle,
          status: p.status,
          lastAccessedAt: p.lastAccessedAt,
          completedAt: p.completedAt,
        };
      });

    apiLogger.info({ courseId, userId: user.id }, 'Course progress fetched');

    return NextResponse.json({
      totalLessons,
      completedLessons,
      percentage,
      modules: moduleBreakdown,
      recentActivity,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
