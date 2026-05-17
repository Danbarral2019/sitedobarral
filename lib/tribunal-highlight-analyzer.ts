/**
 * Tribunal Highlight Analyzer
 *
 * Identifica decisões de TCEs estaduais com potencial editorial.
 * Adaptação do tcu-highlight-analyzer.ts para TribunalDecision.
 *
 * Fluxo:
 * 1. Pré-filtro: keyword score >= 20
 * 2. Análise IA (máx 15 candidatos)
 * 3. Filtro IA: articleWorthiness >= 60
 * 4. Limite: máx 5 destaques
 * 5. Persistir TribunalHighlight
 * 6. Email ao admin
 */

import { prisma } from '@/lib/prisma';
import { sendTribunalHighlightAlert } from '@/lib/email';
import { PRIMARY_GEMINI_MODEL } from '@/lib/gemini/config';
import { parseLeiArticles } from '@/lib/lei-articles';
import { apiLogger } from "@/lib/logger";

const GEMINI_MODEL = PRIMARY_GEMINI_MODEL;
const ANALYSIS_DELAY_MS = 800;
const MAX_CANDIDATES = 15;
const MAX_HIGHLIGHTS = 5;
const MIN_KEYWORD_SCORE = 20;
const MIN_AI_SCORE = 60;

interface HighlightAnalysis {
  noveltyScore: number;
  practicalImpactScore: number;
  juridicalSignificanceScore: number;
  editorialPotentialScore: number;
  articleWorthiness: number;
  thesisSummary: string;
  whyImportant: string;
  articleAngle: string;
  leiConnections: Array<{ article: string; connection: string }>;
}

// Keywords de alta relevância para scoring rápido
const HIGH_KEYWORDS = [
  'lei 14.133', 'nllc', 'nova lei de licitações', 'pregão eletrônico',
  'dispensa de licitação', 'inexigibilidade', 'sobrepreço', 'superfaturamento',
  'contrato administrativo', 'ata de registro de preços', 'termo de referência',
  'edital de licitação', 'habilitação', 'planejamento da contratação',
];

const MEDIUM_KEYWORDS = [
  'licitação', 'contrato público', 'fiscal de contrato', 'gestor de contrato',
  'contratação direta', 'pregão', 'concorrência', 'tomada de preços',
  'convite', 'credenciamento', 'registro de preços', 'reequilíbrio',
  'aditivo contratual', 'sanção administrativa', 'penalidade',
];

const LOW_KEYWORDS = [
  'administração pública', 'lei de responsabilidade', 'tribunal de contas',
  'improbidade', 'convênio', 'patrimônio público', 'despesa pública',
];

function calculateKeywordScore(text: string): { score: number; reasoning: string[] } {
  const textLower = text.toLowerCase();
  let score = 0;
  const reasoning: string[] = [];

  for (const keyword of HIGH_KEYWORDS) {
    if (textLower.includes(keyword)) {
      score += 10;
      reasoning.push(`+10: "${keyword}"`);
    }
  }

  for (const keyword of MEDIUM_KEYWORDS) {
    if (textLower.includes(keyword)) {
      score += 5;
      reasoning.push(`+5: "${keyword}"`);
    }
  }

  for (const keyword of LOW_KEYWORDS) {
    if (textLower.includes(keyword)) {
      score += 2;
      reasoning.push(`+2: "${keyword}"`);
    }
  }

  return { score, reasoning };
}

