import type { PrismaClient } from '@prisma/client';
import { generate } from './ai';
import { PRIMARY_GEMINI_MODEL } from './gemini/config';
import { setLeiArticles } from './lei-articles';

export interface ClassificationOutput {
  licitacoesContratos: boolean;
  subtemas: string[];
  cursosRelevantes: string[];
  leiArticles: string[];
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

export interface ClassifyResult {
  processed: number;
  relevant: number;
  irrelevant: number;
  errors: number;
  errorSamples: string[];
  byCourse: Record<string, number>;
  byConfidence: { high: number; medium: number; low: number };
  startedAt: string;
  finishedAt: string;
  elapsedSeconds: number;
}

export const VALID_COURSE_IDS = ['2', '3', '4', '7', '8', '9', '10'];

const COURSES_DESCRIPTION = `
- "2": Planejamento das Contratações Públicas (PCA, ETP, Termo de Referência, Projeto Básico)
- "3": Gestão e Fiscalização de Contratos Administrativos (responsabilidades de gestor/fiscal, medição, pagamento)
- "4": Processo Administrativo Sancionador (apuração, contraditório, aplicação de penalidades)
- "7": Assessoramento Jurídico em Licitações (parecer jurídico, atuação consultiva)
- "8": Revisão, Reajuste e Repactuação (equilíbrio econômico-financeiro)
- "9": Alterações Contratuais (limites quantitativos/qualitativos, acréscimos/supressões)
- "10": Contratação Direta (dispensa, inexigibilidade, requisitos e procedimentos)
`.trim();

// Schema JSON puro (valores literais dos antigos `Type.OBJECT`/`Type.STRING`
// da SDK @google/genai). `lib/ai/providers/gemini.ts` apenas repassa este
// objeto no `generationConfig.responseSchema`.
const responseSchema = {
  type: 'OBJECT',
  properties: {
    licitacoesContratos: { type: 'BOOLEAN' },
    subtemas: { type: 'ARRAY', items: { type: 'STRING' } },
    cursosRelevantes: { type: 'ARRAY', items: { type: 'STRING' } },
    leiArticles: { type: 'ARRAY', items: { type: 'STRING' } },
    confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] },
    reasoning: { type: 'STRING' },
  },
  required: ['licitacoesContratos', 'subtemas', 'cursosRelevantes', 'leiArticles', 'confidence', 'reasoning'],
};

function buildPrompt(doc: { title: string; description: string | null; content: string | null }): string {
  const fullText = [doc.title, doc.description, doc.content].filter(Boolean).join('\n\n').slice(0, 2500);
  return `Você é um classificador de documentos jurídicos da AGU sobre licitações e contratos administrativos no Brasil.

Catálogo de cursos do site (use os IDs abaixo em "cursosRelevantes"):
${COURSES_DESCRIPTION}

Analise o documento abaixo e retorne JSON conforme o schema.

REGRAS:
1. licitacoesContratos = true APENAS se o tema central for licitações, contratações públicas, contratos administrativos, gestão/fiscalização de contratos, ou regime jurídico relacionado.
2. licitacoesContratos = false se o tema for: combate à corrupção (sem nexo com licitações), proteção de dados, previdência, RH/concursos públicos, direito tributário, ações civis públicas sem objeto contratual, comunicação social, gestão financeira de uma autarquia em si, etc.
3. cursosRelevantes só inclui IDs válidos: ${VALID_COURSE_IDS.join(', ')}.
4. leiArticles deve listar artigos da Lei 14.133/2021 explicitamente citados OU diretamente aplicáveis. NÃO inclua artigos de outras leis (8.666/1993, 10.520/2002, etc.).
5. Subtemas em português, minúsculas, sem acento quando possível, palavras-chave concisas.

DOCUMENTO:
"""
${fullText}
"""`;
}

/**
 * Classifica um parecer via lib/ai (provider gemini forçado por chamada;
 * task=classification — default seria anthropic, mas este classifier usa
 * structured output via responseSchema, que é feature Gemini).
 *
 * Assinatura simplificada (antes recebia `genAI` por reuso de cliente —
 * desnecessário com `lib/ai`).
 */
