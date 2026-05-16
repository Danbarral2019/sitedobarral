/**
 * TCU Highlight Analyzer
 *
 * Identifica acórdãos com potencial editorial entre os novos importados.
 * Usa Gemini para avaliar relevância e sugerir ângulos de artigo.
 *
 * Fluxo:
 * 1. Pré-filtro: keyword score >= 40
 * 2. Análise IA (máx 15 candidatos)
 * 3. Filtro IA: articleWorthiness >= 70
 * 4. Limite: máx 5 destaques
 * 5. Persistir TcuHighlight
 * 6. Email ao admin
 */

import { prisma } from '@/lib/prisma';
import { analyzeRelevanceTCU } from '@/lib/tcu-module';
import { sendTcuHighlightAlert } from '@/lib/email';
import { PRIMARY_GEMINI_MODEL } from '@/lib/gemini/config';
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

function buildHighlightPrompt(doc: {
  title: string;
  description: string | null;
  leiArticles: string | null;
  metaTcu?: {
    ementaCompleta?: string | null;
    area?: string | null;
    tema?: string | null;
    subtema?: string | null;
    relator?: string | null;
  } | null;
}): string {
  let artigosStr = 'Nenhum artigo da Lei 14.133 vinculado.';
  if (doc.leiArticles) {
    try {
      const arts = JSON.parse(doc.leiArticles);
      if (Array.isArray(arts) && arts.length > 0) {
        artigosStr = `Artigos da Lei 14.133/2021 vinculados: ${arts.map((a: string) => `Art. ${a}`).join(', ')}`;
      }
    } catch { /* ignore */ }
  }

  return `Você é um especialista em Direito Administrativo, Licitações e Contratos Públicos, e também um editor jurídico experiente que avalia acórdãos do TCU para potencial de publicação em blog jurídico.

TAREFA: Avaliar se este acórdão do TCU merece um artigo no blog do Prof. Daniel Barral (especialista em licitações e contratos públicos sob a Lei 14.133/2021).

CRITÉRIOS DE AVALIAÇÃO (cada um de 0 a 100):
1. **noveltyScore** - Novidade da tese: É uma tese inédita ou consolida entendimento recente? Temas batidos = 0-30, temas em evolução = 40-60, tese nova = 70-100
2. **practicalImpactScore** - Impacto prático: Afeta o dia-a-dia de pregoeiros, fiscais de contrato, gestores de licitação? Impacto genérico = 0-30, impacto setorial = 40-60, muda procedimento = 70-100
3. **juridicalSignificanceScore** - Significância jurídica: Interpretação importante da Lei 14.133? Mera aplicação = 0-30, interpretação relevante = 40-60, precedente forte = 70-100
4. **editorialPotentialScore** - Potencial editorial: Geraria interesse dos leitores do blog? Tema árido = 0-30, interesse moderado = 40-60, pauta quente = 70-100

DADOS DO ACÓRDÃO:
- Título: ${doc.title}
- Relator: ${doc.metaTcu?.relator || 'N/A'}
- Área: ${doc.metaTcu?.area || 'N/A'}
- Tema: ${doc.metaTcu?.tema || 'N/A'}
- Subtema: ${doc.metaTcu?.subtema || 'N/A'}
- ${artigosStr}

Enunciado/Tese:
${doc.description || 'N/A'}

${doc.metaTcu?.ementaCompleta ? `Ementa completa:\n${doc.metaTcu.ementaCompleta.slice(0, 3000)}` : ''}

RESPONDA EXCLUSIVAMENTE em JSON válido (sem markdown, sem backticks), com esta estrutura:
{
  "noveltyScore": <0-100>,
  "practicalImpactScore": <0-100>,
  "juridicalSignificanceScore": <0-100>,
  "editorialPotentialScore": <0-100>,
  "articleWorthiness": <0-100 média ponderada dos 4 critérios>,
  "thesisSummary": "<2-3 frases explicando a tese principal em linguagem acessível>",
  "whyImportant": "<2-3 frases sobre por que este acórdão merece destaque>",
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
    apiLogger.error(`[TCU Highlights] Gemini API error (${response.status}): ${errorText.slice(0, 200)}`);
    return null;
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) return null;

  try {
    // Limpar possíveis backticks de markdown
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned);

    // Validar campos essenciais
    if (
      typeof parsed.articleWorthiness !== 'number' ||
      typeof parsed.thesisSummary !== 'string' ||
      typeof parsed.whyImportant !== 'string' ||
      typeof parsed.articleAngle !== 'string'
    ) {
      apiLogger.error('[TCU Highlights] Resposta IA com campos faltando');
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
    apiLogger.error({ err: err instanceof Error ? err.message : err }, '[TCU Highlights] Erro ao parsear resposta IA:');
    return null;
  }
}

/**
 * Identifica acórdãos com potencial editorial entre os novos importados
 * e envia alerta por email ao admin.
 *
 * @param newDocIds - IDs dos documentos recém-importados
 * @returns Número de highlights criados
 */
export async function identifyAndAlertHighlights(newDocIds: string[]): Promise<number> {
  if (newDocIds.length === 0 || !process.env.GEMINI_API_KEY) {
    return 0;
  }

  console.log(`[TCU Highlights] Analisando ${newDocIds.length} novos acórdãos para potencial editorial...`);

  // 1. Buscar documentos do banco
  const docs = await prisma.document.findMany({
    where: { id: { in: newDocIds } },
    select: {
      id: true,
      title: true,
      description: true,
      leiArticles: true,
      url: true,
      acordaoNumero: true,
      acordaoAno: true,
      metaTcu: {
        select: {
          ementaCompleta: true,
          area: true,
          tema: true,
          subtema: true,
          relator: true,
          orgaoJulgador: true,
          dataJulgamento: true,
        },
      },
    },
  });

  // 2. Pré-filtro: keyword score >= MIN_KEYWORD_SCORE
  const candidates: Array<{ doc: typeof docs[0]; keywordScore: number }> = [];
  for (const doc of docs) {
    const { score } = analyzeRelevanceTCU(doc.title, doc.description || '');
    console.log(`[TCU Highlights] ${doc.title}: keyword score = ${score} (threshold = ${MIN_KEYWORD_SCORE})`);
    if (score >= MIN_KEYWORD_SCORE) {
      candidates.push({ doc, keywordScore: score });
    }
  }

  // Ordenar por keyword score decrescente e limitar candidatos
  candidates.sort((a, b) => b.keywordScore - a.keywordScore);
  const topCandidates = candidates.slice(0, MAX_CANDIDATES);

  console.log(`[TCU Highlights] ${candidates.length}/${docs.length} candidatos com score >= ${MIN_KEYWORD_SCORE}, analisando top ${topCandidates.length}`);

  if (topCandidates.length === 0) {
    console.log('[TCU Highlights] Nenhum candidato passou o pre-filtro. Encerrando.');
    return 0;
  }

  // 3. Análise IA de cada candidato
  const analyzed: Array<{
    doc: typeof docs[0];
    keywordScore: number;
    analysis: HighlightAnalysis;
  }> = [];

  for (const { doc, keywordScore } of topCandidates) {
    try {
      const prompt = buildHighlightPrompt(doc);
      const analysis = await callGeminiForHighlight(prompt);

      if (analysis) {
        console.log(`[TCU Highlights] ${doc.title}: IA worthiness = ${analysis.articleWorthiness} (threshold = ${MIN_AI_SCORE})`);
        if (analysis.articleWorthiness >= MIN_AI_SCORE) {
          analyzed.push({ doc, keywordScore, analysis });
        }
      } else {
        console.log(`[TCU Highlights] ${doc.title}: Gemini retornou null`);
      }

      await new Promise(resolve => setTimeout(resolve, ANALYSIS_DELAY_MS));
    } catch (err) {
      apiLogger.error({ err: err instanceof Error ? err.message : err }, `[TCU Highlights] Erro ao analisar ${doc.title}:`);
    }
  }

  // 4. Ordenar por articleWorthiness decrescente e limitar
  analyzed.sort((a, b) => b.analysis.articleWorthiness - a.analysis.articleWorthiness);
  const highlights = analyzed.slice(0, MAX_HIGHLIGHTS);

  console.log(`[TCU Highlights] ${analyzed.length} acórdãos com score IA >= ${MIN_AI_SCORE}, criando ${highlights.length} destaques`);

  if (highlights.length === 0) {
    return 0;
  }

  // 5. Persistir registros TcuHighlight
  const createdHighlights: Array<{
    id: string;
    document: typeof docs[0];
    keywordScore: number;
    analysis: HighlightAnalysis;
  }> = [];

  for (const { doc, keywordScore, analysis } of highlights) {
    try {
      const highlight = await prisma.tcuHighlight.create({
        data: {
          documentId: doc.id,
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

      createdHighlights.push({ id: highlight.id, document: doc, keywordScore, analysis });
    } catch (err) {
      apiLogger.error({ err: err instanceof Error ? err.message : err }, `[TCU Highlights] Erro ao salvar highlight para ${doc.title}:`);
    }
  }

  // 6. Enviar email ao admin
  if (createdHighlights.length > 0) {
    try {
      const emailData = createdHighlights.map(h => ({
        id: h.id,
        title: h.document.title,
        score: h.analysis.articleWorthiness,
        thesisSummary: h.analysis.thesisSummary,
        whyImportant: h.analysis.whyImportant,
        articleAngle: h.analysis.articleAngle,
        leiConnections: h.analysis.leiConnections,
        documentUrl: h.document.url,
      }));

      const emailSent = await sendTcuHighlightAlert(emailData);

      if (emailSent) {
        // Marcar emailSentAt nos highlights
        await prisma.tcuHighlight.updateMany({
          where: { id: { in: createdHighlights.map(h => h.id) } },
          data: { emailSentAt: new Date() },
        });
      }
    } catch (err) {
      apiLogger.error({ err: err instanceof Error ? err.message : err }, '[TCU Highlights] Erro ao enviar email:');
    }
  }

  console.log(`[TCU Highlights] ${createdHighlights.length} destaques criados e notificados`);
  return createdHighlights.length;
}
