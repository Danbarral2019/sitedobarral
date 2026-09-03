/**
 * Enriquecimento de acórdãos TCU via Gemini
 *
 * Código compartilhado entre:
 * - `app/api/cron/sync-tcu-acordaos/route.ts` (import incremental, acórdãos novos)
 * - `scripts/improve-tcu-descriptions.ts` (reprocessamento em lote da base)
 *
 * Parâmetros ajustados para tier pago Gemini — ver `docs/ROADMAP_GEMINI_PAGO.md`.
 */

import { getLeiArticles } from './lei-articles';

// Família 3.x cobre billing pago (3-flash-preview é sucessor direto de 2.5-flash).
// gemini-2.5-flash continua até 17/jun/2026 como fallback (ver lib/gemini/config.ts).
// Chamadas a gemini-2.0-flash caem no pool free e retornam 429.
export const GEMINI_MODEL = 'gemini-3-flash-preview';

// Delay entre chamadas Gemini (ms). Tier pago aguenta ~10k req/min.
export const ENRICHMENT_DELAY_MS = 50;

// Janelas de input do prompt — tier pago Gemini (1M tokens de contexto).
export const EMENTA_MAX = 32_000;
export const CONTENT_MAX = 20_000;

// Config de output do Gemini para resumos executivos.
// thinkingBudget: 0 desativa o "thinking mode" do Gemini 2.5 — senão ele
// consome ~95% do maxOutputTokens raciocinando e a resposta sai truncada.
// Resumo executivo não precisa de thinking; é uma reformulação direta.
export const SUMMARY_GENERATION_CONFIG = {
  temperature: 0.3,
  maxOutputTokens: 1024,
  thinkingConfig: { thinkingBudget: 0 },
} as const;

export interface SummaryPromptDoc {
  title: string;
  description: string | null;
  content: string | null;
  leiArticlesArr: string[];
  metaTcu?: {
    ementaCompleta?: string | null;
    area?: string | null;
    tema?: string | null;
    subtema?: string | null;
  } | null;
}

export function buildSummaryPrompt(doc: SummaryPromptDoc): string {
  const artigos = getLeiArticles(doc);
  const artigosStr = artigos.length > 0
    ? `Artigos da Lei 14.133/2021 vinculados: ${artigos.map((a: string) => `Art. ${a}`).join(', ')}`
    : 'Nenhum artigo da Lei 14.133 vinculado especificamente.';

  const ementaSection = doc.metaTcu?.ementaCompleta
    ? `Ementa completa:\n${doc.metaTcu.ementaCompleta.slice(0, EMENTA_MAX)}`
    : '';

  // Só inclui conteúdo integral se for diferente de description/ementa
  // (evita repetição inútil de tokens).
  const hasDistinctContent = !!doc.content
    && doc.content.length > 500
    && doc.content !== doc.description
    && doc.content !== doc.metaTcu?.ementaCompleta;
  const contentSection = hasDistinctContent
    ? `Conteúdo integral do acórdão (voto/relatório/fundamentação):\n${doc.content!.slice(0, CONTENT_MAX)}`
    : '';

  return `Você é um especialista em Direito Administrativo, Licitações e Contratos.

TAREFA: Gerar um resumo executivo de 3-5 frases para o acórdão do TCU abaixo.

REGRAS:
1. O resumo deve explicar a decisão em linguagem acessível (para servidores públicos, não juristas)
2. Deve conectar claramente a decisão com a prática de licitações e contratos públicos
3. Se houver artigos da Lei 14.133/2021 vinculados, mencione-os brevemente
4. Entre 3 e 5 frases. Priorize densidade: cite o raciocínio/fundamento quando relevante, não apenas a tese
5. NÃO repita o número do acórdão no resumo
6. Use voz ativa e evite jargão desnecessário
7. Retorne APENAS o resumo, sem preâmbulos

DADOS DO ACÓRDÃO:
- Título: ${doc.title}
- Área: ${doc.metaTcu?.area || 'N/A'}
- Tema: ${doc.metaTcu?.tema || 'N/A'}
- Subtema: ${doc.metaTcu?.subtema || 'N/A'}
- ${artigosStr}

Enunciado/Tese:
${doc.description || 'N/A'}

${ementaSection}

${contentSection}

RESUMO EXECUTIVO:`;
}

export async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: SUMMARY_GENERATION_CONFIG,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();
  if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
    return data.candidates[0].content.parts[0].text.trim();
  }
  throw new Error('Resposta do Gemini sem texto');
}
