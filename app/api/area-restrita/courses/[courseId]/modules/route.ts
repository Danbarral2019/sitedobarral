import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { handleApiError } from '@/lib/errors/error-handler';
import { AuthenticationError, AuthorizationError, NotFoundError } from '@/lib/errors/api-error';
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

    // Fetch published modules with published lessons, ordered by displayOrder
    const modules = await prisma.module.findMany({
      where: { courseId, isPublished: true },
      orderBy: { displayOrder: 'asc' },
      include: {
        lessons: {
          where: { isPublished: true },
          orderBy: { displayOrder: 'asc' },
          select: {
            id: true,
            title: true,
            slug: true,
            estimatedMinutes: true,
            displayOrder: true,
          },
        },
      },
    });

    // Fetch all lesson IDs for progress query
    const lessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));

    // Fetch user progress for all lessons in one query
    const progressRecords = await prisma.lessonProgress.findMany({
      where: {
        userId: user.id,
        lessonId: { in: lessonIds },
      },
      select: {
        lessonId: true,
        status: true,
        completedAt: true,
      },
    });

    const progressMap = new Map(
      progressRecords.map((p) => [p.lessonId, p])
    );

    // Build response with progress attached to each lesson
    const modulesWithProgress = modules.map((mod) => ({
      id: mod.id,
      title: mod.title,
      description: mod.description,
      displayOrder: mod.displayOrder,
      lessons: mod.lessons.map((lesson) => {
        const progress = progressMap.get(lesson.id);
        return {
          ...lesson,
          progress: progress
            ? { status: progress.status, completedAt: progress.completedAt }
            : null,
        };
      }),
    }));

    // Calculate course progress
    const totalLessons = lessonIds.length;
    const completedLessons = progressRecords.filter(
      (p) => p.status === 'completed'
    ).length;
    const percentage = totalLessons > 0
      ? Math.round((completedLessons / totalLessons) * 100)
      : 0;

    apiLogger.info({ courseId, userId: user.id }, 'Course modules fetched');

    return NextResponse.json({
      modules: modulesWithProgress,
      courseProgress: { totalLessons, completedLessons, percentage },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
