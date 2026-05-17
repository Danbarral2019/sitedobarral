import { NextRequest, NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { prisma } from '@/lib/prisma';
import { NotFoundError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';
import { CreateQuizSchema } from '@/lib/validation-schemas';

/**
 * POST: Cria um novo quiz vinculado a uma lição
 */
export const POST = withAdminApi(async (request: NextRequest) => {
  const body = await request.json();
  const data = CreateQuizSchema.parse(body);

    // Verificar se a lição existe
    const lesson = await prisma.lesson.findUnique({
      where: { id: data.lessonId },
      include: { quiz: true },
    });
    if (!lesson) {
      throw new NotFoundError('Lição');
    }
    if (lesson.quiz) {
      return NextResponse.json(
        { error: 'Esta lição já possui um quiz.' },
        { status: 409 }
      );
    }

    const quiz = await prisma.quiz.create({
      data: {
        lessonId: data.lessonId,
        title: data.title,
        description: data.description,
        passingScore: data.passingScore ?? 60,
        maxAttempts: data.maxAttempts,
        timeLimitMinutes: data.timeLimitMinutes,
        shuffleQuestions: data.shuffleQuestions ?? false,
        isPublished: data.isPublished ?? false,
      },
    });

    apiLogger.info({ quizId: quiz.id, lessonId: data.lessonId }, 'Quiz created');
    return NextResponse.json({ quiz }, { status: 201 });
});

/**
 * GET: Listar quizzes (filtro por lessonId opcional)
 */
export const GET = withAdminApi(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
    const lessonId = searchParams.get('lessonId');

    const quizzes = await prisma.quiz.findMany({
      where: lessonId ? { lessonId } : undefined,
      include: {
        lesson: { select: { id: true, title: true, slug: true } },
        _count: { select: { questions: true, attempts: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ quizzes });
});
