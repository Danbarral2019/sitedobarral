import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiLogger } from "@/lib/logger";

interface FeedbackRequest {
  wasHelpful: boolean;
}

// PATCH /api/artigos/[numero]/chat/[questionId]/feedback
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string; questionId: string }> }
) {
  try {
    const { numero: articleNumber, questionId } = await params;
    const body = await request.json() as FeedbackRequest;

    // Validar input
    if (typeof body.wasHelpful !== 'boolean') {
      return NextResponse.json(
        { error: 'wasHelpful deve ser true ou false' },
        { status: 400 }
      );
    }

    // Verificar se a pergunta existe e pertence ao artigo
    const question = await prisma.articleQuestion.findFirst({
      where: {
        id: questionId,
        articleNumber,
      },
    });

    if (!question) {
      return NextResponse.json(
        { error: 'Pergunta não encontrada' },
        { status: 404 }
      );
    }

    // Atualizar feedback
    const updated = await prisma.articleQuestion.update({
      where: { id: questionId },
      data: {
        wasHelpful: body.wasHelpful,
      },
      select: {
        id: true,
        wasHelpful: true,
        createdAt: true,
      },
    });

    console.log(`✅ Feedback registrado: Art. ${articleNumber}, Q: ${questionId}, Helpful: ${body.wasHelpful}`);

    return NextResponse.json({
      success: true,
      questionId: updated.id,
      feedback: {
        wasHelpful: updated.wasHelpful,
        updatedAt: updated.createdAt.toISOString(),
      },
    });

  } catch (error) {
    apiLogger.error({ err: error }, 'Erro ao salvar feedback:');
    return NextResponse.json(
      { error: 'Erro ao processar feedback' },
      { status: 500 }
    );
  }
}