function buildHighlightPrompt(decision: {
  title: string;
  ementa: string;
  relator: string | null;
  orgaoJulgador: string | null;
  tribunalName: string;
  tribunalCode: string;
  leiArticles: string | null;
  fullText: string | null;
}): string {
  let artigosStr = 'Nenhum artigo da Lei 14.133 vinculado.';
  const arts = parseLeiArticles(decision.leiArticles);
  if (arts.length > 0) {
    artigosStr = `Artigos da Lei 14.133/2021 vinculados: ${arts.map((a) => `Art. ${a}`).join(', ')}`;
  }

  return `Você é um especialista em Direito Administrativo, Licitações e Contratos Públicos, e também um editor jurídico experiente que avalia decisões de Tribunais de Contas Estaduais para potencial de publicação em blog jurídico.

TAREFA: Avaliar se esta decisão do ${decision.tribunalName} (${decision.tribunalCode}) merece um artigo no blog do Prof. Daniel Barral (especialista em licitações e contratos públicos sob a Lei 14.133/2021).

CRITÉRIOS DE AVALIAÇÃO (cada um de 0 a 100):
1. **noveltyScore** - Novidade da tese: É uma tese inédita ou consolida entendimento recente? Temas batidos = 0-30, temas em evolução = 40-60, tese nova = 70-100
2. **practicalImpactScore** - Impacto prático: Afeta o dia-a-dia de pregoeiros, fiscais de contrato, gestores de licitação? Impacto genérico = 0-30, impacto setorial = 40-60, muda procedimento = 70-100
3. **juridicalSignificanceScore** - Significância jurídica: Interpretação importante da Lei 14.133? Mera aplicação = 0-30, interpretação relevante = 40-60, precedente forte = 70-100
4. **editorialPotentialScore** - Potencial editorial: Geraria interesse dos leitores do blog? Tema árido = 0-30, interesse moderado = 40-60, pauta quente = 70-100

NOTA: Decisões de TCEs estaduais podem ter especial valor quando mostram divergência ou alinhamento com entendimentos do TCU, ou quando aplicam a Lei 14.133 em contextos estaduais/municipais específicos.

DADOS DA DECISÃO:
- Tribunal: ${decision.tribunalName} (${decision.tribunalCode})
- Título: ${decision.title}
- Relator: ${decision.relator || 'N/A'}
- Órgão Julgador: ${decision.orgaoJulgador || 'N/A'}
- ${artigosStr}

Ementa:
${decision.ementa.slice(0, 3000)}

${decision.fullText ? `Texto (trecho):\n${decision.fullText.slice(0, 2000)}` : ''}

RESPONDA EXCLUSIVAMENTE em JSON válido (sem markdown, sem backticks), com esta estrutura:
{
  "noveltyScore": <0-100>,
  "practicalImpactScore": <0-100>,
  "juridicalSignificanceScore": <0-100>,
  "editorialPotentialScore": <0-100>,
  "articleWorthiness": <0-100 média ponderada dos 4 critérios>,
  "thesisSummary": "<2-3 frases explicando a tese principal em linguagem acessível>",
  "whyImportant": "<2-3 frases sobre por que esta decisão merece destaque>",
  "articleAngle": "<sugestão de título e abordagem para um artigo no blog>",
  "leiConnections": [{"article": "<número do artigo>", "connection": "<como se conecta>"}]
}`;
}

async function callGeminiForHighlight(prompt: string): Promise<HighlightAnalysis | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
        // Scoring + resumo curto — thinking come o budget, gera truncagem.
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    apiLogger.error(`[Tribunal Highlights] Gemini API error (${response.status}): ${errorText.slice(0, 200)}`);
    return null;
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) return null;

  try {
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned);

    if (
      typeof parsed.articleWorthiness !== 'number' ||
      typeof parsed.thesisSummary !== 'string' ||
      typeof parsed.whyImportant !== 'string' ||
      typeof parsed.articleAngle !== 'string'
    ) {
      apiLogger.error('[Tribunal Highlights] Resposta IA com campos faltando');
      return null;
    }

    return {
      noveltyScore: parsed.noveltyScore || 0,
      practicalImpactScore: parsed.practicalImpactScore || 0,
      juridicalSignificanceScore: parsed.juridicalSignificanceScore || 0,
      editorialPotentialScore: parsed.editorialPotentialScore || 0,
      articleWorthiness: parsed.articleWorthiness,
      thesisSummary: parsed.thesisSummary,
      whyImportant: parsed.whyImportant,
      articleAngle: parsed.articleAngle,
      leiConnections: Array.isArray(parsed.leiConnections) ? parsed.leiConnections : [],
    };
  } catch (err) {
    apiLogger.error({ err: err instanceof Error ? err.message : err }, '[Tribunal Highlights] Erro ao parsear resposta IA:');
    return null;
  }
}

/**
 * Identifica decisões TCE com potencial editorial e envia alerta por email.
 *
 * @param newDecisionIds - IDs das TribunalDecision recém-criadas
 * @returns Número de highlights criados
 */
