/**
 * Tribunal Decision Classifier
 *
 * Classifica decisoes de tribunais por relevancia para licitacoes/contratos.
 * Usa keywords de shared-keywords.ts e opcionalmente Gemini IA para pendentes.
 */

import { KEYWORDS_RELEVANCIA, CURSOS_KEYWORDS, detectTemas } from '@/lib/shared-keywords';
import { queryGeminiText } from '@/lib/gemini/cached-client';

// ===========================
// Types
// ===========================

export interface DecisionInput {
  title: string;
  ementa: string;
  fullText?: string | null;
  decisionType?: string;
  tribunalCode?: string;
}

export interface ClassificationResult {
  relevanceScore: number;
  approvalStatus: 'auto_approved' | 'pending' | 'auto_rejected';
  themes: string[];
  leiArticles: string[];
  reasoning: string;
  suggestedCourses: string;
  confidence: number;
}

// ===========================
// Lei article detection
// ===========================

export function detectLeiArticles(text: string): string[] {
  const articles = new Set<string>();

  // Match: Art. 1, art. 12, artigo 130, Art. 1o, Art. 1., Arts. 1 e 2
  const patterns = [
    /\bart(?:igo|\.)\s*(\d{1,3}(?:-[A-Z])?)/gi,
    /\barts?\.\s*(\d{1,3}(?:-[A-Z])?)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const num = match[1].replace(/^0+/, '');
      if (num) {
        articles.add(`Art. ${num}`);
      }
    }
  }

  return Array.from(articles).sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, ''));
    const numB = parseInt(b.replace(/\D/g, ''));
    return numA - numB;
  });
}

// ===========================
// Keyword-based scoring
// ===========================

// Paradigmatic keywords (consultas em tese, teses fixadas)
const PARADIGMATIC_KEYWORDS = {
  strong: ['consulta', 'fixar tese', 'tese fixada', 'entendimento', 'uniformização', 'súmula', 'enunciado', 'interpretação', 'precedente', 'consulta em tese'],
  moderate: ['divergência', 'revisão de entendimento', 'paradigma', 'recurso de revisão', 'prejudicial de mérito'],
  indicators: ['é lícito', 'é ilícito', 'não se admite', 'deve ser observado', 'é obrigatório', 'é vedado', 'firmou entendimento', 'pacificou'],
};

function calculateKeywordScore(text: string): { score: number; reasoning: string[] } {
  const textLower = text.toLowerCase();
  let score = 0;
  const reasoning: string[] = [];

  // Paradigmatic keywords - strong (+15 each)
  for (const keyword of PARADIGMATIC_KEYWORDS.strong) {
    if (textLower.includes(keyword)) {
      score += 15;
      reasoning.push(`+15: "${keyword}" (paradigmatico forte)`);
    }
  }

  // Paradigmatic keywords - moderate (+8 each)
  for (const keyword of PARADIGMATIC_KEYWORDS.moderate) {
    if (textLower.includes(keyword)) {
      score += 8;
      reasoning.push(`+8: "${keyword}" (paradigmatico moderado)`);
    }
  }

  // Paradigmatic keywords - indicators (+5 each)
  for (const keyword of PARADIGMATIC_KEYWORDS.indicators) {
    if (textLower.includes(keyword)) {
      score += 5;
      reasoning.push(`+5: "${keyword}" (indicador paradigmatico)`);
    }
  }

  // High relevance keywords (+10 each)
  for (const keyword of KEYWORDS_RELEVANCIA.high) {
    if (textLower.includes(keyword)) {
      score += 10;
      reasoning.push(`+10: "${keyword}" (alta relevancia)`);
    }
  }

  // Medium relevance keywords (+5 each)
  for (const keyword of KEYWORDS_RELEVANCIA.medium) {
    if (textLower.includes(keyword)) {
      score += 5;
      reasoning.push(`+5: "${keyword}" (media relevancia)`);
    }
  }

  // Low relevance keywords (+2 each)
  for (const keyword of KEYWORDS_RELEVANCIA.low) {
    if (textLower.includes(keyword)) {
      score += 2;
      reasoning.push(`+2: "${keyword}" (baixa relevancia)`);
    }
  }

  // Exclude keywords (-15 each)
  for (const keyword of KEYWORDS_RELEVANCIA.exclude) {
    if (textLower.includes(keyword)) {
      score -= 15;
      reasoning.push(`-15: "${keyword}" (exclusao)`);
    }
  }

  return { score, reasoning };
}

// ===========================
// Suggested courses detection
// ===========================

function detectSuggestedCourses(text: string): string[] {
  const textLower = text.toLowerCase();
  const courses: string[] = [];

  for (const [courseId, keywords] of Object.entries(CURSOS_KEYWORDS) as [string, string[]][]) {
    for (const keyword of keywords) {
      if (textLower.includes(keyword)) {
        courses.push(courseId);
        break;
      }
    }
  }

  return courses;
}

// ===========================
// Main classifier
// ===========================

