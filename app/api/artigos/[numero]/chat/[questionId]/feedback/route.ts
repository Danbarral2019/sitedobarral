import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyConversationToken } from '@/lib/artigos/conversation-token';
import { NotFoundError, ValidationError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';
import { withUserApi } from '@/lib/api/handler';

const FeedbackSchema = z.object({
  wasHelpful: z.boolean(),
});

// PATCH /api/artigos/[numero]/chat/[questionId]/feedback
// Exige login (a IA do artigo é só para usuários autenticados) e o token da
// conversa (Authorization: Bearer) emitido pelo POST do chat.
export const PATCH = withUserApi<{ numero: string; questionId: string }>(
  async (request, { params }) => {
    const { numero: articleNumber, questionId } = params;
    const body = await request.json().catch(() => ({}));
    const parsed = FeedbackSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError('wasHelpful deve ser true ou false');
    }

    // Verificar se a pergunta existe e pertence ao artigo
    const question = await prisma.articleQuestion.findFirst({
      where: {
        id: questionId,
        articleNumber,
      },
      select: { id: true, conversationId: true },
    });

    // Pergunta sem conversa não tem dono verificável: tratada como inexistente
    if (!question || !question.conversationId) {
      throw new NotFoundError('Pergunta');
    }

    await verifyConversationToken(request, question.conversationId);

    const updated = await prisma.articleQuestion.update({
      where: { id: questionId },
      data: {
        wasHelpful: parsed.data.wasHelpful,
      },
      select: {
        id: true,
        wasHelpful: true,
        createdAt: true,
      },
    });

    apiLogger.info(
      { articleNumber, questionId, wasHelpful: parsed.data.wasHelpful },
      'Feedback do chat de artigo registrado'
    );

    return NextResponse.json({
      success: true,
      questionId: updated.id,
      feedback: {
        wasHelpful: updated.wasHelpful,
        updatedAt: updated.createdAt.toISOString(),
      },
    });
  },
);
