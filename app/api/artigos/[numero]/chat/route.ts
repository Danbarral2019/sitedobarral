import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';
import { queryGeminiText } from '@/lib/gemini/cached-client';
import { LEI_14133_ARTIGOS } from '@/data/lei-14133-artigos';
import { findRelatedArticles } from '@/data/lei-14133-cross-references';

interface ChatRequest {
  question: string;
  conversationId?: string;
}

type RouteContext = {
  params: Promise<{
    numero: string;
  }> | {
    numero: string;
  };
};

// POST /api/artigos/[numero]/chat - IA Assistente
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Handle both Promise and non-Promise params (Next.js 15 inconsistency)
    const resolvedParams = await Promise.resolve(context.params);
    const articleNumber = resolvedParams.numero;
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

    // Buscar histórico da conversa se existir (para follow-up)
    let conversationHistory: { question: string; answer: string }[] = [];
    if (body.conversationId) {
      const previousMessages = await prisma.articleQuestion.findMany({
        where: {
          conversationId: body.conversationId,
          isPlaceholder: false, // Apenas mensagens já respondidas
        },
        orderBy: { createdAt: 'desc' },
        take: 3, // Últimas 3 mensagens para contexto
        select: {
          question: true,
          answer: true,
        },
      });
      // Inverter para ordem cronológica
      conversationHistory = previousMessages.reverse().filter(m => m.answer !== null) as { question: string; answer: string }[];
      console.log(`[Chat API] Follow-up: ${conversationHistory.length} mensagens anteriores encontradas`);
    }

    // Buscar documentos do artigo atual
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
      take: 5,
      orderBy: [
        { summary: 'desc' },
        { uploadedAt: 'desc' },
      ],
    });

    // BUSCA CROSS-ARTICLE: Detectar se a pergunta envolve outros temas
    const { articles: relatedArticleNumbers, topics: matchedTopics } = findRelatedArticles(body.question, articleNumber);
    console.log(`[Chat API] Cross-reference: Tópicos detectados: ${matchedTopics.join(', ') || 'nenhum'}`);
    console.log(`[Chat API] Cross-reference: Artigos relacionados: ${relatedArticleNumbers.join(', ') || 'nenhum'}`);

    // Buscar artigos relacionados da Lei 14.133
    const relatedArticles = relatedArticleNumbers
      .map(num => ({ numero: num, ...LEI_14133_ARTIGOS[num] }))
      .filter(art => art.ementa); // Filtrar apenas artigos que existem

    // Buscar documentos dos artigos relacionados (se houver)
    let crossReferenceDocs: typeof relevantDocs = [];
    if (relatedArticleNumbers.length > 0) {
      crossReferenceDocs = await prisma.document.findMany({
        where: {
          AND: [
            {
              OR: relatedArticleNumbers.map(num => ({
                leiArticles: { contains: num },
              })),
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
        take: 3, // Limitar documentos cross-reference
        orderBy: [
          { summary: 'desc' },
          { uploadedAt: 'desc' },
        ],
      });
      console.log(`[Chat API] Cross-reference: ${crossReferenceDocs.length} documentos adicionais encontrados`);
    }

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

    // Construir contexto dos artigos relacionados (cross-reference)
    let crossReferenceContext = '';
    if (relatedArticles.length > 0) {
      crossReferenceContext = `

**ARTIGOS RELACIONADOS DA LEI 14.133/2021 (para complementar a resposta):**
${relatedArticles.map(art => `
---
**Artigo ${art.numero}** ${art.titulo ? `(${art.titulo})` : ''}
${art.capituloCompleto ? `Capítulo: ${art.capituloCompleto}` : ''}
Texto: ${art.ementa.substring(0, 1000)}${art.ementa.length > 1000 ? '...' : ''}
`).join('\n')}`;
    }

    // Construir contexto dos documentos cross-reference
    let crossReferenceDocsContext = '';
    if (crossReferenceDocs.length > 0) {
      crossReferenceDocsContext = `

**DOCUMENTOS DOS ARTIGOS RELACIONADOS:**
${crossReferenceDocs.map((doc, i) => `
**Documento Adicional ${i + 1}: ${doc.title}**
Categoria: ${doc.category}
Artigos vinculados: ${doc.leiArticles || 'N/A'}
${doc.summary ? `Resumo: ${doc.summary}` : doc.description ? `Descrição: ${doc.description}` : ''}
`).join('\n')}`;
    }

    // Flag para indicar se há cross-reference
    const hasCrossReference = relatedArticles.length > 0;

    // Flag para indicar se é um follow-up
    const isFollowUp = conversationHistory.length > 0;

    // Construir contexto da conversa anterior
    const conversationContext = isFollowUp
      ? `
**CONTEXTO DA CONVERSA ANTERIOR:**
${conversationHistory.map((msg, i) => `
[Pergunta ${i + 1}]: ${msg.question}
[Resposta ${i + 1}]: ${msg.answer.substring(0, 500)}${msg.answer.length > 500 ? '...' : ''}
`).join('')}
---
IMPORTANTE: O usuário está dando continuidade à conversa acima. Considere o contexto das perguntas anteriores ao responder.
`
      : '';

    const prompt = `Você é um assistente especializado em Licitações e Contratos Públicos, especificamente na Lei nº 14.133/2021 (Nova Lei de Licitações).

**CONTEXTO DO ARTIGO PRINCIPAL:**
Artigo ${articleNumber} da Lei 14.133/2021
${article.titulo ? `Título: ${article.titulo}` : ''}
${article.capituloCompleto ? `Capítulo: ${article.capituloCompleto}` : ''}
${article.secao ? `Seção: ${article.secao}` : ''}

**TEXTO COMPLETO DO ARTIGO ${articleNumber}:**
${article.ementa}

**DOCUMENTOS RELACIONADOS AO ARTIGO ${articleNumber}:**
${docsContext}
${crossReferenceContext}
${crossReferenceDocsContext}
${conversationContext}
**PERGUNTA${isFollowUp ? ' DE FOLLOW-UP' : ''} DO USUÁRIO:**
${body.question}

**INSTRUÇÕES:**
1. Responda de forma clara, objetiva e técnica
2. ${hasCrossReference
      ? `A pergunta do usuário pode envolver temas tratados em OUTROS ARTIGOS da Lei (${matchedTopics.join(', ')}). Se for o caso, USE AS INFORMAÇÕES DOS ARTIGOS RELACIONADOS fornecidos acima para complementar sua resposta de forma completa.`
      : 'Base sua resposta PRIMARIAMENTE no texto do artigo fornecido'}
3. Se o artigo ${articleNumber} NÃO trata diretamente do tema perguntado, mas foram fornecidos artigos relacionados, EXPLIQUE que o tema está em outros artigos e forneça a resposta com base nos artigos relacionados
4. Cite os números dos artigos quando usar informações deles (Ex: "Conforme o Art. 124...")
5. Use os documentos como contexto adicional quando relevante
6. Se a pergunta não puder ser respondida com as informações disponíveis, seja honesto sobre isso
7. Use linguagem técnica jurídica apropriada, mas mantenha clareza
8. Se aplicável, mencione implicações práticas ou pontos de atenção
${isFollowUp ? `9. Esta é uma pergunta de FOLLOW-UP. O usuário está continuando a conversa anterior. Considere o contexto das perguntas e respostas anteriores ao formular sua resposta. Se a pergunta for ambígua (ex: "e no caso de...", "mas e se..."), interprete-a em relação ao tema da conversa anterior.` : ''}

Responda agora:`;

    // Consultar Gemini com caching
    console.log(`🤖 Gemini Query for Article ${articleNumber}...`);
    const geminiResult = await queryGeminiText(prompt, {
      model: 'gemini-2.0-flash',
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
        geminiModel: 'gemini-2.0-flash',
        geminiTokens: geminiResult.tokens ? geminiResult.tokens.total : null,
        geminiLatency: geminiResult.latency,
        geminiCached: geminiResult.cached,
        respondedAt: new Date(),
      },
    });

    // Preparar fontes para resposta (incluindo docs cross-reference)
    const allDocs = [...relevantDocs, ...crossReferenceDocs];
    // Remover duplicados por ID
    const uniqueDocs = allDocs.filter((doc, index, self) =>
      index === self.findIndex(d => d.id === doc.id)
    );

    const sources = uniqueDocs.map(doc => ({
      id: doc.id,
      title: doc.title,
      category: doc.category,
      excerpt: doc.summary || doc.description || 'Sem resumo disponível',
    }));

    console.log(`✅ Gemini response generated (${geminiResult.latency}ms, cached: ${geminiResult.cached})`);
    if (hasCrossReference) {
      console.log(`✅ Cross-reference: ${relatedArticles.length} artigos e ${crossReferenceDocs.length} docs adicionais incluídos`);
    }

    return NextResponse.json({
      conversationId,
      questionId: questionRecord.id,
      answer,
      sources,
      isPlaceholder: false,
      isFollowUp,
      meta: {
        articleNumber,
        articleTitle: article.titulo,
        relevantDocsCount: relevantDocs.length,
        conversationLength: conversationHistory.length + 1,
        crossReference: hasCrossReference ? {
          topics: matchedTopics,
          relatedArticles: relatedArticleNumbers,
          additionalDocsCount: crossReferenceDocs.length,
        } : null,
        gemini: {
          model: 'gemini-2.0-flash',
          cached: geminiResult.cached,
          latency: geminiResult.latency,
          tokens: geminiResult.tokens,
        },
      },
    });

  } catch (error) {
    console.error('[Chat API] ERRO DETALHADO:', error);
    console.error('[Chat API] Error name:', error instanceof Error ? error.name : 'Unknown');
    console.error('[Chat API] Error message:', error instanceof Error ? error.message : String(error));
    console.error('[Chat API] Error stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json(
      {
        error: 'Erro ao processar pergunta',
        details: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : 'Unknown'
      },
      { status: 500 }
    );
  }
}

// GET /api/artigos/[numero]/chat?conversationId=XXX - Obter histórico de conversa
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Handle both Promise and non-Promise params (Next.js 15 inconsistency)
    const resolvedParams = await Promise.resolve(context.params);
    const articleNumber = resolvedParams.numero;
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
    console.error('[Chat API GET] ERRO DETALHADO:', error);
    console.error('[Chat API GET] Error message:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      {
        error: 'Erro ao buscar histórico de conversa',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
