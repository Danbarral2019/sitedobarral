import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

type QuestionSource = 'article' | 'assistant';

interface UnifiedQuestion {
  id: string;
  source: QuestionSource;
  question: string;
  answer: string | null;
  createdAt: Date;
  articleNumber: string | null;
  conversationId: string | null;
  wasHelpful: boolean | null;
  sources: unknown;
  legalSources: unknown;
}

interface GroupedQuestions {
  today: UnifiedQuestion[];
  yesterday: UnifiedQuestion[];
  thisWeek: UnifiedQuestion[];
  thisMonth: UnifiedQuestion[];
  older: UnifiedQuestion[];
}

function parseJson(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * GET /api/chat/history
 *
 * Histórico unificado: perguntas feitas em artigos da Lei (ArticleQuestion)
 * + consultas ao Assistente IA e busca global (SearchHistory).
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const userId = payload.userId;

    const [articleRows, searchRows] = await Promise.all([
      prisma.articleQuestion.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          articleNumber: true,
          question: true,
          answer: true,
          conversationId: true,
          wasHelpful: true,
          createdAt: true,
        },
      }),
      prisma.searchHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          query: true,
          aiAnswer: true,
          sources: true,
          legalSources: true,
          createdAt: true,
        },
      }),
    ]);

    const unified: UnifiedQuestion[] = [
      ...articleRows.map(q => ({
        id: q.id,
        source: 'article' as const,
        question: q.question,
        answer: q.answer,
        createdAt: q.createdAt,
        articleNumber: q.articleNumber,
        conversationId: q.conversationId,
        wasHelpful: q.wasHelpful,
        sources: null,
        legalSources: null,
      })),
      ...searchRows.map(s => ({
        id: s.id,
        source: 'assistant' as const,
        question: s.query,
        answer: s.aiAnswer,
        createdAt: s.createdAt,
        articleNumber: null,
        conversationId: null,
        wasHelpful: null,
        sources: parseJson(s.sources),
        legalSources: parseJson(s.legalSources),
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneMonthAgo = new Date(today);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const grouped: GroupedQuestions = {
      today: [],
      yesterday: [],
      thisWeek: [],
      thisMonth: [],
      older: [],
    };

    unified.forEach(q => {
      if (q.createdAt >= today) grouped.today.push(q);
      else if (q.createdAt >= yesterday) grouped.yesterday.push(q);
      else if (q.createdAt >= oneWeekAgo) grouped.thisWeek.push(q);
      else if (q.createdAt >= oneMonthAgo) grouped.thisMonth.push(q);
      else grouped.older.push(q);
    });

    const articleQuestions = unified.filter(q => q.source === 'article');
    const assistantQuestions = unified.filter(q => q.source === 'assistant');

    const stats = {
      total: unified.length,
      articleCount: articleQuestions.length,
      assistantCount: assistantQuestions.length,
      helpful: articleQuestions.filter(q => q.wasHelpful === true).length,
      notHelpful: articleQuestions.filter(q => q.wasHelpful === false).length,
      unanswered: unified.filter(q => !q.answer).length,
      uniqueArticles: new Set(
        articleQuestions.map(q => q.articleNumber).filter(Boolean)
      ).size,
    };

    return NextResponse.json({
      success: true,
      data: { questions: grouped, stats },
    });
  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar histórico' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/chat/history
 *
 * Query params:
 *  - id: ID da pergunta (obrigatório para deletar uma específica)
 *  - source: 'article' | 'assistant' (obrigatório quando id presente)
 *  Sem id: limpa tudo (ambas as tabelas) do usuário.
 */
export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const userId = payload.userId;
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const source = searchParams.get('source') as QuestionSource | null;

    if (id) {
      if (source === 'assistant') {
        const deleted = await prisma.searchHistory.deleteMany({
          where: { id, userId },
        });
        return NextResponse.json({ success: true, deleted: deleted.count });
      }
      // fallback para 'article' (compatibilidade com chamadas antigas sem source)
      const deleted = await prisma.articleQuestion.deleteMany({
        where: { id, userId },
      });
      return NextResponse.json({ success: true, deleted: deleted.count });
    }

    // Sem id: limpa tudo
    const [a, b] = await Promise.all([
      prisma.articleQuestion.deleteMany({ where: { userId } }),
      prisma.searchHistory.deleteMany({ where: { userId } }),
    ]);
    return NextResponse.json({
      success: true,
      deleted: a.count + b.count,
    });
  } catch (error) {
    console.error('Erro ao deletar histórico:', error);
    return NextResponse.json(
      { error: 'Erro ao deletar histórico' },
      { status: 500 }
    );
  }
}
