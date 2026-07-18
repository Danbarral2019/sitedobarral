/**
 * Extrai citações a acórdãos do TCU ("Acórdão N/AAAA") de texto livre —
 * determinístico, sem LLM, custo zero. Módulo PURO (texto → citações), sem banco
 * nem rede: serve ao probe (Fase 0) e depois ao núcleo de catalogação (Fase 1)
 * sem divergir. Espelha o padrão de lib/lei-14133/citation-extractor.ts.
 *
 * NÃO filtra auto-citação — o extrator não sabe qual é o próprio acórdão. Isso é
 * responsabilidade do consumidor, que conhece o número do documento.
 */

export interface AcordaoCitation {
  /** Número do acórdão citado, sem pontos de milhar (4851). */
  numero: number;
  /** Ano com 4 dígitos (2017). */
  ano: number;
  /** Colegiado canônico, se explícito na citação; senão null. */
  colegiado: string | null;
  /** Trecho casado, para exibição/depuração. */
  raw: string;
  /** Offset da citação no texto — para atribuir a seção via secaoDe(). */
  index: number;
}

/** Sufixo opcional de colegiado: "-Plenário", "- 2ª Câmara", "-TCU-Plenário". */
const COLEG =
  '(?:\\s*[-–—]\\s*(?:tcu\\s*[-–—]\\s*)?(plen[áa]rio|primeira\\s+c[âa]mara|segunda\\s+c[âa]mara|1[ªa]\\.?\\s*c[âa]mara|2[ªa]\\.?\\s*c[âa]mara))?';

/**
 * "Acórdão 4851/2017", "Acórdão nº 4.851/2017-Plenário", "AC 1234/2020-TCU-Plenário".
 * Exige "/AAAA" logo após o número: "acórdão recorrido"/"o presente acórdão"
 * (sem número) não casam.
 */
const AC_RE = new RegExp(
  '\\b(?:ac[óo]rd[ãa]os?|ac\\.?)\\s+(?:n[.ºo°]*\\s*)?(\\d[\\d.]*)\\s*\\/\\s*(\\d{4})' + COLEG,
  'gi'
);

/** Cauda de lista: ", 2/2021", " e 3/2022" logo após "Acórdãos 1/2020...". */
const AC_LISTA_RE = new RegExp(
  '^(?:\\s*,|\\s*e\\b)\\s*(\\d[\\d.]*)\\s*\\/\\s*(\\d{4})' + COLEG,
  'i'
);

function canonColegiado(raw: string | undefined): string | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s.startsWith('plen')) return 'Plenário';
  if (s.startsWith('1') || s.startsWith('prim')) return 'Primeira Câmara';
  if (s.startsWith('2') || s.startsWith('seg')) return 'Segunda Câmara';
  return null;
}

function toNumero(raw: string): number {
  return parseInt(raw.replace(/\./g, ''), 10);
}

export function extractAcordaoCitations(text: string): AcordaoCitation[] {
  const out: AcordaoCitation[] = [];
  if (!text) return out;

  const re = new RegExp(AC_RE.source, AC_RE.flags);
  let m: RegExpExecArray | null;

  const push = (
    numRaw: string,
    anoRaw: string,
    coleg: string | undefined,
    index: number,
    raw: string
  ) => {
    const numero = toNumero(numRaw);
    const ano = parseInt(anoRaw, 10);
    if (!Number.isFinite(numero) || numero <= 0) return;
    if (ano < 1990 || ano > 2100) return;
    out.push({ numero, ano, colegiado: canonColegiado(coleg), raw: raw.trim(), index });
  };

  while ((m = re.exec(text)) !== null) {
    push(m[1], m[2], m[3], m.index, m[0]);

    // "Acórdãos 1/2020, 2/2021 e 3/2022": os subsequentes não têm "Acórdão"
    // antes; o regex principal não os alcança. Consome a cauda aqui.
    let pos = m.index + m[0].length;
    for (;;) {
      const lm = AC_LISTA_RE.exec(text.slice(pos));
      if (!lm) break;
      push(lm[1], lm[2], lm[3], pos, lm[0]);
      pos += lm[0].length;
    }
    re.lastIndex = pos; // não reprocessa o que a lista já consumiu
  }
  return out;
}
