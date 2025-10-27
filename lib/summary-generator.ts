/**
 * Serviço de Geração de Resumos com Claude AI
 * Gera resumos executivos de documentos jurídicos
 */

import Anthropic from '@anthropic-ai/sdk';

// Cliente Claude (lazy initialization)
function getClaudeClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.warn('[Summary Generator] ANTHROPIC_API_KEY não configurada');
    return null;
  }

  return new Anthropic({ apiKey });
}

export interface DocumentSummary {
  summary: string; // Resumo executivo (2-3 parágrafos)
  highlights: string[]; // 3-5 pontos-chave
  tags: string[]; // Tags sugeridas
  leiArticles: number[]; // Artigos da Lei 14.133/2021 citados
  confidence: number; // Confiança na análise (0-100)
  reasoning?: string; // Explicação do resumo gerado
}

/**
 * Gera resumo de um documento usando Claude AI
 */
export async function generateDocumentSummary(
  title: string,
  description?: string,
  fullText?: string,
  category?: string
): Promise<DocumentSummary | null> {
  const anthropic = getClaudeClient();

  if (!anthropic) {
    return null;
  }

  try {
    const prompt = buildSummaryPrompt(title, description, fullText, category);

    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022', // Rápido e econômico
      max_tokens: 2048,
      temperature: 0.3, // Baixa temperatura para consistência
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Extrai resposta
    const responseText = message.content[0].type === 'text'
      ? message.content[0].text
      : '';

    // Parse da resposta JSON
    const result = parseSummaryResponse(responseText);

    console.log('[Summary Generator] Resumo gerado:', {
      title: title.substring(0, 50),
      summaryLength: result.summary.length,
      highlightsCount: result.highlights.length,
      confidence: result.confidence,
    });

    return result;

  } catch (error) {
    console.error('[Summary Generator] Erro ao gerar resumo:', error);
    return null;
  }
}

/**
 * Constrói prompt para geração de resumo
 */
function buildSummaryPrompt(
  title: string,
  description?: string,
  fullText?: string,
  category?: string
): string {
  const categoryContext = category
    ? getCategoryContext(category)
    : 'documento jurídico';

  return `Você é um especialista em Direito Administrativo brasileiro, com foco em licitações e contratos públicos (Lei 14.133/2021).

TAREFA: Analise o ${categoryContext} abaixo e crie um resumo executivo completo e didático.

DOCUMENTO:
Título: ${title}
${description ? `Descrição: ${description}` : ''}
${fullText ? `\n\nConteúdo:\n${fullText.substring(0, 8000)}` : ''}

INSTRUÇÕES:

1. **RESUMO EXECUTIVO** (2-3 parágrafos, ~200-300 palavras):
   - Explique o tema principal do documento
   - Contextualize a relevância prática
   - Use linguagem acessível mas técnica
   - Foque no "para quê" e "como" aplicar

2. **DESTAQUES** (3-5 pontos-chave):
   - Principais conclusões ou determinações
   - Mudanças importantes ou novidades
   - Pontos de atenção para gestores públicos
   - Cada destaque: 1-2 frases curtas

3. **TAGS** (3-8 tags relevantes):
   - Temas principais
   - Leis/normas citadas
   - Conceitos-chave
   - Órgãos envolvidos (TCU, AGU, etc.)

4. **ARTIGOS DA LEI 14.133/2021** (se mencionados):
   - Liste APENAS os artigos EXPLICITAMENTE citados
   - Retorne array vazio se não houver citações
   - Formato: array de números (ex: [75, 76])

5. **CONFIANÇA** (0-100):
   - 80-100: Documento completo, análise precisa
   - 60-79: Informações parciais, análise confiável
   - 40-59: Informações limitadas, análise básica
   - 0-39: Informações insuficientes

IMPORTANTE:
- Seja objetivo e direto
- Evite jargões excessivos
- Foque em aplicação prática
- Contextualize para gestores públicos

RESPONDA NO FORMATO JSON EXATO:
{
  "summary": "Resumo executivo em 2-3 parágrafos...",
  "highlights": [
    "Primeiro destaque importante",
    "Segundo destaque importante",
    "Terceiro destaque importante"
  ],
  "tags": ["tag1", "tag2", "tag3"],
  "leiArticles": [75, 76],
  "confidence": 85,
  "reasoning": "Breve explicação sobre a análise e confiança"
}

RESPONDA APENAS COM O JSON, SEM TEXTO ADICIONAL.`;
}

/**
 * Contexto por tipo de documento
 */
function getCategoryContext(category: string): string {
  const contexts: Record<string, string> = {
    'acordao': 'acórdão do TCU',
    'parecer': 'parecer jurídico',
    'orientacao-normativa': 'Orientação Normativa da AGU',
    'edital': 'edital de licitação',
    'apostila': 'material didático',
    'artigo': 'artigo doutrinário',
  };

  return contexts[category] || 'documento jurídico';
}

/**
 * Parse da resposta do Claude
 */
function parseSummaryResponse(responseText: string): DocumentSummary {
  try {
    // Remove possíveis markdown code blocks
    const cleanedText = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const parsed = JSON.parse(cleanedText);

    // Validação e normalização
    return {
      summary: parsed.summary || 'Resumo não disponível.',
      highlights: Array.isArray(parsed.highlights)
        ? parsed.highlights.slice(0, 5) // Máximo 5 destaques
        : [],
      tags: Array.isArray(parsed.tags)
        ? parsed.tags.slice(0, 10) // Máximo 10 tags
        : [],
      leiArticles: Array.isArray(parsed.leiArticles)
        ? parsed.leiArticles
            .filter((art: unknown) => typeof art === 'number' && art > 0 && art <= 194)
            .slice(0, 10) // Máximo 10 artigos
        : [],
      confidence: Math.min(100, Math.max(0, parsed.confidence || 50)),
      reasoning: parsed.reasoning || undefined,
    };
  } catch (error) {
    console.error('[Summary Generator] Erro ao fazer parse da resposta:', error);
    console.error('Resposta recebida:', responseText);

    // Retorna resultado padrão em caso de erro
    return {
      summary: 'Erro ao gerar resumo. Por favor, tente novamente.',
      highlights: [],
      tags: [],
      leiArticles: [],
      confidence: 0,
      reasoning: 'Erro no processamento da resposta da IA',
    };
  }
}

/**
 * Gera resumo em lote (múltiplos documentos)
 */
export async function generateBatchSummaries(
  documents: Array<{
    id: string;
    title: string;
    description?: string;
    category?: string;
  }>
): Promise<Array<{ id: string; summary: DocumentSummary | null }>> {
  const results = [];

  for (const doc of documents) {
    const summary = await generateDocumentSummary(
      doc.title,
      doc.description || undefined,
      undefined,
      doc.category
    );

    results.push({
      id: doc.id,
      summary,
    });

    // Pequeno delay para evitar rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
}

/**
 * Verifica se serviço está disponível
 */
export function isSummaryServiceAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}
