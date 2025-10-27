/**
 * Analisador de documentos - Orquestrador principal
 * Combina extração de texto, detecção de artigos citados e análise de palavras-chave
 * FASE 4: Integração opcional com Claude API para análise semântica avançada
 */

import { extractText, normalizeText } from './text-extractor';
import { findArticleMatches, detectArticleRanges, type ArticleMatch } from './article-matcher';
import { findKeywordMatches, type KeywordMatch } from './keyword-mapper';
import { getLeiArticle } from '@/data/lei-14133-artigos';
import { analyzeWithClaude, shouldUseClaude } from './claude-analyzer';

export interface ArticleSuggestion {
  articleNumber: string;
  articleTitle: string;
  confidence: 'high' | 'medium' | 'low';
  score: number; // 0-10
  sources: Array<{
    type: 'citation' | 'keyword' | 'range' | 'ai';
    reason: string;
    details?: string;
  }>;
  occurrences?: number;
  contexts?: string[];
}

export interface DocumentAnalysisResult {
  success: boolean;
  suggestions: ArticleSuggestion[];
  stats: {
    textLength: number;
    citationsFound: number;
    keywordsMatched: number;
    totalSuggestions: number;
  };
  error?: string;
}

/**
 * Analisa um documento e sugere artigos da Lei 14.133/2021
 *
 * @param fileBuffer - Buffer do arquivo
 * @param mimeType - Tipo MIME do arquivo (application/pdf, text/plain, etc.)
 * @returns Resultado da análise com sugestões de artigos
 */
export async function analyzeDocument(
  fileBuffer: Buffer,
  mimeType: string
): Promise<DocumentAnalysisResult> {

  try {
    // 1. Extração de texto
    const extractionResult = await extractText(fileBuffer, mimeType);

    if (!extractionResult.success || !extractionResult.text) {
      return {
        success: false,
        suggestions: [],
        stats: {
          textLength: 0,
          citationsFound: 0,
          keywordsMatched: 0,
          totalSuggestions: 0
        },
        error: extractionResult.error || 'Não foi possível extrair texto do documento'
      };
    }

    const text = normalizeText(extractionResult.text);

    // 2. Detecção de artigos citados explicitamente
    const articleMatches = findArticleMatches(text);

    // 3. Detecção de ranges de artigos (ex: "arts. 72 a 80")
    const rangeArticles = detectArticleRanges(text);

    // 4. Análise de palavras-chave
    const keywordMatches = findKeywordMatches(text);

    // 5. Combina todas as fontes em sugestões únicas
    let suggestions = mergeSuggestions(articleMatches, rangeArticles, keywordMatches);

    // 6. FASE 4: Se análise básica tem baixa confiança, usa Claude como fallback
    if (shouldUseClaude(suggestions)) {
      console.log('📊 Análise básica teve baixa confiança. Usando Claude API como fallback...');

      const claudeResult = await analyzeWithClaude(text, 'Documento analisado');

      if (claudeResult.success && claudeResult.suggestions.length > 0) {
        console.log(`✅ Claude encontrou ${claudeResult.suggestions.length} sugestões adicionais`);

        // Combina sugestões de Claude com as básicas
        suggestions = mergeClaudeSuggestions(suggestions, claudeResult.suggestions);
      }
    }

    return {
      success: true,
      suggestions,
      stats: {
        textLength: text.length,
        citationsFound: articleMatches.length,
        keywordsMatched: keywordMatches.length,
        totalSuggestions: suggestions.length
      }
    };

  } catch (error) {
    return {
      success: false,
      suggestions: [],
      stats: {
        textLength: 0,
        citationsFound: 0,
        keywordsMatched: 0,
        totalSuggestions: 0
      },
      error: error instanceof Error ? error.message : 'Erro ao analisar documento'
    };
  }
}

/**
 * Combina sugestões de múltiplas fontes em uma lista única
 */