export async function identifyAndAlertTribunalHighlights(newDecisionIds: string[]): Promise<number> {
  if (newDecisionIds.length === 0 || !process.env.GEMINI_API_KEY) {
    return 0;
  }

  console.log(`[Tribunal Highlights] Analisando ${newDecisionIds.length} novas decisões para potencial editorial...`);

  // 1. Buscar decisões do banco
  const decisions = await prisma.tribunalDecision.findMany({
    where: { id: { in: newDecisionIds } },
    select: {
      id: true,
      title: true,
      ementa: true,
      fullText: true,
      relator: true,
      orgaoJulgador: true,
      tribunalName: true,
      tribunalCode: true,
      decisionNumber: true,
      year: true,
      leiArticles: true,
      url: true,
      dataJulgamento: true,
    },
  });

  // 2. Pré-filtro: keyword score >= MIN_KEYWORD_SCORE
  const candidates: Array<{ decision: typeof decisions[0]; keywordScore: number }> = [];
  for (const decision of decisions) {
    const combinedText = [decision.title, decision.ementa, decision.fullText || ''].join(' ');
    const { score } = calculateKeywordScore(combinedText);
    console.log(`[Tribunal Highlights] ${decision.title}: keyword score = ${score} (threshold = ${MIN_KEYWORD_SCORE})`);
    if (score >= MIN_KEYWORD_SCORE) {
      candidates.push({ decision, keywordScore: score });
    }
  }

  // Ordenar por keyword score decrescente e limitar candidatos
  candidates.sort((a, b) => b.keywordScore - a.keywordScore);
  const topCandidates = candidates.slice(0, MAX_CANDIDATES);

  console.log(`[Tribunal Highlights] ${candidates.length}/${decisions.length} candidatos com score >= ${MIN_KEYWORD_SCORE}, analisando top ${topCandidates.length}`);

  if (topCandidates.length === 0) {
    console.log('[Tribunal Highlights] Nenhum candidato passou o pre-filtro. Encerrando.');
    return 0;
  }

  // 3. Análise IA de cada candidato
  const analyzed: Array<{
    decision: typeof decisions[0];
    keywordScore: number;
    analysis: HighlightAnalysis;
  }> = [];

  for (const { decision, keywordScore } of topCandidates) {
    try {
      const prompt = buildHighlightPrompt(decision);
      const analysis = await callGeminiForHighlight(prompt);

      if (analysis) {
        console.log(`[Tribunal Highlights] ${decision.title}: IA worthiness = ${analysis.articleWorthiness} (threshold = ${MIN_AI_SCORE})`);
        if (analysis.articleWorthiness >= MIN_AI_SCORE) {
          analyzed.push({ decision, keywordScore, analysis });
        }
      } else {
        console.log(`[Tribunal Highlights] ${decision.title}: Gemini retornou null`);
      }

      await new Promise(resolve => setTimeout(resolve, ANALYSIS_DELAY_MS));
    } catch (err) {
      apiLogger.error({ err: err instanceof Error ? err.message : err }, `[Tribunal Highlights] Erro ao analisar ${decision.title}:`);
    }
  }

  // 4. Ordenar por articleWorthiness decrescente e limitar
  analyzed.sort((a, b) => b.analysis.articleWorthiness - a.analysis.articleWorthiness);
  const highlights = analyzed.slice(0, MAX_HIGHLIGHTS);

  console.log(`[Tribunal Highlights] ${analyzed.length} decisões com score IA >= ${MIN_AI_SCORE}, criando ${highlights.length} destaques`);

  if (highlights.length === 0) {
    return 0;
  }

  // 5. Persistir registros TribunalHighlight
  const createdHighlights: Array<{
    id: string;
    decision: typeof decisions[0];
    keywordScore: number;
    analysis: HighlightAnalysis;
  }> = [];

  for (const { decision, keywordScore, analysis } of highlights) {
    try {
      const highlight = await prisma.tribunalHighlight.create({
        data: {
          tribunalDecisionId: decision.id,
          keywordScore,
          aiArticleWorthiness: analysis.articleWorthiness,
          aiThesisSummary: analysis.thesisSummary,
          aiWhyImportant: analysis.whyImportant,
          aiArticleAngle: analysis.articleAngle,
          aiLeiConnections: analysis.leiConnections.length > 0
            ? JSON.stringify(analysis.leiConnections)
            : null,
        },
      });

      createdHighlights.push({ id: highlight.id, decision, keywordScore, analysis });
    } catch (err) {
      apiLogger.error({ err: err instanceof Error ? err.message : err }, `[Tribunal Highlights] Erro ao salvar highlight para ${decision.title}:`);
    }
  }

  // 6. Enviar email ao admin
  if (createdHighlights.length > 0) {
    try {
      const emailData = createdHighlights.map(h => ({
        id: h.id,
        title: h.decision.title,
        score: h.analysis.articleWorthiness,
        thesisSummary: h.analysis.thesisSummary,
        whyImportant: h.analysis.whyImportant,
        articleAngle: h.analysis.articleAngle,
        leiConnections: h.analysis.leiConnections,
        decisionUrl: h.decision.url || '',
        tribunalCode: h.decision.tribunalCode,
      }));

      const emailSent = await sendTribunalHighlightAlert(emailData);

      if (emailSent) {
        await prisma.tribunalHighlight.updateMany({
          where: { id: { in: createdHighlights.map(h => h.id) } },
          data: { emailSentAt: new Date() },
        });
      }
    } catch (err) {
      apiLogger.error({ err: err instanceof Error ? err.message : err }, '[Tribunal Highlights] Erro ao enviar email:');
    }
  }

  console.log(`[Tribunal Highlights] ${createdHighlights.length} destaques criados e notificados`);
  return createdHighlights.length;
}
