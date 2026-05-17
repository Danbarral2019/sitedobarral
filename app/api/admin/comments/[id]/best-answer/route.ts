import { NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { prisma } from '@/lib/prisma';
import { NotFoundError } from '@/lib/errors/api-error';
import { addXp, awardBadge, XP_VALUES } from '@/lib/gamification';

export const PATCH = withAdminApi<{ id: string }>(async (_request, { params }) => {
  const { id } = params;

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
});