export async function classifyDecision(
  decision: DecisionInput,
  useAI = false
): Promise<ClassificationResult> {
  // Combine available text
  const combinedText = [decision.title, decision.ementa, decision.fullText || '']
    .filter(Boolean)
    .join(' ');

  // Keyword scoring
  const { score, reasoning } = calculateKeywordScore(combinedText);

  // Detect themes
  const themes = detectTemas(combinedText);

  // Detect Lei 14.133 articles
  const leiArticles = detectLeiArticles(combinedText);

  // Bonus for Lei 14.133 articles mentioned
  let finalScore = score;
  if (leiArticles.length > 0) {
    finalScore += leiArticles.length * 3;
    reasoning.push(`+${leiArticles.length * 3}: ${leiArticles.length} artigos da Lei 14.133 mencionados`);
  }

  // Detect suggested courses
  const suggestedCourses = detectSuggestedCourses(combinedText);

  // Determine approval status based on score thresholds
  let approvalStatus: ClassificationResult['approvalStatus'];
  let confidence = 0;

  // Bonus for Consulta-type decisions
  if (decision.decisionType && /consulta|prejulgado|enunciado/i.test(decision.decisionType)) {
    finalScore += 20;
    reasoning.push('+20: tipo de processo paradigmatico');
  }

  if (finalScore >= 55) {
    approvalStatus = 'auto_approved';
    confidence = Math.min(95, 60 + finalScore);
  } else if (finalScore >= 20) {
    approvalStatus = 'pending';
    confidence = Math.min(60, 30 + finalScore);
  } else {
    approvalStatus = 'auto_rejected';
    confidence = Math.min(90, 70 - finalScore);
  }

  // For pending decisions, optionally use Gemini IA for better classification
  if (approvalStatus === 'pending' && useAI) {
    try {
      const aiResult = await classifyWithAI(decision, finalScore, themes);
      if (aiResult) {
        return {
          ...aiResult,
          themes: themes.length > 0 ? themes : aiResult.themes,
          leiArticles,
          suggestedCourses: suggestedCourses.join(','),
        };
      }
    } catch {
      reasoning.push('IA classification failed, using keyword-only score');
    }
  }

  return {
    relevanceScore: Math.max(0, Math.min(100, finalScore)),
    approvalStatus,
    themes,
    leiArticles,
    reasoning: reasoning.join('; '),
    suggestedCourses: suggestedCourses.join(','),
    confidence,
  };
}

// ===========================
// AI summary generation
// ===========================

/**
 * Gera um resumo didático de uma decisão de tribunal usando Gemini.
 * Retorna 2-4 frases focando em: contexto, decisão, importância para licitações.
 */
export async function generateDecisionSummary(
  decision: DecisionInput
): Promise<string | null> {
  const textForSummary = (decision.fullText || decision.ementa || '').slice(0, 6000);

  if (textForSummary.length < 100) return null;

  const prompt = `Resuma a seguinte decisão de tribunal em 2-4 frases claras e objetivas em português.
Foque em: (1) do que trata o processo, (2) qual foi a decisão/conclusão, (3) relevância para licitações e contratos (Lei 14.133/2021) se aplicável.
Use linguagem acessível para estudantes de Direito Administrativo. Não repita o número do processo nem dados já visíveis no cabeçalho.

Tipo: ${decision.decisionType || 'N/A'}
Título: ${decision.title}
Texto:
${textForSummary}

Responda APENAS com o resumo, sem prefixos como "Resumo:" ou marcação.`;

  try {
    const result = await queryGeminiText(prompt, {
      temperature: 0.3,
      maxOutputTokens: 300,
      useCache: false,
    });

    const summary = result.response.trim();
    // Sanity check: reject if too short or looks like an error
    if (summary.length < 30 || summary.startsWith('{')) return null;
    return summary;
  } catch (error) {
    console.error('[classifier] Summary generation failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

// ===========================
// AI classification (for pending decisions)
// ===========================

async function classifyWithAI(
  decision: DecisionInput,
  keywordScore: number,
  detectedThemes: string[]
): Promise<ClassificationResult | null> {
  const prompt = `Analise a seguinte decisao de tribunal e classifique sua relevancia para licitacoes e contratos administrativos (Lei 14.133/2021).

Tribunal: ${decision.tribunalCode || 'N/A'}
Tipo: ${decision.decisionType || 'N/A'}
Titulo: ${decision.title}
Ementa: ${decision.ementa.slice(0, 2000)}

Score keyword: ${keywordScore}
Temas detectados: ${detectedThemes.join(', ') || 'nenhum'}

Avalie especialmente:
- Esta decisao fixa uma tese juridica sobre a Lei 14.133? E uma consulta em tese?
- Traz interpretacao nova ou consolidada sobre licitacoes?
- Tem carater paradigmatico (uniformizacao, sumula, enunciado, precedente)?

Responda APENAS com JSON (sem markdown):
{
  "relevanceScore": <0-100>,
  "approvalStatus": "<auto_approved|pending|auto_rejected>",
  "themes": ["tema1", "tema2"],
  "reasoning": "<explicacao curta>",
  "confidence": <0-100>
}`;

  const result = await queryGeminiText(prompt, {
    temperature: 0.2,
    maxOutputTokens: 512,
    useCache: false,
  });

  try {
    const parsed = JSON.parse(result.response);
    return {
      relevanceScore: parsed.relevanceScore ?? keywordScore,
      approvalStatus: parsed.approvalStatus ?? 'pending',
      themes: parsed.themes ?? detectedThemes,
      leiArticles: [],
      reasoning: parsed.reasoning ?? '',
      suggestedCourses: '',
      confidence: parsed.confidence ?? 50,
    };
  } catch {
    return null;
  }
}
