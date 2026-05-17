import type { PrismaClient } from '@prisma/client';
import { generate } from './ai';
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

// Schema JSON puro (compatível com Gemini structured output); valores literais
// dos antigos `Type.OBJECT`/`Type.STRING` da SDK @google/genai. Definindo aqui
// evita acoplamento com a SDK do Google — `lib/ai/providers/gemini.ts` apenas
// repassa este objeto no `generationConfig.responseSchema`.
const responseSchema = {
  type: 'OBJECT',
  properties: {
    summary: {
      type: 'STRING',
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

REGRAS DE ESTILO (OBRIGATÓRIAS):
1. NUNCA comece o resumo com palavras vagas que descrevem o documento em vez do conteúdo. Proibido começar com:
   - "Trata-se de...", "Esta nota...", "Este parecer...", "Esta manifestação...", "A manifestação...", "A presente...", "O presente...", "A AGU define...", "A AGU orienta...", "A norma..."
   A primeira palavra deve ser um SUBSTANTIVO CONCRETO do tema (ex: "Dispensa de licitação...", "A permuta de imóveis...", "O apostilamento...") ou um VERBO DE AÇÃO direto (ex: "Permite-se...", "Veda-se...", "Admite-se...").
2. Não repita o número/sigla do parecer (já consta no título).
3. NUNCA escreva "Note que" ou comentários meta sobre revogação no fim — isso já tem badge separado na UI.
4. Use APENAS caracteres UTF-8 normais (ç, é, ã, ó). NUNCA escape HTML como &iacute;, &ccedil;, &eacute; — isso quebra a renderização.
5. Cite artigos da Lei 14.133/2021 com formato "art. X" ou "arts. X e Y" (não "artigo" por extenso, exceto na primeira citação se preferir).

DOCUMENTO:
"""
${fullText}
"""`;
}

/**
 * Gera resumo de um parecer via lib/ai (provider gemini forçado por chamada;
 * task=extraction; structured output via responseSchema).
 *
 * Assinatura simplificada (antes recebia `genAI` por reuso de cliente —
 * desnecessário com `lib/ai`, que cuida do client/keep-alive internamente).
 */
export async function summarizeOne(
  doc: { title: string; description: string | null; content: string | null },
): Promise<SummaryOutput> {
  const { text } = await generate('extraction', {
    messages: [{ role: 'user', content: buildPrompt(doc) }],
    provider: 'gemini',
    responseSchema,
    thinkingBudget: 0,
  });
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

  // Pré-check explícito — lib/ai lançaria per-call (em loop seria barulhento);
  // este guard mantém o fail-fast original de operações em lote.
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY não configurado');

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
      const out = await summarizeOne(doc);
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
