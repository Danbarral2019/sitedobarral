import { NextRequest, NextResponse } from 'next/server';
import { LEI_14133_ARTIGOS } from '@/data/lei-14133-artigos';
import { queryGeminiText } from '@/lib/gemini/cached-client';
import { prisma } from '@/lib/prisma';
import { ENUNCIADOS, buscarEnunciados } from '@/data/enunciados';

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
    const body = await request.json();
    const { query } = body;

    if (!query || query.trim().length < 3) {
      return NextResponse.json(
        { error: 'Query deve ter pelo menos 3 caracteres' },
        { status: 400 }
      );
    }

    const searchQuery = query.trim();

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

    console.log(`[Search API] Buscando: "${searchQuery}"`);

    const geminiResult = await queryGeminiText(prompt, {
      model: 'gemini-2.0-flash-exp',
      temperature: 0.3, // Baixa para respostas mais precisas
      maxOutputTokens: 1024,
      useCache: true,
      cacheTTL: 1800, // 30 minutos
    });

    // Parse da resposta JSON
    let parsedResponse: { summary: string; articles: Array<{ number: string; relevance: string; score: number }> };

    try {
      // Limpar a resposta (remover markdown se houver)
      let cleanResponse = geminiResult.response
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      parsedResponse = JSON.parse(cleanResponse);
    } catch (parseError) {
      console.error('[Search API] Erro ao parsear resposta:', parseError);
      console.log('[Search API] Resposta bruta:', geminiResult.response);

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
    const searchTerms = searchQuery.toLowerCase().split(/\s+/).filter(t => t.length > 2);

    // Buscar documentos vinculados aos artigos OU que contenham os termos de busca
    const documents = await prisma.document.findMany({
      where: {
        OR: [
          // Documentos vinculados aos artigos encontrados
          ...articleNumbers.map(num => ({
            leiArticles: { contains: num }
          })),
          // Documentos que contenham termos de busca no título
          ...searchTerms.map(term => ({
            title: { contains: term, mode: 'insensitive' as const }
          })),
          // Documentos que contenham termos de busca no resumo
          ...searchTerms.map(term => ({
            summary: { contains: term, mode: 'insensitive' as const }
          })),
        ],
      },
      select: {
        id: true,
        title: true,
        category: true,
        type: true,
        summary: true,
        leiArticles: true,
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
            linkedArticles: { contains: num }
          })),
          // Atos que contenham termos de busca no título
          ...searchTerms.map(term => ({
            title: { contains: term, mode: 'insensitive' as const }
          })),
          // Atos que contenham termos de busca na ementa
          ...searchTerms.map(term => ({
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
        linkedArticles: true,
      },
      take: 5,
    });

    // Formatar documentos para resposta
    const documentResults: DocumentResult[] = [
      ...documents.map(doc => {
        // Determinar relevância baseada na correspondência
        let relevance = '';
        const leiArticles = doc.leiArticles ? doc.leiArticles.split(',').map(a => a.trim()) : [];
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
        const linkedArticles = act.linkedArticles ? act.linkedArticles.split(',').map(a => a.trim()) : [];
        const matchedArticles = linkedArticles.filter(a => articleNumbers.includes(a));

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

    // Remover duplicatas por ID
    const uniqueDocuments = documentResults.filter((doc, index, self) =>
      index === self.findIndex(d => d.id === doc.id)
    );

    // Buscar enunciados relacionados
    const enunciadoResults: EnunciadoResult[] = [];

    // 1. Buscar enunciados vinculados aos artigos encontrados
    const enunciadosPorArtigo = ENUNCIADOS.filter(e =>
      e.artigosVinculados.some(art => articleNumbers.includes(art))
    );

    // 2. Buscar enunciados por texto
    const enunciadosPorTexto = buscarEnunciados(searchQuery);

    // Combinar e remover duplicatas
    const todosEnunciados = [...enunciadosPorArtigo, ...enunciadosPorTexto];
    const uniqueEnunciados = todosEnunciados
      .filter((e, index, self) => index === self.findIndex(en => en.id === e.id))
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
    console.log(`[Search API] Encontrados ${results.length} artigos, ${uniqueDocuments.length} documentos e ${uniqueEnunciados.length} enunciados em ${latency}ms (cached: ${geminiResult.cached})`);

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
    console.error('[Search API] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao processar busca' },
      { status: 500 }
    );
  }
}
