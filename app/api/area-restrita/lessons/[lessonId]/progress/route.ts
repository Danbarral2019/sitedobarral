import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { handleApiError } from '@/lib/errors/error-handler';
import { AuthenticationError, AuthorizationError, NotFoundError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { UpdateLessonProgressSchema } from '@/lib/validation-schemas';
import { sendCourseWelcomeEmail, sendModuleCompletionEmail } from '@/lib/email';
import { addXp, updateStreak, checkAndAwardBadges, XP_VALUES } from '@/lib/gamification';
import { runAfterResponse } from '@/lib/api/after-response';
import { courses } from '@/data/courses';

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

    // Enrollment check with expiry verification (admin bypasses)
    if (user.role !== 'admin') {
      const enrollment = await prisma.enrollment.findFirst({
        where: {
          userId: user.id,
          courseId: lesson.module.courseId,
          OR: [
            { isLifetime: true },
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
      });
      if (!enrollment) throw new AuthorizationError('Acesso expirado ou inexistente para este curso.');
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

    // Fire-and-forget: email notifications
    const courseId = lesson.module.courseId;
    const userId = user.id;
    const courseData = courses.find(c => c.id === courseId);

    if (courseData) {
      // Welcome email: first progress in this course
      if (!existing) {
        const count = await prisma.lessonProgress.count({
          where: { userId, lesson: { module: { courseId } } },
        });
        if (count === 1) {
          sendCourseWelcomeEmail(user.email, user.name, courseData.title, courseData.slug).catch(err =>
            console.error('[lms-notification] Welcome email error:', err)
          );
        }
      }

      // Module completion email: all lessons in module completed
      if (data.status === 'completed' && lesson.moduleId) {
        const totalInModule = await prisma.lesson.count({
          where: { moduleId: lesson.moduleId, isPublished: true },
        });
        const completedInModule = await prisma.lessonProgress.count({
          where: { userId, status: 'completed', lesson: { moduleId: lesson.moduleId } },
        });
        if (completedInModule >= totalInModule && totalInModule > 0) {
          const mod = await prisma.module.findUnique({
            where: { id: lesson.moduleId },
            select: { title: true },
          });
          if (mod) {
            sendModuleCompletionEmail(user.email, user.name, courseData.title, mod.title, courseData.slug).catch(err =>
              console.error('[lms-notification] Module completion email error:', err)
            );
          }

          // Gamification: module complete (agendado após a resposta via after())
          runAfterResponse(
            Promise.all([
              addXp(userId, courseId, XP_VALUES.COMPLETE_MODULE),
              checkAndAwardBadges(userId, courseId, 'module_complete'),
            ]).catch((err) => console.error('[gamification] module_complete error:', err))
          );
        }
      }
    }

    // Gamification triggers — agendados após a resposta via after()
    // (fire-and-forget sem after() é descartado no congelamento serverless).
    if (data.status === 'completed') {
      const gamifCourseId = lesson.module.courseId;
      runAfterResponse(
        Promise.all([
          addXp(user.id, gamifCourseId, XP_VALUES.COMPLETE_LESSON),
          updateStreak(user.id, gamifCourseId),
          checkAndAwardBadges(user.id, gamifCourseId, 'lesson_complete'),
        ]).catch((err) => console.error('[gamification] lesson_complete error:', err))
      );
    } else if (!existing) {
      // First interaction — at least update streak
      runAfterResponse(
        updateStreak(user.id, lesson.module.courseId).catch((err) =>
          console.error('[gamification] streak error:', err)
        )
      );
    }

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
