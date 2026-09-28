/**
 * Extração da ementa oficial a partir do texto de um ato normativo.
 *
 * Motivação: o clipping do DOU gravava como ementa o `abstract` da busca do
 * in.gov.br, que é só o começo do corpo do ato, cortado em ponto arbitrário
 * ("MEDIDA PROVISÓRIA Nº 1.303, DE ... Dispõe sobre ... O PRESIDENTE DA
 * REPÚBLICA, no uso da atribuição ... Art. 1º ..."). A ementa real é o trecho
 * entre a epígrafe e o preâmbulo; é isso que este módulo recorta.
 */

/** Epígrafe: "MEDIDA PROVISÓRIA Nº 1.303, DE 11 DE JUNHO DE 2025", "PORTARIA SEGES/MGI Nº 8, DE 3 DE MAIO DE 2026". */
const EPIGRAFE_RE =
  /\b(?:MEDIDA\s+PROVIS[ÓO]RIA|LEI(?:\s+COMPLEMENTAR)?|DECRETO(?:-LEI)?|PORTARIA|INSTRU[ÇC][ÃA]O\s+NORMATIVA|RESOLU[ÇC][ÃA]O|ORDEM\s+DE\s+SERVI[ÇC]O|ORIENTA[ÇC][ÃA]O\s+NORMATIVA)\b[^\n]{0,120}?\bN[ºo°.]?\s*[\d.\/-]+\s*,?\s+DE\s+\d{1,2}[ºo°]?\s+DE\s+[A-ZÇa-zç]+\s+DE\s+\d{4}\.?/;

/**
 * Início do preâmbulo (ou, na falta dele, do articulado). Case-sensitive: o
 * preâmbulo vem em caixa alta ("O PRESIDENTE DA REPÚBLICA", "A SECRETÁRIA DE
 * GESTÃO..."), a ementa não.
 */
const PREAMBULO_RES: RegExp[] = [
  /\b(?:O|A)\s+(?:VICE-)?PRESIDENT[EA]\s+DA\s+REP[ÚU]BLICA\b/,
  /\bO\s+CONGRESSO\s+NACIONAL\b/,
  /\bFa[çc]o\s+saber\b/,
  // "O SECRETÁRIO DE GESTÃO E INOVAÇÃO DO MINISTÉRIO ..., no uso das atribuições"
  /\b(?:O|A|OS|AS)\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ-]{3,}(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç\-/,()ºª°]+){0,40}?\s*,?\s+(?:no\s+uso|tendo\s+em\s+vista|com\s+fundamento|considerando|resolve|decreta)\b/,
  /\bArt\.?\s*1[ºo°]?\s/,
];

/**
 * Anotações que o Planalto põe entre a epígrafe e a ementa (links laterais):
 * "Exposição de motivos", "Vigência", "Produção de efeitos", "(Vide ...)".
 */
const ANOTACAO_INICIAL_RE =
  /^(?:Exposi[çc][ãa]o\s+de\s+motivos|Mensagem\s+de\s+veto|Vig[êe]ncia(?:\s+encerrada)?|Produ[çc][ãa]o\s+de\s+efeitos?|Texto\s+compilado|Convers[ãa]o(?:\s+na\s+Lei[^A-Z]{0,40}\d{4})?|Convertid[ao]\s+na\s+Lei[^A-Z]{0,40}\d{4}|Regulamento|Promulga[çc][ãa]o\s+partes\s+vetadas|\([^)]{0,200}\))[\s.;,]*/i;

export interface EmentaExtraction {
  /** Ementa recortada (whitespace colapsado). */
  ementa: string;
  /** true quando o recorte terminou num preâmbulo/art. 1º (não é trecho truncado). */
  complete: boolean;
}

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Recorta a ementa de um texto que contenha epígrafe + ementa + preâmbulo.
 * Retorna null quando não há ementa plausível (vazia, curta demais, fragmento
 * de artigo).
 */
