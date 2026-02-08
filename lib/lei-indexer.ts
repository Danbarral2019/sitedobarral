/**
 * Sistema de Indexação Automática - Lei 14.133
 *
 * Usa Gemini AI para analisar documentos e identificar artigos
 * da Lei 14.133/2021 (Nova Lei de Licitações) relacionados.
 *
 * FLUXO:
 * 1. Analisa título, conteúdo e tags do documento
 * 2. Identifica artigos da lei mencionados ou relacionados
 * 3. Retorna array de artigos com score de confiança (0-100)
 * 4. Salva no campo `leiArticles` do documento
 *
 * CARACTERÍSTICAS:
 * - Indexação massiva: processa todos documentos sem leiArticles
 * - Score de confiança: 0-100 (quanto maior, mais relevante)
 * - Flag autoIndexed: diferencia indexação manual vs automática
 * - Rate limiting: respeita limites da API Gemini
 * - Batch processing: processa em lotes de 20 documentos
 */

import { Document } from '@prisma/client';

/**
 * Resultado da análise de um documento
 */
export interface ArticleAnalysisResult {
  documentId: string;
  articles: ArticleMatch[];
  autoIndexed: boolean;
  analyzedAt: Date;
  confidence: number; // Confiança geral da indexação (0-100)
  reasoning: string; // Explicação da análise
}

/**
 * Match de artigo identificado
 */
export interface ArticleMatch {
  articleNumber: string; // "1", "2", "184-A", "194", etc.
  confidence: number; // 0-100
  reasoning: string; // Por que este artigo foi identificado
  mentions: number; // Quantidade de menções no documento
}

/**
 * Opções para análise
 */
export interface AnalysisOptions {
  minConfidence?: number; // Confiança mínima para incluir artigo (padrão: 30)
  maxArticles?: number; // Máximo de artigos a retornar (padrão: 10)
  includeReasoning?: boolean; // Incluir explicação detalhada (padrão: true)
  geminiModel?: 'gemini-2.0-flash' | 'gemini-2.5-flash' | 'gemini-2.5-pro'; // Modelo Gemini (padrão: gemini-2.0-flash)
}

/**
 * Prompt base para análise
 */
const ANALYSIS_PROMPT_TEMPLATE = `Você é um especialista em Direito Administrativo, Licitações e Contratos especializado na Lei 14.133/2021 (Nova Lei de Licitações).

TAREFA: Analisar o documento abaixo e identificar TODOS os artigos da Lei 14.133/2021 que são relevantes ou mencionados.

DOCUMENTO:
---
Título: {{TITLE}}
Categoria: {{CATEGORY}}
Tags: {{TAGS}}
Conteúdo: {{CONTENT}}
---

INSTRUÇÕES:
1. Identifique artigos da Lei 14.133 mencionados EXPLICITAMENTE (ex: "art. 75", "artigo 28", "Lei 14.133, art. 191")
2. Identifique artigos RELACIONADOS ao tema do documento (mesmo que não mencionados explicitamente)
3. Para cada artigo identificado, forneça:
   - Número do artigo (ex: "1", "28", "75", "184-A", "194")
   - Score de confiança (0-100):
     * 90-100: Menção explícita múltipla
     * 70-89: Menção explícita única
     * 50-69: Tema claramente relacionado
     * 30-49: Tema possivelmente relacionado
     * 0-29: Relação fraca/tangencial
   - Justificativa breve (1 frase)
   - Número de menções explícitas (0 se apenas relacionado)

4. IMPORTANTE:
   - NÃO confunda artigos de outras leis (Lei 8.666, Decreto, etc.)
   - Se o documento mencionar "Lei 14.133" genérica sem artigo específico, identifique os temas e artigos relacionados
   - Artigos "184-A" e outros com letras devem ser retornados como "184-A" (com hífen)
   - Máximo de {{MAX_ARTICLES}} artigos

FORMATO DE RESPOSTA (JSON):
{
  "articles": [
    {
      "articleNumber": "75",
      "confidence": 85,
      "reasoning": "Documento trata de garantias em contratos, tema central do art. 75",
      "mentions": 2
    },
    {
      "articleNumber": "28",
      "confidence": 60,
      "reasoning": "Relacionado ao tema de dispensa de licitação discutido no documento",
      "mentions": 0
    }
  ],
  "overallConfidence": 75,
  "summary": "Documento relacionado a garantias contratuais e dispensas de licitação"
}

Responda APENAS com JSON válido, sem texto adicional.`;

/**
 * Classe principal do indexador
 */
export class LeiIndexer {
  private static readonly DEFAULT_OPTIONS: Required<AnalysisOptions> = {
    minConfidence: 30,
    maxArticles: 10,
    includeReasoning: true,
    geminiModel: 'gemini-2.0-flash',
  };

