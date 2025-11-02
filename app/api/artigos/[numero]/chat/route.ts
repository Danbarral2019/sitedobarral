import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

interface ChatRequest {
  question: string;
  conversationId?: string;
}

// POST /api/artigos/[numero]/chat - IA Assistente (Placeholder para futura ativação)
export async function POST(
  request: NextRequest,
  { params }: { params: { numero: string } }
) {
  try {
    const articleNumber = params.numero;
    const body = await request.json() as ChatRequest;

    if (!articleNumber) {
      return NextResponse.json(
        { error: 'Número do artigo é obrigatório' },
        { status: 400 }
      );
    }

    if (!body.question || body.question.trim().length === 0) {
      return NextResponse.json(
        { error: 'Pergunta é obrigatória' },
        { status: 400 }
      );
    }

    // Gerar ou usar conversationId existente
    const conversationId = body.conversationId || randomUUID();

    // Buscar documentos relevantes para contexto futuro da IA
    const relevantDocs = await prisma.document.findMany({
      where: {
        leiArticles: {
          contains: articleNumber,
        },
        // Priorizar documentos públicos ou com summary
        OR: [
          { isPublic: true },
          { summary: { not: null } },
        ],
      },
      select: {
        id: true,
        title: true,
        category: true,
        summary: true,
        description: true,
        leiArticles: true,
      },
      take: 5, // Limitar para não sobrecarregar contexto
      orderBy: [
        { summary: 'desc' }, // Priorizar docs com summary
        { uploadedAt: 'desc' },
      ],
    });

    // Criar IDs de contexto (para futuro uso na IA)
    const contextDocIds = relevantDocs.map(d => d.id);

    // Obter informações do usuário (se autenticado)
    let userId: string | undefined;
    let userEmail: string | undefined;

    // TODO: Extrair do JWT quando implementar autenticação no chat
    // const token = request.headers.get('authorization');

    // Obter IP do usuário
    const ip = request.headers.get('x-forwarded-for') ||
                request.headers.get('x-real-ip') ||
                'unknown';

    // Salvar pergunta no histórico (para analytics futuros)
    const questionRecord = await prisma.articleQuestion.create({
      data: {
        articleNumber,
        question: body.question.trim(),
        conversationId,
        contextDocIds: JSON.stringify(contextDocIds),
        isPlaceholder: true, // IA não ativa ainda
        userId,
        userEmail,
        ip,
      },
    });

    // PLACEHOLDER: Resposta genérica até IA ser ativada
    const placeholderAnswer = `Esta funcionalidade estará disponível em breve!

Quando ativada, nosso assistente de IA poderá responder perguntas sobre o Artigo ${articleNumber} baseado em ${relevantDocs.length} documentos relacionados.

**Sua pergunta foi registrada:**
"${body.question}"

**Documentos relacionados encontrados:**
${relevantDocs.map((doc, i) => `${i + 1}. ${doc.title} (${doc.category})`).join('\n')}

Aguarde a ativação do plano premium para obter respostas personalizadas!`;

    // Preparar fontes (documentos que seriam usados pela IA)
    const sources = relevantDocs.map(doc => ({
      id: doc.id,
      title: doc.title,
      category: doc.category,
      excerpt: doc.summary || doc.description || 'Sem resumo disponível',
    }));

    return NextResponse.json({
      conversationId,
      questionId: questionRecord.id,
      answer: placeholderAnswer,
      sources,
      isPlaceholder: true, // Indica que é resposta placeholder
      meta: {
        articleNumber,
        relevantDocsCount: relevantDocs.length,
        message: 'IA não ativada. Esta é uma resposta placeholder.',
      },
    });

  } catch (error) {
    console.error('Erro no chat:', error);
    return NextResponse.json(
      { error: 'Erro ao processar pergunta' },
      { status: 500 }
    );
  }
}

// GET /api/artigos/[numero]/chat?conversationId=XXX - Obter histórico de conversa
export async function GET(
  request: NextRequest,
  { params }: { params: { numero: string } }
) {
  try {
    const articleNumber = params.numero;
    const searchParams = request.nextUrl.searchParams;
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar todas as perguntas desta conversa
    const questions = await prisma.articleQuestion.findMany({
      where: {
        articleNumber,
        conversationId,
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
        question: true,
        answer: true,
        isPlaceholder: true,
        createdAt: true,
        wasHelpful: true,
      },
    });

    return NextResponse.json({
      conversationId,
      articleNumber,
      messages: questions.map(q => ({
        id: q.id,
        question: q.question,
        answer: q.answer,
        isPlaceholder: q.isPlaceholder,
        timestamp: q.createdAt,
        feedback: q.wasHelpful !== null ? {
          wasHelpful: q.wasHelpful,
        } : null,
      })),
      count: questions.length,
    });

  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar histórico de conversa' },
      { status: 500 }
    );
  }
}
