import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/errors/error-handler';
import { NotFoundError } from '@/lib/errors/api-error';
import { addXp, awardBadge, XP_VALUES } from '@/lib/gamification';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdmin(request);
    if (auth.error) return auth.response;

    const { id } = await params;

    const comment = await prisma.lessonComment.findUnique({
      where: { id },
      include: { lesson: { include: { module: { select: { courseId: true } } } } },
    });

    if (!comment) throw new NotFoundError('Comentario');

    // Toggle isBestAnswer
    const newValue = !comment.isBestAnswer;

    await prisma.lessonComment.update({
      where: { id },
      data: { isBestAnswer: newValue },
    });

    // If marking as best answer, award XP and badge to comment author
    if (newValue) {
      const courseId = comment.lesson.module.courseId;
      addXp(comment.userId, courseId, XP_VALUES.BEST_ANSWER).catch(() => {});
      awardBadge(comment.userId, 'best_answer', courseId).catch(() => {});
    }

    return NextResponse.json({ isBestAnswer: newValue });
  } catch (error) {
    return handleApiError(error);
  }
}
