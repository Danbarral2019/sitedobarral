import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

interface QuestionData {
  id: string;
  articleNumber: string;
  question: string;
  answer: string | null;
  conversationId: string | null;
  wasHelpful: boolean | null;
  createdAt: Date;
}

interface GroupedQuestions {
  today: QuestionData[];
  yesterday: QuestionData[];
  thisWeek: QuestionData[];
  thisMonth: QuestionData[];
  older: QuestionData[];
}

/**
 * GET /api/chat/history
 *
 * Retorna o histórico de perguntas do usuário autenticado
 * agrupadas por período de tempo
 */
export async function GET(request: NextRequest) {
  try {
    // Verificação de autenticação
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      );
    }

    const userId = payload.userId;

    // Buscar todas as perguntas do usuário
    const questions = await prisma.articleQuestion.findMany({
      where: {
        userId: userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        articleNumber: true,
        question: true,
        answer: true,
        conversationId: true,
        wasHelpful: true,
        createdAt: true,
      },
    });

    // Calcular datas de referência
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneMonthAgo = new Date(today);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    // Agrupar por período
    const grouped: GroupedQuestions = {
      today: [],
      yesterday: [],
      thisWeek: [],
      thisMonth: [],
      older: [],
    };

    questions.forEach((q) => {
      const createdAt = new Date(q.createdAt);

      if (createdAt >= today) {
        grouped.today.push(q);
      } else if (createdAt >= yesterday) {
        grouped.yesterday.push(q);
      } else if (createdAt >= oneWeekAgo) {
        grouped.thisWeek.push(q);
      } else if (createdAt >= oneMonthAgo) {
        grouped.thisMonth.push(q);
      } else {
        grouped.older.push(q);
      }
    });

    // Estatísticas
    const stats = {
      total: questions.length,
      helpful: questions.filter(q => q.wasHelpful === true).length,
      notHelpful: questions.filter(q => q.wasHelpful === false).length,
      unanswered: questions.filter(q => !q.answer).length,
      uniqueArticles: new Set(questions.map(q => q.articleNumber)).size,
    };

    return NextResponse.json({
      success: true,
      data: {
        questions: grouped,
        stats,
      },
    });

  } catch (error) {
    console.error('Erro ao buscar histórico de perguntas:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar histórico' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/chat/history
 *
 * Limpa todo o histórico de perguntas do usuário
 * Query params:
 * - id: ID específico de uma pergunta para deletar (opcional)
 */
export async function DELETE(request: NextRequest) {
  try {
    // Verificação de autenticação
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      );
    }

    const userId = payload.userId;
    const searchParams = request.nextUrl.searchParams;
    const questionId = searchParams.get('id');

    if (questionId) {
      // Deletar apenas uma pergunta específica
      const deleted = await prisma.articleQuestion.deleteMany({
        where: {
          id: questionId,
          userId: userId, // Garantir que o usuário só pode deletar suas próprias perguntas
        },
      });

      return NextResponse.json({
        success: true,
        deleted: deleted.count,
      });
    } else {
      // Deletar todo o histórico do usuário
      const deleted = await prisma.articleQuestion.deleteMany({
        where: {
          userId: userId,
        },
      });

      return NextResponse.json({
        success: true,
        deleted: deleted.count,
      });
    }

  } catch (error) {
    console.error('Erro ao deletar histórico:', error);
    return NextResponse.json(
      { error: 'Erro ao deletar histórico' },
      { status: 500 }
    );
  }
}
