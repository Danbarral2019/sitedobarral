import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/errors/error-handler';
import { NotFoundError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';
import { UpdateQuizSchema } from '@/lib/validation-schemas';
import { verifyAdmin } from '@/lib/api-middleware';

/**
 * GET: Busca um quiz por ID com perguntas
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdmin(request);
    if (auth.error) return auth.response;

    const { id } = await params;

    const quiz = await prisma.quiz.findUnique({
      where: { id },
      include: {
        lesson: { select: { id: true, title: true, slug: true, moduleId: true } },
        questions: { orderBy: { displayOrder: 'asc' } },
        _count: { select: { attempts: true } },
      },
    });

    if (!quiz) {
      throw new NotFoundError('Quiz');
    }

    // Parse JSON options de cada pergunta
    const questionsWithParsed = quiz.questions.map(q => ({
      ...q,
      options: JSON.parse(q.options),
    }));

    return NextResponse.json({ quiz: { ...quiz, questions: questionsWithParsed } });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT: Atualiza um quiz
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdmin(request);
    if (auth.error) return auth.response;

    const { id } = await params;
    const body = await request.json();
    const data = UpdateQuizSchema.parse(body);

    const existing = await prisma.quiz.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Quiz');
    }

    const quiz = await prisma.quiz.update({
      where: { id },
      data,
    });

    apiLogger.info({ quizId: id }, 'Quiz updated');
    return NextResponse.json({ quiz });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE: Remove um quiz (cascade nas perguntas e tentativas)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdmin(request);
    if (auth.error) return auth.response;

    const { id } = await params;

    const existing = await prisma.quiz.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Quiz');
    }

    await prisma.quiz.delete({ where: { id } });

    apiLogger.info({ quizId: id }, 'Quiz deleted');
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
