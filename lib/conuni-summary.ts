import type { PrismaClient } from '@prisma/client';
import { GoogleGenAI, Type } from '@google/genai';
import { PRIMARY_GEMINI_MODEL } from './gemini/config';

export interface SummaryOutput {
  summary: string;
}

export interface SummaryResult {
  processed: number;
  errors: number;
  errorSamples: string[];
  startedAt: string;
  finishedAt: string;
  elapsedSeconds: number;
}

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description: 'Resumo didático em 2-3 frases (max 350 caracteres) contextualizado para licitações e contratos. Linguagem clara, sem juridiquês excessivo. Sempre cite o tema central, a tese fixada e o(s) artigo(s) da Lei 14.133 quando aplicável.',
    },
  },
  required: ['summary'],
};

function buildPrompt(doc: { title: string; description: string | null; content: string | null }): string {
  const fullText = [doc.title, doc.description, doc.content].filter(Boolean).join('\n\n').slice(0, 3000);
  return `Você é um especialista em licitações e contratos administrativos no Brasil, escrevendo resumos didáticos para alunos do site do Prof. Daniel Barral.

Gere um resumo em 2-3 frases (até 350 caracteres) explicando o que esta manifestação da AGU/CONUNI decide ou orienta, sempre contextualizado para licitações e contratos. Inclua:
- O tema central em linguagem clara (sem juridiquês)
- A conclusão/tese principal
- Artigo(s) da Lei 14.133/2021 aplicável(is), quando relevante

Evite repetir o número do parecer (já está no título). Não use "Trata-se de..." ou "O presente parecer...". Vá direto ao ponto.

DOCUMENTO:
"""
${fullText}
"""`;
}

export async function summarizeOne(
  genAI: GoogleGenAI,
  doc: { title: string; description: string | null; content: string | null },
): Promise<SummaryOutput> {
  const result = await genAI.models.generateContent({
    model: PRIMARY_GEMINI_MODEL,
    contents: [{ text: buildPrompt(doc) }],
    config: {
      responseMimeType: 'application/json',
      responseSchema,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  const text = result.text;
  if (!text) throw new Error('Gemini retornou texto vazio');
  const parsed = JSON.parse(text) as SummaryOutput;
  if (!parsed.summary || typeof parsed.summary !== 'string') {
    throw new Error('Gemini não retornou summary válido');
  }
  return parsed;
}

/**
 * Gera resumos IA pra pareceres relevantes (licitacoesContratos:true) que
 * ainda não têm summary. Pula irrelevantes (economiza ~70% de tokens) e
 * docs já com summary preenchido.
 *
 * Idempotente.
 */
export async function summarizeRelevantPareceres(
  prisma: PrismaClient,
  opts: { limit?: number; delayMs?: number; logger?: (msg: string) => void } = {},
): Promise<SummaryResult> {
  const { limit, delayMs = 200, logger = () => {} } = opts;
  const startedAt = new Date();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurado');
  const genAI = new GoogleGenAI({ apiKey });

  const candidates = await prisma.document.findMany({
    where: {
      category: { in: ['parecer', 'parecer-vinculante', 'nota-tecnica', 'despacho', 'decor'] },
      isPublic: true,
      AND: [
        { aiClassification: { contains: '"licitacoesContratos":true' } },
        { NOT: { aiClassification: { contains: '"summary"' } } },
      ],
    },
    select: { id: true, title: true, description: true, content: true, aiClassification: true },
    orderBy: { uploadedAt: 'desc' },
    take: limit,
  });

  logger(`Candidatos: ${candidates.length}`);

  const result: SummaryResult = {
    processed: 0,
    errors: 0,
    errorSamples: [],
    startedAt: startedAt.toISOString(),
    finishedAt: '',
    elapsedSeconds: 0,
  };

  for (let i = 0; i < candidates.length; i++) {
    const doc = candidates[i];
    try {
      const out = await summarizeOne(genAI, doc);
      const existing = doc.aiClassification ? safeJson(doc.aiClassification) : {};
      const merged = {
        ...existing,
        summary: out.summary.trim(),
        summaryGeneratedAt: new Date().toISOString(),
        summaryBy: PRIMARY_GEMINI_MODEL,
      };
      await prisma.document.update({
        where: { id: doc.id },
        data: { aiClassification: JSON.stringify(merged) },
      });
      result.processed++;
      logger(`[${i + 1}/${candidates.length}] ✓ ${doc.title.slice(0, 70)}`);
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

function safeJson(s: string): Record<string, unknown> {
  try { return JSON.parse(s); } catch { return {}; }
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
