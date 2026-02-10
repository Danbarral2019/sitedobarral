import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { handleApiError } from '@/lib/errors/error-handler';
import { AuthenticationError, AuthorizationError, NotFoundError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { UpdateLessonProgressSchema } from '@/lib/validation-schemas';

export async function POST(
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

    // Verify lesson exists and get courseId
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { module: { select: { courseId: true } } },
    });
    if (!lesson) throw new NotFoundError('Lição');

    // Enrollment check (admin bypasses)
    if (user.role !== 'admin') {
      const enrollment = await prisma.enrollment.findFirst({
        where: { userId: user.id, courseId: lesson.module.courseId },
      });
      if (!enrollment) throw new AuthorizationError('Você não está matriculado neste curso.');
    }

    // Parse and validate body
    const body = await request.json();
    const data = UpdateLessonProgressSchema.parse(body);

    // Get existing progress
    const existing = await prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId: user.id, lessonId } },
    });

    const now = new Date();

    // Build update data
    const updateData: Record<string, unknown> = {
      lastAccessedAt: now,
    };

    if (data.status !== undefined) {
      updateData.status = data.status;

      if (data.status === 'in_progress' && !existing?.startedAt) {
        updateData.startedAt = now;
      }

      if (data.status === 'completed') {
        updateData.completedAt = now;
        if (!existing?.startedAt) {
          updateData.startedAt = now;
        }
      }
    }

    if (data.contentRead !== undefined) {
      updateData.contentRead = data.contentRead;
    }

    // Merge videoWatched into videosWatched array
    if (data.videoWatched) {
      const currentVideos: string[] = existing?.videosWatched
        ? JSON.parse(existing.videosWatched)
        : [];
      if (!currentVideos.includes(data.videoWatched)) {
        currentVideos.push(data.videoWatched);
      }
      updateData.videosWatched = JSON.stringify(currentVideos);
    }

    // Merge documentViewed into documentsViewed array
    if (data.documentViewed) {
      const currentDocs: string[] = existing?.documentsViewed
        ? JSON.parse(existing.documentsViewed)
        : [];
      if (!currentDocs.includes(data.documentViewed)) {
        currentDocs.push(data.documentViewed);
      }
      updateData.documentsViewed = JSON.stringify(currentDocs);
    }

    // Increment timeSpentSeconds
    if (data.timeSpentSeconds !== undefined && data.timeSpentSeconds > 0) {
      updateData.timeSpentSeconds = (existing?.timeSpentSeconds ?? 0) + data.timeSpentSeconds;
    }

    // Upsert progress
    const progress = await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId: user.id, lessonId } },
      create: {
        userId: user.id,
        lessonId,
        status: data.status ?? 'in_progress',
        startedAt: now,
        lastAccessedAt: now,
        contentRead: data.contentRead ?? false,
        timeSpentSeconds: data.timeSpentSeconds ?? 0,
        videosWatched: data.videoWatched ? JSON.stringify([data.videoWatched]) : null,
        documentsViewed: data.documentViewed ? JSON.stringify([data.documentViewed]) : null,
      },
      update: updateData,
    });

    apiLogger.info({ lessonId, userId: user.id, status: progress.status }, 'Lesson progress updated');

    return NextResponse.json({
      progress: {
        status: progress.status,
        startedAt: progress.startedAt,
        completedAt: progress.completedAt,
        lastAccessedAt: progress.lastAccessedAt,
        timeSpentSeconds: progress.timeSpentSeconds,
        contentRead: progress.contentRead,
        videosWatched: progress.videosWatched ? JSON.parse(progress.videosWatched) : [],
        documentsViewed: progress.documentsViewed ? JSON.parse(progress.documentsViewed) : [],
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