export async function classifyOne(
  doc: { title: string; description: string | null; content: string | null },
): Promise<ClassificationOutput> {
  const { text } = await generate('classification', {
    messages: [{ role: 'user', content: buildPrompt(doc) }],
    provider: 'gemini',
    responseSchema,
    thinkingBudget: 0,
  });
  if (!text) throw new Error('Gemini retornou texto vazio');
  const parsed = JSON.parse(text) as ClassificationOutput;
  parsed.cursosRelevantes = (parsed.cursosRelevantes || []).filter((c) => VALID_COURSE_IDS.includes(c));
  parsed.subtemas = parsed.subtemas || [];
  parsed.leiArticles = parsed.leiArticles || [];
  return parsed;
}

/**
 * Classifica pareceres CONUNI sem classificação prévia. Pula docs com
 * override manual (admin já decidiu).
 *
 * Idempotente: chamadas repetidas só processam novos.
 */
export async function classifyPendingPareceres(
  prisma: PrismaClient,
  opts: { limit?: number; delayMs?: number; logger?: (msg: string) => void } = {},
): Promise<ClassifyResult> {
  const { limit, delayMs = 200, logger = () => {} } = opts;
  const startedAt = new Date();

  // Pré-check explícito — lib/ai lançaria per-call (em loop seria barulhento);
  // este guard mantém o fail-fast original de operações em lote.
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY não configurado');

  const candidates = await prisma.document.findMany({
    where: {
      category: { in: ['parecer', 'parecer-vinculante', 'nota-tecnica', 'despacho', 'decor'] },
      isPublic: true,
      AND: [
        { NOT: { aiClassification: { contains: 'licitacoesContratos' } } },
        { NOT: { aiClassification: { contains: 'licitacoesContratosManualBy' } } },
      ],
    },
    select: { id: true, title: true, description: true, content: true, aiClassification: true, category: true },
    orderBy: { uploadedAt: 'desc' },
    take: limit,
  });

  logger(`Candidatos a classificar: ${candidates.length}`);

  const result: ClassifyResult = {
    processed: 0,
    relevant: 0,
    irrelevant: 0,
    errors: 0,
    errorSamples: [],
    byCourse: {},
    byConfidence: { high: 0, medium: 0, low: 0 },
    startedAt: startedAt.toISOString(),
    finishedAt: '',
    elapsedSeconds: 0,
  };

  for (let i = 0; i < candidates.length; i++) {
    const doc = candidates[i];
    try {
      const cls = await classifyOne(doc);
      result.processed++;
      if (cls.licitacoesContratos) result.relevant++; else result.irrelevant++;
      result.byConfidence[cls.confidence]++;
      cls.cursosRelevantes.forEach((c) => result.byCourse[c] = (result.byCourse[c] || 0) + 1);

      const existing = doc.aiClassification ? safeParseJson(doc.aiClassification) : {};
      const merged = {
        ...existing,
        licitacoesContratos: cls.licitacoesContratos,
        subtemas: cls.subtemas,
        cursosRelevantes: cls.cursosRelevantes,
        leiArticles: cls.leiArticles,
        classificationConfidence: cls.confidence,
        classificationReasoning: cls.reasoning,
        classifiedAt: new Date().toISOString(),
        classifiedBy: PRIMARY_GEMINI_MODEL,
      };
      await prisma.document.update({
        where: { id: doc.id },
        data: {
          aiClassification: JSON.stringify(merged),
          ...(cls.leiArticles.length > 0 ? setLeiArticles(cls.leiArticles) : {}),
        },
      });

      const flag = cls.licitacoesContratos ? '✓' : '✗';
      logger(`[${i + 1}/${candidates.length}] ${flag} ${doc.title.slice(0, 70)}`);
    } catch (e) {
      result.errors++;
      const msg = `${doc.title.slice(0, 60)}: ${(e as Error).message}`;
      if (result.errorSamples.length < 5) result.errorSamples.push(msg);
      logger(`[${i + 1}/${candidates.length}] ✗ ERRO: ${msg}`);
    }
    if (i < candidates.length - 1 && delayMs > 0) await sleep(delayMs);
  }

  const finishedAt = new Date();
  result.finishedAt = finishedAt.toISOString();
  result.elapsedSeconds = Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000);
  return result;
}

function safeParseJson(s: string): Record<string, unknown> {
  try { return JSON.parse(s); } catch { return {}; }
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
