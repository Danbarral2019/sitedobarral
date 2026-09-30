import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withUserApi } from '@/lib/api/handler';

interface HistoryMessage {
  id: string;
  question: string;
  answer: string | null;
  wasHelpful: boolean | null;
  createdAt: string;
  conversationId: string;
}

// GET /api/artigos/[numero]/chat/history
// Histórico das perguntas do próprio usuário (exige login).
export const GET = withUserApi<{ numero: string }>(async (request, { user, params }) => {
  const { numero: articleNumber } = params;
  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get('conversationId');

  // Buscar histórico
  const where: Record<string, unknown> = {
    articleNumber,
    userId: user.userId,
    isPlaceholder: false, // Apenas perguntas com respostas reais
  };

  // Se conversationId fornecido, filtrar por ele
  if (conversationId) {
    where.conversationId = conversationId;
  }

  const questions = await prisma.articleQuestion.findMany({
    where,
    select: {
      id: true,
      question: true,
      answer: true,
      wasHelpful: true,
      createdAt: true,
      conversationId: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 50, // Limitar a 50 perguntas mais recentes
  });

  // Agrupar por conversationId
  const conversations = questions.reduce((acc, q) => {
    const convId = q.conversationId || 'default';
    if (!acc[convId]) {
      acc[convId] = [];
    }
    acc[convId].push({
      id: q.id,
      question: q.question,
      answer: q.answer,
      wasHelpful: q.wasHelpful,
      createdAt: q.createdAt.toISOString(),
      conversationId: q.conversationId || '',
    });
    return acc;
  }, {} as Record<string, HistoryMessage[]>);

  // Se conversationId específico, retornar apenas essa conversa
  if (conversationId && conversations[conversationId]) {
    return NextResponse.json({
      messages: conversations[conversationId],
      conversationId,
      totalMessages: conversations[conversationId].length,
    });
  }

  // Retornar todas as conversações
  return NextResponse.json({
    conversations,
    totalConversations: Object.keys(conversations).length,
    totalMessages: questions.length,
  });
});
