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
 * Garante que cada inciso, alínea e parágrafo começa em linha nova.
 * Não destrói formatação que já existe.
 */
export function normalizeEmenta(raw: string): string {
  let text = raw;

  // 0. Remove sufixo ALL CAPS de capítulo que vazou do scrape
  text = stripTrailingChapterJunk(text);

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

// ──────────────────────────────────────────────────────────────────────────
// Redações e entulho do Planalto
// ──────────────────────────────────────────────────────────────────────────

/**
 * Marcadores que a página do Planalto intercala no corpo do artigo e que não
 * são texto de lei. No art. 75 chegam a aparecer quatro vezes seguidas dentro
 * de um único inciso, no meio da frase.
 *
 * `(Redação dada|Incluído|Revogado)` NÃO entra aqui de propósito: dizer qual
 * lei fixou a redação é informação, e o público confere antes de citar.
 */
// O marcador de vigência aparece nas três formas na mesma página: entre
// parênteses, solto depois de um Vide, e solto antes do próximo Vide.
const ENTULHO =
  /\s*\((?:Vide[^)]*|Regulamento|Vig[êe]ncia)\)|\s*(?<=\))\s*Vig[êe]ncia\b|\s*\bVig[êe]ncia\b(?=\s*\()/g;

/** Nota de alteração — a prova de que uma redação superou outra. */
const NOTA_ALTERACAO = /\((?:Reda[çc][ãa]o dada|Inclu[íi]d[oa]|Revogad[oa])[^)]*\)/;

/** Marcador de item de lista no início da linha, já normalizada. */
const MARCADOR_LINHA = /^((?:[IVXLCDM]{1,6})\s+—|§\s*\d+\s*[ºo°]?|Parágrafo único)/;

/**
 * Tira do texto o entulho da página do Planalto, preservando a atribuição de
 * redação.
 */
export function limparBoilerplate(texto: string): string {
  return texto
    .replace(ENTULHO, '')
    .replace(/[^\S\n]{2,}/g, ' ')
    .replace(/\s+([,;.])/g, '$1')
    .trim();
}

export interface RedacaoAnterior {
  /** "XVI", "§ 6º" — o item a que a redação se refere. */
  marcador: string;
  texto: string;
  /** "Redação dada pela Medida Provisória nº 1.166, de 2023", quando houver. */
  fonte: string | null;
}

export interface EmentaSeparada {
  /** Texto a exibir no corpo do artigo. */
  vigente: string;
  /** Redações superadas, para exibir recolhidas — nunca descartadas. */
  anteriores: RedacaoAnterior[];
}

/**
 * Separa a redação vigente das anteriores quando o scrape empilhou o histórico.
 *
 * A página do Planalto mostra, para um mesmo inciso, a redação original e cada
 * alteração. O scrape achatou isso numa sequência: no art. 75 o inciso XVI
 * aparece três vezes seguidas, em redações diferentes, e o leitor não tem como
 * saber qual vale.
 *
 * A regra é deliberadamente conservadora: só recolhe quando ao menos um dos
 * blocos repetidos traz nota de alteração — a prova de que houve mudança. Sem
 * nota, o texto fica exatamente como está, porque esconder seria adivinhar, e
 * apresentar redação revogada como vigente é o erro mais caro possível para
 * quem lê isto antes de citar.
 *
 * Só considera repetição ADJACENTE. Artigo cujo `§` tem lista própria repete
 * `I, II, III` legitimamente, e ali as ocorrências não são vizinhas.
 */
export function separarRedacoes(normalizado: string): EmentaSeparada {
  const blocos = normalizado.split('\n\n');
  // O travessão sai do rótulo: "XVI", não "XVI —". Ele serve para agrupar e
  // para rotular a redação anterior na interface.
  const marcadorDe = (b: string) =>
    b.match(MARCADOR_LINHA)?.[1].replace(/\s+/g, ' ').replace(/\s*—$/, '').trim() ?? null;

  const anteriores: RedacaoAnterior[] = [];
  const mantidos: string[] = [];

  for (let i = 0; i < blocos.length; ) {
    const marcador = marcadorDe(blocos[i]);
    if (!marcador) {
      mantidos.push(blocos[i]);
      i++;
      continue;
    }

    // Junta a corrida de blocos vizinhos com o mesmo marcador.
    let fim = i;
    while (fim + 1 < blocos.length && marcadorDe(blocos[fim + 1]) === marcador) fim++;
    const corrida = blocos.slice(i, fim + 1);

    const temProva = corrida.some((b) => NOTA_ALTERACAO.test(b));
    if (corrida.length > 1 && temProva) {
      for (const superado of corrida.slice(0, -1)) {
        anteriores.push({
          marcador,
          texto: limparBoilerplate(superado.replace(NOTA_ALTERACAO, '')),
          fonte: superado.match(NOTA_ALTERACAO)?.[0].slice(1, -1) ?? null,
        });
      }
      mantidos.push(corrida[corrida.length - 1]);
    } else {
      mantidos.push(...corrida);
    }

    i = fim + 1;
  }

  return { vigente: mantidos.join('\n\n'), anteriores };
}

/**
 * Remove o prefixo "Art. Nº" / "Art. N-A" / "Art. Nº" do início.
 */
export function stripArticlePrefix(text: string): string {
  return text.replace(/^Art\.\s+\d+(-[A-Z])?\s*[ºo°]?\s*\.?\s*/i, '').trim();
}
