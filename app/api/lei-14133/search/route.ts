import { NextRequest, NextResponse } from 'next/server';
import { LEI_14133_ARTIGOS } from '@/data/lei-14133-artigos';
import { queryGeminiText } from '@/lib/gemini/cached-client';

interface SearchResult {
  articleNumber: string;
  title: string;
  ementa: string;
  capitulo: string;
  relevance: string; // Explicacao do porque e relevante
  score: number; // 1-100
}

interface SearchResponse {
  query: string;
  results: SearchResult[];
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

    const latency = Date.now() - startTime;
    console.log(`[Search API] Encontrados ${results.length} artigos em ${latency}ms (cached: ${geminiResult.cached})`);

    const response: SearchResponse = {
      query: searchQuery,
      results,
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
