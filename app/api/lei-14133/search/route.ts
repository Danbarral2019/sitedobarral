import { NextRequest, NextResponse } from 'next/server';
import { LEI_14133_ARTIGOS } from '@/data/lei-14133-artigos';
import { queryGeminiText } from '@/lib/gemini/cached-client';
import { PRIMARY_GEMINI_MODEL } from '@/lib/gemini/config';
import { prisma } from '@/lib/prisma';
import { ENUNCIADOS, buscarEnunciados } from '@/data/enunciados';
import { enforceRateLimit, getClientIp } from '@/lib/cache/rate-limit-helper';
import { enforceGlobalAiCap } from '@/lib/cache/ai-quota';
import { ValidationError } from '@/lib/errors/api-error';
import { handleApiError } from '@/lib/errors/error-handler';
import { apiLogger } from '@/lib/logger';
import { z } from 'zod';

const AiSearchBodySchema = z.object({
  query: z.string().trim().min(3).max(300),
});

interface SearchResult {
  articleNumber: string;
  title: string;
  ementa: string;
  capitulo: string;
  relevance: string; // Explicacao do porque e relevante
  score: number; // 1-100
}

interface DocumentResult {
  id: string;
  title: string;
  category: string;
  type: string;
  summary: string | null;
  linkedArticles: string[];
  relevance: string;
}

interface EnunciadoResult {
  id: string;
  orgao: string;
  numero: number;
  texto: string;
  tema: string;
  artigosVinculados: string[];
}

interface SearchResponse {
  query: string;
  results: SearchResult[];
  documents: DocumentResult[];
  enunciados: EnunciadoResult[];
  summary: string;
  isAISearch: boolean;
  cached: boolean;
  latency: number;
}

// Lista de artigos principais para contexto compacto
const ARTICLE_SUMMARIES = Object.entries(LEI_14133_ARTIGOS)
  .slice(0, 100) // Primeiros 100 para nao estourar contexto
  .map(([num, art]) => ({
    numero: num,
    titulo: art.titulo || '',
    capitulo: art.capituloCompleto || art.capitulo,
    resumo: art.ementa.substring(0, 200),
  }));

