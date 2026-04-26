/**
 * Validador de citações entre aspas em respostas geradas por LLM.
 *
 * Motivação: 2026-04-26 Gemini Flash inventou citação atribuída ao Enunciado
 * IBDA nº 29 com aspas em texto que não existia em nenhuma fonte. Esse
 * módulo é a defesa em camadas (defense-in-depth) contra hallucinations
 * desse tipo, executada AO FIM da síntese — independente de o prompt
 * ter sido respeitado pelo modelo.
 *
 * Algoritmo:
 *   1. Extrai todos os trechos entre aspas duplas com 20-400 chars na resposta.
 *      (citações curtas demais — termos técnicos isolados — são ignoradas
 *      porque o falso-positivo seria alto.)
 *   2. Normaliza tanto a citação quanto cada chunk de contexto:
 *      lowercase, remove acentos, colapsa espaços, remove pontuação leve.
 *   3. Verifica se a citação normalizada existe como substring em algum
 *      chunk normalizado.
 *   4. Reporta as citações que NÃO foram encontradas em nenhum chunk —
 *      sinalização de hallucination.
 *
 * Performance: O(citações × chunks). Para 5 citações × 20 chunks × 5kB
 * de texto cada, ~50ms. Sem rede, executável em runtime serverless.
 */

/**
 * Aspas duplas tipográficas (curly quotes) e ASCII. Match não-greedy.
 * Range 20-400 chars filtra termos isolados (típico ≤15 chars) e
 * parágrafos longos (≥400 chars) que normalmente não são "citação"
 * literal mas reproduções estruturais.
 */
const QUOTE_REGEX = /["“]([^"”]{20,400})["”]/g;

export interface CitationValidationResult {
  /** Quantas citações entre aspas foram encontradas na resposta */
  totalQuotes: number;
  /** Quantas dessas casaram com algum chunk de contexto */
  validQuotes: number;
  /** Citações que NÃO foram encontradas em nenhum chunk (hallucinations prováveis) */
  invalidQuotes: string[];
}

/**
 * Normaliza texto pra comparação tolerante:
 * - Lowercase
 * - Remove acentos (NFD + filtro de marcas)
 * - Colapsa whitespace (incluindo NBSP, tab, newline) em 1 espaço
 * - Remove pontuação fraca (vírgula, ponto, ponto-e-vírgula, dois-pontos,
 *   travessão, hífen, parênteses, aspas internas residuais)
 *
 * Mantém: letras, dígitos, espaços. Suficiente pra detectar citação
 * literal mesmo com variações leves de formatação.
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .replace(/[\s ]+/g, ' ')
    .replace(/[.,;:\-—–()\[\]"'`]/g, '') // pontuação fraca: remove (mantém boundaries)
    .replace(/\s+/g, ' ') // colapsa whitespace incluindo NBSP
    .trim();
}

/**
 * Extrai todos os trechos entre aspas no comprimento alvo (20-400 chars).
 * Trechos com aspas internas escapadas ("...\"...\"...") não são suportados —
 * retorna o primeiro fechamento. Cobre 99% dos casos práticos de geração LLM.
 */
export function extractQuotedSpans(answer: string): string[] {
  const matches: string[] = [];
  // Regex tem `g` flag — precisa de novo objeto pra cada call
  const re = new RegExp(QUOTE_REGEX.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(answer)) !== null) {
    if (m[1]) matches.push(m[1]);
  }
  return matches;
}

/**
 * Valida que cada citação entre aspas na resposta existe LITERALMENTE
 * (após normalização) em pelo menos um dos chunks de contexto.
 *
 * @param answer Resposta sintetizada pelo LLM
 * @param contextChunks Texto bruto dos chunks que entraram no prompt
 * @returns Resultado com counts e lista de citações inválidas (truncadas em 200 chars cada para logging)
 */
export function validateQuotedCitations(
  answer: string,
  contextChunks: string[],
): CitationValidationResult {
  const quotes = extractQuotedSpans(answer);
  if (quotes.length === 0) {
    return { totalQuotes: 0, validQuotes: 0, invalidQuotes: [] };
  }

  // Normaliza chunks UMA VEZ (caro ~5ms por chunk de 5kB)
  const normalizedChunks = contextChunks
    .filter((c) => typeof c === 'string' && c.length > 0)
    .map(normalize);

  const invalidQuotes: string[] = [];
  let validCount = 0;

  for (const quote of quotes) {
    const normQuote = normalize(quote);
    if (normQuote.length === 0) {
      // Após normalização sobrou nada — citação só de pontuação. Ignora.
      continue;
    }
    const found = normalizedChunks.some((chunk) => chunk.includes(normQuote));
    if (found) {
      validCount++;
    } else {
      invalidQuotes.push(quote.slice(0, 200));
    }
  }

  return {
    totalQuotes: quotes.length,
    validQuotes: validCount,
    invalidQuotes,
  };
}

/**
 * Mensagem de aviso (em PT-BR) pra anexar à resposta quando há citações
 * inválidas. Não substitui as aspas — só alerta o usuário a verificar.
 * A política de "remover automaticamente" foi descartada porque pode
 * cortar contexto útil; melhor sinalizar e deixar o aluno conferir.
 */
export function buildCitationWarning(invalidQuotes: string[]): string {
  if (invalidQuotes.length === 0) return '';
  const examples = invalidQuotes
    .slice(0, 2)
    .map((q) => `"${q.slice(0, 80)}${q.length > 80 ? '...' : ''}"`)
    .join('; ');
  const noun = invalidQuotes.length === 1 ? 'citação' : 'citações';
  return (
    `\n\n⚠️ **Verificação automática:** ${invalidQuotes.length} ${noun} entre aspas` +
    ` não foi encontrada literalmente nas fontes da base (${examples}). Confira` +
    ` diretamente nas fontes listadas — IA jurídica pode parafrasear de forma` +
    ` plausível mas imprecisa.`
  );
}