function mergeSuggestions(
  articleMatches: ArticleMatch[],
  rangeArticles: string[],
  keywordMatches: KeywordMatch[]
): ArticleSuggestion[] {

  const suggestionMap = new Map<string, ArticleSuggestion>();

  // 1. Adiciona artigos citados explicitamente (maior confiança)
  for (const match of articleMatches) {
    const article = getLeiArticle(match.articleNumber);
    if (!article) continue;

    suggestionMap.set(match.articleNumber, {
      articleNumber: match.articleNumber,
      articleTitle: article.ementa,
      confidence: match.confidence,
      score: match.confidence === 'high' ? 10 : match.confidence === 'medium' ? 8 : 6,
      sources: [{
        type: 'citation',
        reason: `Artigo citado ${match.occurrences} vez(es) no documento`,
        details: match.contexts[0] || undefined
      }],
      occurrences: match.occurrences,
      contexts: match.contexts
    });
  }

  // 2. Adiciona artigos de ranges detectados
  for (const articleNumber of rangeArticles) {
    const article = getLeiArticle(articleNumber);
    if (!article) continue;

    const existing = suggestionMap.get(articleNumber);

    if (existing) {
      // Incrementa score se já existe
      existing.score = Math.min(10, existing.score + 2);
      existing.sources.push({
        type: 'range',
        reason: 'Artigo incluído em um range detectado'
      });
    } else {
      suggestionMap.set(articleNumber, {
        articleNumber,
        articleTitle: article.ementa,
        confidence: 'medium',
        score: 7,
        sources: [{
          type: 'range',
          reason: 'Artigo incluído em um range detectado (ex: "arts. X a Y")'
        }]
      });
    }
  }

  // 3. Adiciona artigos sugeridos por palavras-chave
  for (const match of keywordMatches) {
    const article = getLeiArticle(match.articleNumber);
    if (!article) continue;

    const existing = suggestionMap.get(match.articleNumber);

    if (existing) {
      // Incrementa score se já existe
      existing.score = Math.min(10, existing.score + Math.floor(match.score / 2));
      existing.sources.push({
        type: 'keyword',
        reason: match.reason,
        details: `Palavras-chave: ${match.keywords.join(', ')}`
      });
    } else {
      suggestionMap.set(match.articleNumber, {
        articleNumber: match.articleNumber,
        articleTitle: article.ementa,
        confidence: match.score >= 8 ? 'medium' : 'low',
        score: match.score,
        sources: [{
          type: 'keyword',
          reason: match.reason,
          details: `Palavras-chave: ${match.keywords.join(', ')}`
        }]
      });
    }
  }

  // 4. Converte para array e ordena por score
  return Array.from(suggestionMap.values())
    .sort((a, b) => {
      // Primeiro por score
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      // Depois por confiança
      const confidenceOrder = { high: 3, medium: 2, low: 1 };
      return confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
    })
    // Limita a 20 sugestões mais relevantes
    .slice(0, 20);
}

/**
 * Analisa apenas o título/descrição do documento (mais rápido)
 * Útil quando não há arquivo PDF disponível
 */
export async function analyzeMetadata(title: string, description: string = ''): Promise<ArticleSuggestion[]> {
  const text = `${title}\n${description}`;

  // Detecção de artigos citados
  const articleMatches = findArticleMatches(text);

  // Análise de palavras-chave
  const keywordMatches = findKeywordMatches(text);

  // Detecção de ranges
  const rangeArticles = detectArticleRanges(text);

  let suggestions = mergeSuggestions(articleMatches, rangeArticles, keywordMatches);

  // FASE 4: Se análise básica tem baixa confiança, usa Claude
  if (shouldUseClaude(suggestions)) {
    console.log('📊 Análise de metadata teve baixa confiança. Usando Claude API...');

    const claudeResult = await analyzeWithClaude(text, title);

    if (claudeResult.success && claudeResult.suggestions.length > 0) {
      console.log(`✅ Claude encontrou ${claudeResult.suggestions.length} sugestões`);
      suggestions = mergeClaudeSuggestions(suggestions, claudeResult.suggestions);
    }
  }

  return suggestions;
}

/**
 * Combina sugestões de Claude com sugestões básicas
 * Evita duplicatas e prioriza fontes múltiplas
 */
function mergeClaudeSuggestions(
  basicSuggestions: ArticleSuggestion[],
  claudeSuggestions: ArticleSuggestion[]
): ArticleSuggestion[] {

  const suggestionMap = new Map<string, ArticleSuggestion>();

  // Adiciona sugestões básicas primeiro
  for (const suggestion of basicSuggestions) {
    suggestionMap.set(suggestion.articleNumber, suggestion);
  }

  // Adiciona ou enriquece com sugestões de Claude
  for (const claudeSuggestion of claudeSuggestions) {
    const existing = suggestionMap.get(claudeSuggestion.articleNumber);

    if (existing) {
      // Se já existe, adiciona fonte de IA e aumenta score
      existing.sources.push(...claudeSuggestion.sources);
      existing.score = Math.min(10, existing.score + 2);
      // Se Claude deu alta confiança, promove confiança geral
      if (claudeSuggestion.confidence === 'high' && existing.confidence !== 'high') {
        existing.confidence = 'medium';
      }
    } else {
      // Adiciona nova sugestão de Claude
      suggestionMap.set(claudeSuggestion.articleNumber, claudeSuggestion);
    }
  }

  // Retorna ordenado por score
  return Array.from(suggestionMap.values())
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const confidenceOrder = { high: 3, medium: 2, low: 1 };
      return confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
    })
    .slice(0, 20);
}
