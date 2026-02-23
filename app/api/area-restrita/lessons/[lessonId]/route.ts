import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { handleApiError } from '@/lib/errors/error-handler';
import { AuthenticationError, AuthorizationError, NotFoundError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const { lessonId } = await params;

    // Auth
    const token = request.cookies.get('auth-token')?.value;
    if (!token) throw new AuthenticationError();
    const payload = await verifyToken(token);
    if (!payload) throw new AuthenticationError();
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) throw new AuthenticationError();

    // Fetch lesson with module, documents, videos
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        module: true,
        documents: {
          orderBy: { displayOrder: 'asc' },
          include: {
            document: {
              select: {
                id: true,
                title: true,
                description: true,
                type: true,
                url: true,
                category: true,
              },
            },
          },
        },
        videos: {
          orderBy: { displayOrder: 'asc' },
          select: {
            id: true,
            title: true,
            youtubeUrl: true,
            youtubeId: true,
            description: true,
            displayOrder: true,
            isRequired: true,
          },
        },
      },
    });

    if (!lesson) throw new NotFoundError('Lição');
    if (!lesson.isPublished && user.role !== 'admin') throw new NotFoundError('Lição');

    const courseId = lesson.module.courseId;

    // Enrollment check (admin bypasses)
    if (user.role !== 'admin') {
      const enrollment = await prisma.enrollment.findFirst({
        where: { userId: user.id, courseId },
      });
      if (!enrollment) throw new AuthorizationError('Você não está matriculado neste curso.');
    }

    // Prerequisite check (admin bypasses)
    if (user.role !== 'admin' && lesson.prerequisiteId) {
      const prereqProgress = await prisma.lessonProgress.findUnique({
        where: { userId_lessonId: { userId: user.id, lessonId: lesson.prerequisiteId } },
      });
      const prereqCompleted = prereqProgress?.status === 'completed';

      if (!prereqCompleted) {
        throw new AuthorizationError('Você precisa completar a aula pré-requisito antes de acessar esta aula.');
      }

      // If prerequisite lesson has requiresQuizPass, also check quiz
      const prereqLesson = await prisma.lesson.findUnique({
        where: { id: lesson.prerequisiteId },
        select: { requiresQuizPass: true, quiz: { select: { id: true } } },
      });
      if (prereqLesson?.requiresQuizPass && prereqLesson.quiz) {
        const quizPassed = await prisma.quizAttempt.findFirst({
          where: { userId: user.id, quizId: prereqLesson.quiz.id, passed: true },
        });
        if (!quizPassed) {
          throw new AuthorizationError('Você precisa ser aprovado no quiz da aula anterior para desbloquear esta aula.');
        }
      }
    }

    // Fetch user progress
    const progress = await prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId: user.id, lessonId } },
    });

    // Build navigation: prev/next lessons across modules
    const allModules = await prisma.module.findMany({
      where: { courseId, isPublished: true },
      orderBy: { displayOrder: 'asc' },
      include: {
        lessons: {
          where: { isPublished: true },
          orderBy: { displayOrder: 'asc' },
          select: { id: true, title: true, slug: true, moduleId: true },
        },
      },
    });

    // Flatten all lessons in order
    const allLessons = allModules.flatMap((m) =>
      m.lessons.map((l) => ({ ...l, moduleTitle: m.title }))
    );
    const currentIndex = allLessons.findIndex((l) => l.id === lessonId);

    const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
    const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

    apiLogger.info({ lessonId, userId: user.id }, 'Lesson detail fetched');

    return NextResponse.json({
      lesson: {
        id: lesson.id,
        title: lesson.title,
        slug: lesson.slug,
        description: lesson.description,
        content: lesson.content,
        estimatedMinutes: lesson.estimatedMinutes,
        aiSummary: lesson.aiSummary,
        aiKeyPoints: lesson.aiKeyPoints ? JSON.parse(lesson.aiKeyPoints) : null,
        leiArticles: lesson.leiArticles ? JSON.parse(lesson.leiArticles) : null,
        module: {
          id: lesson.module.id,
          title: lesson.module.title,
          courseId,
        },
        documents: lesson.documents.map((ld) => ({
          id: ld.id,
          displayOrder: ld.displayOrder,
          isRequired: ld.isRequired,
          note: ld.note,
          document: ld.document,
        })),
        videos: lesson.videos,
      },
      progress: progress
        ? {
            status: progress.status,
            startedAt: progress.startedAt,
            completedAt: progress.completedAt,
            lastAccessedAt: progress.lastAccessedAt,
            timeSpentSeconds: progress.timeSpentSeconds,
            contentRead: progress.contentRead,
            videosWatched: progress.videosWatched ? JSON.parse(progress.videosWatched) : [],
            documentsViewed: progress.documentsViewed ? JSON.parse(progress.documentsViewed) : [],
          }
        : null,
      navigation: {
        prev: prevLesson
          ? { id: prevLesson.id, title: prevLesson.title, slug: prevLesson.slug, moduleTitle: prevLesson.moduleTitle }
          : null,
        next: nextLesson
          ? { id: nextLesson.id, title: nextLesson.title, slug: nextLesson.slug, moduleTitle: nextLesson.moduleTitle }
          : null,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
