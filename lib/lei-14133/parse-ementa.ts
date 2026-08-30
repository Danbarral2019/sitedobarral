/**
 * Normaliza o texto da ementa de um artigo da Lei 14.133.
 *
 * O dataset em `data/lei-14133-artigos.ts` mistura formatação:
 * - Alguns artigos têm `\n\n` separando incisos/parágrafos (correto)
 * - Outros (como o Art. 6º a partir do inciso XII) têm tudo em prosa contínua
 *
 * Esta função detecta padrões de incisos romanos (`I -`, `II -`, ...),
 * alíneas (`a)`, `b)`, ...), parágrafos (`§ Nº`) e injeta quebras de linha
 * onde estiverem faltando.
 *
 * Também detecta texto **truncado** (termina sem pontuação final ou em
 * conjunção/preposição) e marca como tal pra UI mostrar aviso.
 */

// Lookbehind aceita newline pra que incisos já separados (`\n\nI - ...`)
// também tenham o hífen normalizado em em-dash.
const ROMAN_INCISO = /(?<!\w)([IVXLCDM]{1,5})\s+[-–—]\s+/g;
const ALINEA = /(?<![\n\w])([a-z])\)\s+/g;
const PARAGRAFO = /(?<![\n])§\s*(\d+|[ºo°])/g;
const PARAGRAFO_UNICO = /(?<![\n])\s*\bParágrafo\s+único\.\s*/g;

// Sufixos de capítulo em ALL CAPS que vazaram do scrape (ex: "DAS DEFINIÇÕES",
// "DOS PRINCÍPIOS"). Convenção: começam com DA/DO/DAS/DOS, são integralmente
// maiúsculos (com acento) e podem ter múltiplas palavras separadas por
// vírgulas, conjunções "E" ou outros conectivos em maiúsculo.
const TRAILING_CHAPTER_JUNK =
  /[.,;:!?]\s+(?:DA|DO|DAS|DOS)\s+[A-ZÀ-ÚÇÃÕÉÊÔÍÓÚÂÎÛ]+(?:[\s,]+(?:[A-ZÀ-ÚÇÃÕÉÊÔÍÓÚÂÎÛ]+|E|DA|DO|DAS|DOS))*\s*$/;

export interface ParsedEmenta {
  caput: string;
  incisos: ParsedSegment[];
  paragrafos: ParsedSegment[];
  isTruncated: boolean;
  rawNormalized: string;
}

export interface ParsedSegment {
  marker: string; // "I", "II", "§ 1º", "a)" etc
  text: string;
  alineas?: ParsedSegment[];
}

/**
 * Marcadores de tramitação que o Planalto embute no meio da frase do artigo:
 * "(Vide Decreto nº 10.922, de 2021)", "(Vigência)", "(Redação dada pela Lei
 * nº X)", "(Incluído pela Medida Provisória nº Y)". São metadados de
 * publicação, não texto da lei, e no corpo do artigo quebram a leitura.
 *
 * Fica de fora deste corte o "(VETADO)", que é parte do texto oficial e tem
 * tratamento próprio em EmentaParagraph.
 */
const MARCADOR_TRAMITACAO =
  /\s*\((?:Vide|Vigência|Redação dada|Incluído|Incluída|Revogado|Revogada|Renumerado)[^)]*\)/gi;

/** "Vigência" solto, sem parênteses, como aparece depois de alguns "(Vide …)". */
const VIGENCIA_SOLTA = /\s+Vigência\b/g;

/**
 * Garante que cada inciso, alínea e parágrafo começa em linha nova.
 * Não destrói formatação que já existe.
 */
export function normalizeEmenta(raw: string): string {
  let text = raw;

  // 0. Remove sufixo ALL CAPS de capítulo que vazou do scrape
  text = stripTrailingChapterJunk(text);

  // 0.1. Remove os marcadores de tramitação do corpo do artigo
  text = text.replace(MARCADOR_TRAMITACAO, '').replace(VIGENCIA_SOLTA, '');

  // 1. Antes de cada inciso romano "I - ", "II - ", etc., garantir \n\n
  //    (a menos que já esteja precedido por \n)
  text = text.replace(ROMAN_INCISO, (match, roman) => `\n\n${roman} — `);

  // 2. Antes de alíneas "a) ", "b) ", etc., garantir \n
  text = text.replace(ALINEA, (match, letter) => `\n${letter}) `);

  // 3. Antes de parágrafos "§ 1º", "§ 2º", etc., garantir \n\n
  text = text.replace(PARAGRAFO, (match, num) => `\n\n§ ${num}`);

  // 4. Antes de "Parágrafo único." colado no caput/inciso, garantir \n\n
  text = text.replace(PARAGRAFO_UNICO, '\n\nParágrafo único. ');

  // 5. Colapsar 3+ \n em 2
  text = text.replace(/\n{3,}/g, '\n\n');

  // 6. Trim cada linha
  text = text
    .split('\n')
    .map((line) => line.trim())
    .join('\n');

  return text.trim();
}

/**
 * Remove sufixos ALL CAPS no fim da ementa que são títulos de capítulo
 * que vazaram do scrape (ex: "...artigo. DOS PRINCÍPIOS").
 *
 * Aplica até duas vezes pra cobrir casos onde dois títulos foram concatenados
 * (ex: "DAS IRREGULARIDADES DAS INFRAÇÕES E SANÇÕES ADMINISTRATIVAS" →
 * o regex casa o todo, mas se ainda restar algo, roda de novo).
 */
function stripTrailingChapterJunk(text: string): string {
  let cleaned = text.trimEnd();
  for (let i = 0; i < 2; i++) {
    const m = cleaned.match(TRAILING_CHAPTER_JUNK);
    if (!m) break;
    // Mantém o caractere de pontuação (`.`, `;` etc) e remove o resto
    const punct = cleaned.charAt(cleaned.length - m[0].length);
    cleaned = cleaned.slice(0, cleaned.length - m[0].length) + punct;
    cleaned = cleaned.trimEnd();
  }
  return cleaned;
}

/**
 * Heurística para detectar se a ementa foi truncada no meio (dataset
 * incompleto). Termina sem ponto final + termina em palavra de continuação?
 */
export function isLikelyTruncated(text: string): boolean {
  const cleaned = text.trim();
  if (cleaned.length < 50) return false;
  const last = cleaned.slice(-30).toLowerCase();

  // Termina com pontuação final clara — não truncado
  if (/[.!?][\s)\]"']*$/.test(cleaned)) return false;

  // Termina com pontuação intermediária ou palavra solta — provável trunc
  const continuationPatterns = [
    /\bdo\s*$/,
    /\bda\s*$/,
    /\bno\s*$/,
    /\bna\s*$/,
    /\be\s*$/,
    /\bou\s*$/,
    /\bque\s*$/,
    /\bem\s*$/,
    /,\s*$/,
    /:\s*$/,
    /;\s*$/,
    /-\s*$/,
  ];
  return continuationPatterns.some((p) => p.test(last));
}

/**
 * Remove o prefixo "Art. Nº" / "Art. N-A" / "Art. Nº" do início.
 */
export function stripArticlePrefix(text: string): string {
  return text.replace(/^Art\.\s+\d+(-[A-Z])?\s*[ºo°]?\s*\.?\s*/i, '').trim();
}
