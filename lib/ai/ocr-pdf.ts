/**
 * OCR de PDF digitalizado via Gemini — porta única do projeto.
 *
 * Modelo: `gemini-2.5-flash-lite`, com o raciocínio desligado. Medido em
 * 26/09/2026 sobre 10 pareceres digitalizados do DECOR:
 *  - flash-lite: 10 de 10 transcritos, ~US$ 0,0035 e ~21 s por parecer;
 *  - gemini-3-flash-preview (o PRIMARY_GEMINI_MODEL): 8 de 10 recusados com
 *    finishReason RECITATION (o modelo trata a transcrição literal de documento
 *    como recitação e devolve vazio). Por isso o OCR NÃO usa o modelo principal.
 *
 * Nunca lança por conteúdo: devolve { ok: false, erro }. Transcrição que não
 * termina em STOP (RECITATION, MAX_TOKENS, SAFETY) é falha — texto parcial de
 * parecer jurídico sem aviso é pior do que nenhum.
 */

export const MODELO_OCR = 'gemini-2.5-flash-lite';
/** Um parecer de 26 folhas deu ~34 mil tokens de saída; 65.536 é o máximo do modelo. */
const MAX_TOKENS_SAIDA = 65_536;
const TIMEOUT_OCR_MS = 90_000;

const PROMPT_OCR =
  'Transcreva integralmente o texto deste documento PDF digitalizado. ' +
  'Mantenha a ordem e os parágrafos; não resuma, não corrija, não comente. ' +
  'Não repita cabeçalhos nem rodapés de página. Retorne só o texto.';

export type ResultadoOcr =
  | { ok: true; texto: string; tokensEntrada: number; tokensSaida: number }
  | { ok: false; erro: string };

interface ClienteGenAI {
  models: {
    generateContent(req: unknown): Promise<{
      text?: string;
      candidates?: { finishReason?: string }[];
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
    }>;
  };
}

async function clientePadrao(): Promise<ClienteGenAI> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada');
  const { GoogleGenAI } = await import('@google/genai');
  return new GoogleGenAI({ apiKey, httpOptions: { timeout: TIMEOUT_OCR_MS } }) as unknown as ClienteGenAI;
}

export async function transcreverPdfComOcr(
  pdf: Buffer,
  opts?: { cliente?: ClienteGenAI },
): Promise<ResultadoOcr> {
  try {
    const ai = opts?.cliente ?? (await clientePadrao());
    const res = await ai.models.generateContent({
      model: MODELO_OCR,
      contents: [{ inlineData: { mimeType: 'application/pdf', data: pdf.toString('base64') } }, { text: PROMPT_OCR }],
      config: { thinkingConfig: { thinkingBudget: 0 }, maxOutputTokens: MAX_TOKENS_SAIDA, temperature: 0 },
    });
    const fim = res.candidates?.[0]?.finishReason;
    if (fim && fim !== 'STOP') return { ok: false, erro: `OCR interrompido: ${fim}` };
    const texto = (res.text ?? '').replace(/\u0000/g, '');
    const u = res.usageMetadata ?? {};
    return {
      ok: true,
      texto,
      tokensEntrada: u.promptTokenCount ?? 0,
      tokensSaida: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
    };
  } catch (e) {
    return { ok: false, erro: `OCR: ${(e as Error).message.slice(0, 120)}` };
  }
}

/**
 * Tira do texto de OCR o que se repete a cada folha: número de folha isolado,
 * "Fls. 281", "continuação do PARECER Nº ...", e qualquer linha curta com
 * letras que aparece 3 vezes ou mais (cabeçalho do órgão). Linha sem letras,
 * como "(...)", fica: é supressão de trecho em citação, não cabeçalho.
 */
export function limparCabecalhosDeOcr(texto: string): string {
  const linhas = texto.split(/\r?\n/);
  const contagem = new Map<string, number>();
  for (const l of linhas) {
    const k = l.trim();
    if (k) contagem.set(k, (contagem.get(k) ?? 0) + 1);
  }
  return linhas
    .filter((l) => {
      const k = l.trim();
      if (!k) return true;
      if (/^\d{1,4}$/.test(k)) return false;
      if (/^fls?\.?\s*\d+$/i.test(k)) return false;
      if (/^continua[çc][ãa]o d[oa]s?\s/i.test(k)) return false;
      if (k.length <= 60 && /[A-Za-zÀ-ÿ]/.test(k) && (contagem.get(k) ?? 0) >= 3) return false;
      return true;
    })
    .join('\n');
}
