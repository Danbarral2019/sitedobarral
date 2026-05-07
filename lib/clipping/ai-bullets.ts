/**
 * Camada IA do clipping diário TCU: gera bullets editoriais curtos para
 * casos processuais "secos" (embargos rejeitados, recursos negados, etc.)
 * onde os dispositivos extraídos não dão contexto suficiente.
 *
 * Filosofia:
 * - Só é acionada quando heurística detecta texto pobre.
 * - Prompt restrito ao texto do inteiro teor — proibido inferir além.
 * - Se a IA não tem informação suficiente, retorna array vazio
 *   (preferimos não mostrar nada a alucinar).
 */

import { PRIMARY_GEMINI_MODEL } from '@/lib/gemini/config';
import type { Dispositivo } from './dispositivo-extractor';

const MAX_INTEIRO_TEOR_CHARS = 18000;
const MAX_OUTPUT_TOKENS = 700;

const PROCESSUAL_KEYWORDS = [
  'EMBARGOS DE DECLARAÇÃO',
  'TENTATIVA DE REDISCUSSÃO',
  'NÃO PROVIMENTO',
  'NÃO CONFIGURAÇÃO DE VÍCIOS',
  'CONHECIMENTO E REJEIÇÃO',
  'CONHECIMENTO. REJEIÇÃO',
  'NEGATIVA DE PROVIMENTO',
  'PEDIDO DE REEXAME',
  'RECURSO DE RECONSIDERAÇÃO',
  'INTEMPESTIVIDADE',
];

export function shouldEnrichWithAi(opts: {
  dispositivos: Dispositivo[];
  ementa: string;
  hasInteiroTeor: boolean;
}): boolean {
  const { dispositivos, ementa, hasInteiroTeor } = opts;
  if (!hasInteiroTeor) return false;
  // Se já temos 3+ dispositivos longos, não precisa.
  const totalChars = dispositivos.reduce((acc, d) => acc + d.texto.length, 0);
  if (dispositivos.length >= 3 && totalChars >= 400) return false;
  // Heurística: poucos dispositivos OU texto curto OU ementa indica caso processual.
  if (dispositivos.length < 2) return true;
  if (totalChars < 250) return true;
  const ementaUpper = ementa.toUpperCase();
  for (const kw of PROCESSUAL_KEYWORDS) {
    if (ementaUpper.includes(kw)) return true;
  }
  return false;
}

function buildPrompt(input: {
  ementa: string;
  inteiroTeor: string;
  dispositivos: Dispositivo[];
}): string {
  const { ementa, inteiroTeor, dispositivos } = input;
  const teor = inteiroTeor.length > MAX_INTEIRO_TEOR_CHARS
    ? inteiroTeor.slice(0, MAX_INTEIRO_TEOR_CHARS) + ' [...truncado]'
    : inteiroTeor;
  const dispStr = dispositivos.length > 0
    ? dispositivos.map((d) => `- ${d.numero}. ${d.texto}`).join('\n')
    : '(nenhum dispositivo numerado extraído)';

  return `Você é assistente editorial de um curso de Direito Administrativo. Sua tarefa é extrair, do texto integral abaixo, 2 a 4 bullets curtos que ajudem um aluno (servidor público) a entender O QUE o TCU decidiu e POR QUÊ.

REGRAS RÍGIDAS:
1. Use APENAS informação presente no texto fornecido. Não invente. Não infira além do que está escrito.
2. Cada bullet tem entre 12 e 35 palavras, em português brasileiro claro, sem juridiquês desnecessário.
3. Foque em: motivos da decisão (ratio decidendi), tese consolidada, e — se houver — implicação prática para gestores/fiscais. NÃO repita literal os dispositivos numerados; eles já são exibidos separadamente.
4. Se o texto não tem informação suficiente para gerar bullets seguros, retorne lista vazia.
5. NÃO use marcadores como "•" ou "-" no início. NÃO use markdown.

EMENTA OFICIAL:
${ementa}

DISPOSITIVOS NUMERADOS JÁ EXTRAÍDOS (apenas para contexto, não repita):
${dispStr}

TEXTO INTEGRAL DO ACÓRDÃO (relatório, voto, dispositivo):
${teor}

Responda EXCLUSIVAMENTE com JSON válido no formato:
{"bullets": ["frase 1", "frase 2", "frase 3"]}

Se não houver informação segura, responda exatamente:
{"bullets": []}`;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

function parseBullets(rawText: string): string[] {
  // Tenta extrair JSON do output (que pode vir com cercas markdown ou texto extra)
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return [];
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed || !Array.isArray(parsed.bullets)) return [];
    return parsed.bullets
      .filter((b: unknown): b is string => typeof b === 'string')
      .map((b: string) => b.trim())
      .filter((b: string) => b.length >= 20 && b.length <= 400)
      .slice(0, 4);
  } catch {
    return [];
  }
}

export async function generateAiBullets(input: {
  ementa: string;
  inteiroTeor: string;
  dispositivos: Dispositivo[];
}): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[Clipping AI] GEMINI_API_KEY ausente — pulando enriquecimento');
    return [];
  }

  const prompt = buildPrompt(input);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${PRIMARY_GEMINI_MODEL}:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          // Resumo factual curto — sem thinking budget pra evitar truncagem.
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.warn(`[Clipping AI] Gemini ${response.status}: ${errText.slice(0, 200)}`);
      return [];
    }

    const data = (await response.json()) as GeminiResponse;
    if (data.promptFeedback?.blockReason) {
      console.warn(`[Clipping AI] Gemini bloqueou: ${data.promptFeedback.blockReason}`);
      return [];
    }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return [];
    return parseBullets(text);
  } catch (e) {
    console.warn('[Clipping AI] Erro:', e instanceof Error ? e.message : String(e));
    return [];
  }
}
