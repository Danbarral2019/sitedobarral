/**
 * Análise semântica avançada usando Claude API (Anthropic)
 *
 * FASE 4 - Sistema opcional de IA para melhorar precisão das sugestões
 * Usa Claude como fallback quando análise básica tem baixa confiança
 */

import type { ArticleSuggestion } from './document-analyzer';
import { LEI_14133_ARTIGOS } from '@/data/lei-14133-artigos';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

interface ClaudeResponse {
  success: boolean;
  suggestions: ArticleSuggestion[];
  error?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Verifica se a API Claude está configurada
 */
export function isClaudeAvailable(): boolean {
  return !!ANTHROPIC_API_KEY && ANTHROPIC_API_KEY.length > 0;
}

/**
 * Gera prompt para Claude analisar documento e sugerir artigos
 */
function generateAnalysisPrompt(text: string, title: string): string {
  // Limita texto para não exceder limites da API
  const maxChars = 50000; // ~12k tokens
  const truncatedText = text.length > maxChars
    ? text.substring(0, maxChars) + '...'
    : text;

  return `Você é um especialista em Direito Administrativo, especificamente em licitações e contratos públicos regidos pela Lei 14.133/2021 (Nova Lei de Licitações).

Sua tarefa é analisar o documento abaixo e sugerir artigos RELEVANTES da Lei 14.133/2021 que se relacionam com o conteúdo.

**TÍTULO DO DOCUMENTO:**
${title}

**CONTEÚDO DO DOCUMENTO:**
${truncatedText}

**INSTRUÇÕES:**
1. Analise o conteúdo e identifique os temas principais
2. Sugira até 10 artigos da Lei 14.133/2021 que sejam RELEVANTES para este documento
3. Para cada artigo, forneça:
   - Número do artigo (apenas o número, ex: "5")
   - Score de relevância (1-10, sendo 10 = extremamente relevante)
   - Justificativa breve (máximo 100 caracteres)

**FORMATO DE RESPOSTA (JSON):**
Responda APENAS com um array JSON, sem explicações adicionais:

[
  {
    "articleNumber": "5",
    "score": 9,
    "reason": "Documento trata de princípios da licitação"
  },
  {
    "articleNumber": "72",
    "score": 8,
    "reason": "Menciona critérios de julgamento"
  }
]

**IMPORTANTE:**
- Use apenas números de artigos válidos (1 a 193)
- Seja seletivo - apenas sugira artigos realmente relevantes
- Score mínimo de 6 para incluir uma sugestão
- Retorne APENAS o array JSON, nada mais`;
}

/**
 * Analisa documento usando Claude API
 */
export async function analyzeWithClaude(
  text: string,
  title: string
): Promise<ClaudeResponse> {

  // Verifica se API está disponível
  if (!isClaudeAvailable()) {
    return {
      success: false,
      suggestions: [],
      error: 'Claude API não configurada (ANTHROPIC_API_KEY não encontrada)'
    };
  }

  try {
    const prompt = generateAnalysisPrompt(text, title);

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307', // Modelo mais barato e rápido
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Erro na API Claude:', error);
      return {
        success: false,
        suggestions: [],
        error: `Erro na API Claude: ${response.status}`
      };
    }

    const data = await response.json();

    // Extrai texto da resposta
    const contentText = data.content?.[0]?.text || '';

    // Parse do JSON retornado por Claude
    let claudeSuggestions: Array<{ articleNumber: string; score: number; reason: string }> = [];

    try {
      // Tenta encontrar array JSON na resposta
      const jsonMatch = contentText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        claudeSuggestions = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Resposta não contém JSON válido');
      }
    } catch (parseError) {
      console.error('Erro ao fazer parse da resposta de Claude:', parseError);
      return {
        success: false,
        suggestions: [],
        error: 'Erro ao processar resposta da IA'
      };
    }

    // Converte para formato ArticleSuggestion
    const suggestions: ArticleSuggestion[] = claudeSuggestions
      .filter(s => {
        const num = parseInt(s.articleNumber);
        return num >= 1 && num <= 193 && s.score >= 6;
      })
      .map(s => {
        const articleNumber = s.articleNumber;
        const articleData = LEI_14133_ARTIGOS[articleNumber as keyof typeof LEI_14133_ARTIGOS];

        return {
          articleNumber,
          articleTitle: articleData?.ementa || `Artigo ${articleNumber}`,
          score: s.score,
          confidence: s.score >= 8 ? 'high' as const : s.score >= 7 ? 'medium' as const : 'low' as const,
          sources: [
            {
              type: 'ai' as const,
              reason: s.reason,
              details: s.reason
            }
          ]
        };
      });

    return {
      success: true,
      suggestions,
      usage: {
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0
      }
    };

  } catch (error) {
    console.error('Erro ao chamar Claude API:', error);
    return {
      success: false,
      suggestions: [],
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

/**
 * Decide se deve usar Claude como fallback
 * Critérios:
 * - Análise básica encontrou poucas sugestões (< 3)
 * - Análise básica tem baixa confiança média
 */
export function shouldUseClaude(
  basicSuggestions: ArticleSuggestion[]
): boolean {
  // Não usa se Claude não está disponível
  if (!isClaudeAvailable()) {
    return false;
  }

  // Usa se encontrou poucas sugestões
  if (basicSuggestions.length < 3) {
    return true;
  }

  // Usa se a confiança média é baixa
  const highConfidenceCount = basicSuggestions.filter(s => s.confidence === 'high').length;
  const confidenceRatio = highConfidenceCount / basicSuggestions.length;

  if (confidenceRatio < 0.3) { // Menos de 30% com alta confiança
    return true;
  }

  return false;
}
