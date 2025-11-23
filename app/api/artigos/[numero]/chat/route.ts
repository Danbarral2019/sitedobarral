import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';
import { queryGeminiText } from '@/lib/gemini/cached-client';
import { LEI_14133_ARTIGOS } from '@/data/lei-14133-artigos';

interface ChatRequest {
  question: string;
  conversationId?: string;
}

type RouteContext = {
  params: {
    numero: string;
  };
};

// POST /api/artigos/[numero]/chat - IA Assistente
export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const articleNumber = params.numero;
    console.log(`[Chat API] Iniciando processamento para artigo: ${articleNumber}`);
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
        AND: [
          {
            leiArticles: {
              contains: articleNumber,
            },
          },
          {
            OR: [
              { isPublic: true },
              { summary: { not: null } },
            ],
          },
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

    // Buscar artigo da Lei 14.133
    const article = LEI_14133_ARTIGOS[articleNumber];

    if (!article) {
      return NextResponse.json(
        { error: `Artigo ${articleNumber} não encontrado` },
        { status: 404 }
      );
    }

    // Construir contexto rico para o Gemini
    const docsContext = relevantDocs.length > 0
      ? relevantDocs.map((doc, i) => `
**Documento ${i + 1}: ${doc.title}**
Categoria: ${doc.category}
${doc.summary ? `Resumo: ${doc.summary}` : doc.description ? `Descrição: ${doc.description}` : ''}
`).join('\n')
      : 'Nenhum documento adicional disponível.';

    const prompt = `Você é um assistente especializado em Licitações e Contratos Públicos, especificamente na Lei nº 14.133/2021 (Nova Lei de Licitações).

**CONTEXTO DO ARTIGO:**
Artigo ${articleNumber} da Lei 14.133/2021
${article.titulo ? `Título: ${article.titulo}` : ''}
${article.capituloCompleto ? `Capítulo: ${article.capituloCompleto}` : ''}
${article.secao ? `Seção: ${article.secao}` : ''}

**TEXTO COMPLETO DO ARTIGO:**
${article.ementa}

**DOCUMENTOS RELACIONADOS DISPONÍVEIS:**
${docsContext}

**PERGUNTA DO USUÁRIO:**
${body.question}

**INSTRUÇÕES:**
1. Responda de forma clara, objetiva e técnica
2. Base sua resposta PRIMARIAMENTE no texto do artigo fornecido
3. Use os documentos relacionados como contexto adicional quando relevante
4. Se a pergunta não puder ser respondida com as informações disponíveis, seja honesto sobre isso
5. Cite especificamente as fontes quando usar informações dos documentos
6. Use linguagem técnica jurídica apropriada, mas mantenha clareza
7. Se aplicável, mencione implicações práticas ou pontos de atenção

Responda agora:`;

    // Consultar Gemini com caching
    console.log(`🤖 Gemini Query for Article ${articleNumber}...`);
    const geminiResult = await queryGeminiText(prompt, {
      model: 'gemini-2.0-flash-exp',
      temperature: 0.7,
      maxOutputTokens: 2048,
      useCache: true,
      cacheTTL: 3600, // 1 hora
    });

    const answer = geminiResult.response;

    // Atualizar pergunta com a resposta
    await prisma.articleQuestion.update({
      where: { id: questionRecord.id },
      data: {
        answer,
        isPlaceholder: false,
        aiProvider: 'gemini',
        geminiModel: 'gemini-2.0-flash-exp',
        geminiTokens: geminiResult.tokens ? geminiResult.tokens.total : null,
        geminiLatency: geminiResult.latency,
        geminiCached: geminiResult.cached,
        respondedAt: new Date(),
      },
    });

    // Preparar fontes para resposta
    const sources = relevantDocs.map(doc => ({
      id: doc.id,
      title: doc.title,
      category: doc.category,
      excerpt: doc.summary || doc.description || 'Sem resumo disponível',
    }));

    console.log(`✅ Gemini response generated (${geminiResult.latency}ms, cached: ${geminiResult.cached})`);

    return NextResponse.json({
      conversationId,
      questionId: questionRecord.id,
      answer,
      sources,
      isPlaceholder: false,
      meta: {
        articleNumber,
        articleTitle: article.titulo,
        relevantDocsCount: relevantDocs.length,
        gemini: {
          model: 'gemini-2.0-flash-exp',
          cached: geminiResult.cached,
          latency: geminiResult.latency,
          tokens: geminiResult.tokens,
        },
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
  { params }: RouteContext
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