  /**
   * Analisa um documento e identifica artigos relacionados
   */
  static async analyzeDocument(
    document: Pick<Document, 'id' | 'title' | 'category' | 'tags' | 'content' | 'description'>,
    options: AnalysisOptions = {}
  ): Promise<ArticleAnalysisResult> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };

    try {
      // Preparar conteúdo para análise
      const content = this.prepareContent(document);

      // Montar prompt
      const prompt = ANALYSIS_PROMPT_TEMPLATE
        .replace('{{TITLE}}', document.title)
        .replace('{{CATEGORY}}', document.category || 'N/A')
        .replace('{{TAGS}}', this.formatTags(document.tags))
        .replace('{{CONTENT}}', content)
        .replace('{{MAX_ARTICLES}}', opts.maxArticles.toString());

      // Chamar Gemini via MCP (simulação - será implementado depois)
      const geminiResponse = await this.callGeminiMCP(prompt, opts.geminiModel);

      // Parse resposta
      const parsedResponse = JSON.parse(geminiResponse);

      // Filtrar por confiança mínima
      const filteredArticles = parsedResponse.articles
        .filter((a: { confidence: number }) => a.confidence >= opts.minConfidence)
        .slice(0, opts.maxArticles);

      return {
        documentId: document.id,
        articles: filteredArticles,
        autoIndexed: true,
        analyzedAt: new Date(),
        confidence: parsedResponse.overallConfidence || 50,
        reasoning: parsedResponse.summary || 'Análise automática via Gemini',
      };
    } catch (error) {
      console.error(`[LeiIndexer] Erro ao analisar documento ${document.id}:`, error);

      // Retornar resultado vazio em caso de erro
      return {
        documentId: document.id,
        articles: [],
        autoIndexed: true,
        analyzedAt: new Date(),
        confidence: 0,
        reasoning: `Erro na análise: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      };
    }
  }

  /**
   * Prepara conteúdo do documento para análise
   */
  private static prepareContent(
    document: Pick<Document, 'content' | 'description'>
  ): string {
    // Combinar conteúdo disponível
    const parts: string[] = [];

    if (document.description) {
      parts.push(document.description);
    }

    if (document.content) {
      // Limitar tamanho do conteúdo (Gemini tem limites)
      const maxLength = 4000; // ~1000 tokens
      const content = document.content.substring(0, maxLength);
      parts.push(content);

      if (document.content.length > maxLength) {
        parts.push('[... conteúdo truncado]');
      }
    }

    return parts.join('\n\n') || 'Sem conteúdo disponível';
  }

  /**
   * Formata tags para o prompt
   */
  private static formatTags(tags: string | string[] | null): string {
    if (!tags) return 'Sem tags';

    try {
      const tagArray = typeof tags === 'string' ? JSON.parse(tags) : tags;
      return Array.isArray(tagArray) ? tagArray.join(', ') : 'Sem tags';
    } catch {
      return String(tags);
    }
  }

  /**
   * Chama Gemini API REST e retorna a resposta como string JSON
   */
  private static async callGeminiMCP(prompt: string, model: string): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY não configurada no ambiente');
    }

    const apiModel = model || 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      let text = data.candidates[0].content.parts[0].text.trim();

      // Remover markdown code blocks se presentes
      if (text.includes('```json')) {
        text = text.split('```json')[1].split('```')[0].trim();
      } else if (text.includes('```')) {
        text = text.split('```')[1].split('```')[0].trim();
      }

      return text;
    }

    throw new Error('Resposta inválida do Gemini: ' + JSON.stringify(data));
  }

  /**
   * Analisa múltiplos documentos em batch
   */
  static async analyzeBatch(
    documents: Array<Pick<Document, 'id' | 'title' | 'category' | 'tags' | 'content' | 'description'>>,
    options: AnalysisOptions = {},
    onProgress?: (current: number, total: number, documentId: string) => void
  ): Promise<ArticleAnalysisResult[]> {
    const results: ArticleAnalysisResult[] = [];

    for (let i = 0; i < documents.length; i++) {
      const document = documents[i];

      // Callback de progresso
      if (onProgress) {
        onProgress(i + 1, documents.length, document.id);
      }

      // Analisar documento
      const result = await this.analyzeDocument(document, options);
      results.push(result);

      // Rate limiting: aguardar 500ms entre chamadas
      if (i < documents.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return results;
  }

  /**
   * Converte resultado de análise para formato do campo leiArticles
   */
  static resultToLeiArticles(result: ArticleAnalysisResult): string[] {
    return result.articles
      .sort((a, b) => {
        // Ordenar por confiança decrescente
        if (b.confidence !== a.confidence) {
          return b.confidence - a.confidence;
        }
        // Desempate: ordenar numericamente
        const aNum = parseInt(a.articleNumber.replace(/[^0-9]/g, ''));
        const bNum = parseInt(b.articleNumber.replace(/[^0-9]/g, ''));
        return aNum - bNum;
      })
      .map(a => a.articleNumber);
  }

  /**
   * Estatísticas de análise em batch
   */
  static getBatchStats(results: ArticleAnalysisResult[]) {
    const totalDocuments = results.length;
    const successfullyIndexed = results.filter(r => r.articles.length > 0).length;
    const failed = results.filter(r => r.articles.length === 0).length;

    const totalArticlesFound = results.reduce((sum, r) => sum + r.articles.length, 0);
    const avgArticlesPerDoc = totalDocuments > 0 ? (totalArticlesFound / totalDocuments).toFixed(2) : '0';
    const avgConfidence = results.length > 0
      ? (results.reduce((sum, r) => sum + r.confidence, 0) / results.length).toFixed(1)
      : '0';

    // Contagem de artigos mais frequentes
    const articleCounts = new Map<string, number>();
    results.forEach(r => {
      r.articles.forEach(a => {
        articleCounts.set(a.articleNumber, (articleCounts.get(a.articleNumber) || 0) + 1);
      });
    });

    const topArticles = Array.from(articleCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([article, count]) => ({ article, count }));

    return {
      totalDocuments,
      successfullyIndexed,
      failed,
      successRate: ((successfullyIndexed / totalDocuments) * 100).toFixed(1) + '%',
      totalArticlesFound,
      avgArticlesPerDoc,
      avgConfidence: avgConfidence + '%',
      topArticles,
    };
  }
}