/**
 * POST /api/lei-14133/search
 *
 * Busca semantica com IA na Lei 14.133
 * Recebe uma pergunta em linguagem natural e retorna artigos relevantes
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const ip = getClientIp(request);
    await enforceRateLimit(`lei-search:${ip}`, 5, 60, { failureMode: 'closed' });

    const parsedBody = AiSearchBodySchema.safeParse(await request.json());
    if (!parsedBody.success) {
      throw new ValidationError('Query inválida', parsedBody.error.issues);
    }
    const searchQuery = parsedBody.data.query;

    // Kill-switch global de custo: rota pública (sem usuário/tier). Ao estourar
    // o cap diário, não sintetiza — retorna o mesmo shape do fallback sem-IA.
    const globalCap = await enforceGlobalAiCap();
    if (globalCap.action === 'degrade-search') {
      return NextResponse.json<SearchResponse>({
        query: searchQuery,
        results: [],
        documents: [],
        enunciados: [],
        summary: 'Assistente IA em alta demanda no momento. Tente novamente em alguns minutos — a navegação pela Lei segue disponível.',
        isAISearch: false,
        cached: false,
        latency: Date.now() - startTime,
      });
    }

    // Construir prompt para o Gemini
    const prompt = `Voce e um especialista em Direito Administrativo e Licitacoes, especificamente na Lei 14.133/2021 (Nova Lei de Licitacoes).

O usuario fez a seguinte pergunta/busca:
"${searchQuery}"

Aqui esta um resumo dos artigos da Lei 14.133/2021:
${ARTICLE_SUMMARIES.map(a => `Art. ${a.numero} (${a.capitulo}): ${a.resumo}...`).join('\n')}

Com base na pergunta do usuario, identifique os artigos MAIS RELEVANTES da Lei 14.133/2021.

IMPORTANTE: Responda APENAS no formato JSON abaixo, sem texto adicional:
{
  "summary": "Breve resumo de 1-2 frases sobre o que o usuario esta buscando",
  "articles": [
    {
      "number": "75",
      "relevance": "Explicacao curta de porque este artigo e relevante para a busca",
      "score": 95
    }
  ]
}

Regras:
- Retorne entre 1 e 5 artigos mais relevantes
- Score de 1 a 100 (100 = mais relevante)
- Se nenhum artigo for relevante, retorne articles vazio
- Ordene por relevancia (maior score primeiro)
- Seja preciso - nao inclua artigos que nao sao relevantes`;

    apiLogger.info({ query: searchQuery }, 'Lei 14133 search initiated');

    const geminiResult = await queryGeminiText(prompt, {
      model: PRIMARY_GEMINI_MODEL,
      temperature: 0.3, // Baixa para respostas mais precisas
      maxOutputTokens: 1024,
      thinkingBudget: 0,
      useCache: true,
      cacheTTL: 1800, // 30 minutos
    });

    // Parse da resposta JSON
    let parsedResponse: { summary: string; articles: Array<{ number: string; relevance: string; score: number }> };

    try {
      // Limpar a resposta (remover markdown se houver)
      const cleanResponse = geminiResult.response
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      parsedResponse = JSON.parse(cleanResponse);
    } catch (parseError) {
      apiLogger.error({ err: parseError, rawResponse: geminiResult.response }, 'Erro ao parsear resposta Gemini');

      // Fallback: busca simples por texto
      return NextResponse.json({
        query: searchQuery,
        results: [],
        documents: [],
        enunciados: [],
        summary: 'Nao foi possivel processar a busca com IA. Tente uma busca mais especifica.',
        isAISearch: false,
        cached: false,
        latency: Date.now() - startTime,
      });
    }

    // Montar resultados com dados completos dos artigos
    const results: SearchResult[] = parsedResponse.articles
      .filter(a => LEI_14133_ARTIGOS[a.number])
      .map(a => {
        const artigo = LEI_14133_ARTIGOS[a.number];
        return {
          articleNumber: a.number,
          title: artigo.capituloCompleto || artigo.capitulo,
          ementa: artigo.ementa.substring(0, 300) + (artigo.ementa.length > 300 ? '...' : ''),
          capitulo: artigo.capitulo,
          relevance: a.relevance,
          score: a.score,
        };
      })
      .sort((a, b) => b.score - a.score);

    // Buscar documentos relevantes no banco de dados
    const articleNumbers = results.map(r => r.articleNumber);
    const searchTerms = searchQuery.toLowerCase().split(/\s+/).filter((t: string) => t.length > 2);

    // Buscar documentos vinculados aos artigos OU que contenham os termos de busca
    const documents = await prisma.document.findMany({
      where: {
        OR: [
          // Documentos vinculados aos artigos encontrados
          ...articleNumbers.map(num => ({
            leiArticlesArr: { has: num } // Onda 4.5.5: GIN; antes contains buggy ("75" casava "175")
          })),
          // Documentos que contenham termos de busca no título
          ...searchTerms.map((term: string) => ({
            title: { contains: term, mode: 'insensitive' as const }
          })),
          // Documentos que contenham termos de busca no resumo
          ...searchTerms.map((term: string) => ({
            summary: { contains: term, mode: 'insensitive' as const }
          })),
        ],
        category: { notIn: ['boa_pratica'] },
      },
      select: {
        id: true,
        title: true,
        category: true,
        type: true,
        summary: true,
        leiArticlesArr: true,
      },
      take: 10,
      orderBy: [
        { summary: 'desc' }, // Priorizar documentos com resumo
        { uploadedAt: 'desc' },
      ],
    });

    // Também buscar atos normativos (LegislativeAct)
    const legislativeActs = await prisma.legislativeAct.findMany({
      where: {
        OR: [
          // Atos vinculados aos artigos encontrados
          ...articleNumbers.map(num => ({
            leiArticlesArr: { has: num } // Onda 4.5.5: GIN; antes contains buggy
          })),
          // Atos que contenham termos de busca no título
          ...searchTerms.map((term: string) => ({
            title: { contains: term, mode: 'insensitive' as const }
          })),
          // Atos que contenham termos de busca na ementa
          ...searchTerms.map((term: string) => ({
            summary: { contains: term, mode: 'insensitive' as const }
          })),
        ],
      },
      select: {
        id: true,
        title: true,
        type: true,
        fullNumber: true,
        summary: true,
        leiArticlesArr: true,
      },
      take: 5,
    });

    // Formatar documentos para resposta
    const documentResults: DocumentResult[] = [
      ...documents.map(doc => {
        // Determinar relevância baseada na correspondência
        let relevance = '';
        const leiArticles = doc.leiArticlesArr ?? [];
        const matchedArticles = leiArticles.filter(a => articleNumbers.includes(a));

        if (matchedArticles.length > 0) {
          relevance = `Vinculado ao(s) Art. ${matchedArticles.join(', ')}`;
        } else {
          relevance = 'Contém termos da busca';
        }

        return {
          id: doc.id,
          title: doc.title,
          category: doc.category || 'Documento',
          type: doc.type || 'pdf',
          summary: doc.summary ? doc.summary.substring(0, 200) + (doc.summary.length > 200 ? '...' : '') : null,
          linkedArticles: leiArticles,
          relevance,
        };
      }),
      ...legislativeActs.map(act => {
        const linkedArticles = act.leiArticlesArr ?? [];
        const matchedArticles = linkedArticles.filter((a: string) => articleNumbers.includes(a));

        let relevance = '';
        if (matchedArticles.length > 0) {
          relevance = `Vinculado ao(s) Art. ${matchedArticles.join(', ')}`;
        } else {
          relevance = 'Contém termos da busca';
        }

        return {
          id: act.id,
          title: `${act.fullNumber} - ${act.title}`,
          category: act.type || 'Ato Normativo',
          type: 'legislativeAct',
          summary: act.summary ? act.summary.substring(0, 200) + (act.summary.length > 200 ? '...' : '') : null,
          linkedArticles,
          relevance,
        };
      }),
    ];

    // Remover duplicatas por ID (O(n) com Set)
    const seenDocIds = new Set<string>();
    const uniqueDocuments = documentResults.filter(doc => {
      if (seenDocIds.has(doc.id)) return false;
      seenDocIds.add(doc.id);
      return true;
    });

    // Buscar enunciados relacionados
    // 1. Buscar enunciados vinculados aos artigos encontrados
    const enunciadosPorArtigo = ENUNCIADOS.filter(e =>
      e.artigosVinculados.some(art => articleNumbers.includes(art))
    );

    // 2. Buscar enunciados por texto
    const enunciadosPorTexto = buscarEnunciados(searchQuery);

    // Combinar e remover duplicatas (O(n) com Set)
    const todosEnunciados = [...enunciadosPorArtigo, ...enunciadosPorTexto];
    const seenEnunciadoIds = new Set<string>();
    const uniqueEnunciados = todosEnunciados
      .filter(e => {
        if (seenEnunciadoIds.has(e.id)) return false;
        seenEnunciadoIds.add(e.id);
        return true;
      })
      .slice(0, 5) // Limitar a 5 enunciados
      .map(e => ({
        id: e.id,
        orgao: e.orgao,
        numero: e.numero,
        texto: e.texto.substring(0, 300) + (e.texto.length > 300 ? '...' : ''),
        tema: e.tema,
        artigosVinculados: e.artigosVinculados,
      }));

    const latency = Date.now() - startTime;
    apiLogger.info({ resultsCount: results.length, docsCount: uniqueDocuments.length, enunciadosCount: uniqueEnunciados.length, latency, cached: geminiResult.cached }, 'Lei 14133 search completed');

    const response: SearchResponse = {
      query: searchQuery,
      results,
      documents: uniqueDocuments,
      enunciados: uniqueEnunciados,
      summary: parsedResponse.summary,
      isAISearch: true,
      cached: geminiResult.cached,
      latency,
    };

    return NextResponse.json(response);

  } catch (error) {
    return handleApiError(error);
  }
}