export function extractEmenta(rawText: string | null | undefined): EmentaExtraction | null {
  if (!rawText) return null;
  const text = collapse(rawText);

  const epigrafe = EPIGRAFE_RE.exec(text);
  let rest = epigrafe ? text.slice(epigrafe.index + epigrafe[0].length) : text;
  rest = rest.trim();

  // Remove anotações laterais que precedem a ementa.
  for (let i = 0; i < 10; i++) {
    const m = ANOTACAO_INICIAL_RE.exec(rest);
    if (!m || m[0].length === 0) break;
    rest = rest.slice(m[0].length).trim();
  }

  let end = -1;
  for (const re of PREAMBULO_RES) {
    const m = re.exec(rest);
    if (m && (end === -1 || m.index < end)) end = m.index;
  }

  const complete = end > 0;
  let ementa = (complete ? rest.slice(0, end) : rest).trim();
  // Links laterais do gov.br ("• Perguntas e Respostas • Apresentação da IN")
  // grudam no fim da ementa quando o texto é achatado.
  ementa = ementa.split(/\s•\s/)[0].trim();
  // Reticências de trecho truncado não fazem parte da ementa.
  ementa = ementa.replace(/\s*(?:\.{3,}|…)\s*$/, '').trim();

  if (ementa.length < 25) return null;
  if (/^Art\.?\s*\d/.test(ementa)) return null;
  // Sem epígrafe e sem preâmbulo não há como saber onde a ementa começa/termina.
  if (!epigrafe && !complete) return null;
  // Sem epígrafe, o texto pode começar no meio da ementa (texto integral
  // truncado: "Lei nº 14.690, de 3 de outubro de 2023, para instituir...")
  // ou na própria epígrafe em caixa mista ("Portaria SGD/MGI nº 3.656, de...").
  // Ementa começa com verbo em maiúscula, nunca com minúscula nem com o nome
  // de um ato.
  if (!epigrafe && /^(?:[a-zà-ú]|Leis?\b|Decretos?\b|Medidas?\s+Provis|Portarias?\b|Instru[çc]|Resolu[çc])/.test(ementa)) {
    return null;
  }

  return { ementa, complete };
}

/**
 * Indica se a ementa gravada tem cara de trecho do corpo do ato (o `abstract`
 * da busca do DOU) em vez da ementa oficial: contém epígrafe, preâmbulo ou
 * art. 1º, termina em reticências, ou é só o título repetido.
 */
export function looksLikeDefectiveEmenta(
  ementa: string | null | undefined,
  title?: string | null,
): boolean {
  if (!ementa) return true;
  const e = collapse(ementa);
  if (e.length < 25) return true;
  if (title && collapse(title).toLowerCase() === e.toLowerCase()) return true;
  if (EPIGRAFE_RE.test(e)) return true;
  if (/(?:\.{3,}|…)$/.test(e)) return true;
  return PREAMBULO_RES.some((re) => re.test(e));
}

/**
 * Indica se o texto integral abre com a epígrafe do ato numa linha própria
 * ("MEDIDA PROVISÓRIA Nº 1.393, DE 25 DE SETEMBRO DE 2026"), em qualquer caixa.
 * Texto do DOU que não abre assim foi truncado no download (a versão antiga de
 * `stripDouBoilerplate` cortava no primeiro "Lei" da ementa).
 */
export function startsWithEpigrafe(content: string | null | undefined): boolean {
  if (!content) return false;
  const firstLine = content.trim().split('\n')[0].trim();
  return /^(?:medida\s+provis[óo]ria|lei(?:\s+complementar)?|decreto(?:-lei)?|portaria|instru[çc][ãa]o\s+normativa|resolu[çc][ãa]o|ordem\s+de\s+servi[çc]o|orienta[çc][ãa]o\s+normativa)\b[^\n]*?\bn[ºo°.]?\s*[\d.\/-]+\s*,?\s+de\s+\d{1,2}[ºo°]?\s+de\s+[a-zç]+\s+de\s+\d{4}\.?\s*(?:\([^)]*\))?\s*$/i.test(
    firstLine,
  );
}
