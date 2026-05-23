/**
 * Parser do "Livro de Súmulas, OJs e PNs do TST" (Res. 225/2025, versão RTF).
 *
 * Estrutura típica de um bloco no livro:
 *
 *   SUM-1\tPRAZO JUDICIAL (mantida) – Res. 121/2003, DJ 19, 20 e 21.11.2003
 *   Quando a intimação tiver lugar na sexta-feira, ou a publicação com efeito...
 *   Histórico:
 *   Redação original - RA 28/1969, DO-GB 21.08.1969
 *
 * O parser:
 *   1. Quebra o texto em blocos pelo cabeçalho `<PREFIX>-<N>` no início de linha.
 *   2. Para cada bloco, separa cabeçalho → tese → histórico.
 *   3. Detecta a situação canônica do parêntese inline ("mantida" / "cancelada" /
 *      "alterada" / "nova redação" / etc.).
 *   4. Quando a tese tem itens romanos (I, II, III…), extrai cada um com flag
 *      de cancelamento individual.
 *   5. Extrai resoluções (Res. NNN/AAAA) e refs cruzadas (Lei 14.133, CLT).
 */

import type {
  TstLivroBlock,
  TstLivroSerie,
  TstLivroSituacao,
  TstLivroResolucao,
  TstLivroItem,
  TstLivroHistoricoEntrada,
} from './types-livro';

const PREFIX_TO_SERIE: Record<string, TstLivroSerie> = {
  SUM: 'sumula',
  'OJ-TP/OE': 'oj-tp-oe',
  'OJ-SDI1T': 'oj-sdi1t', // testar ANTES de OJ-SDI1 (prefix mais longo)
  'OJ-SDI1': 'oj-sdi1',
  'OJ-SDI2': 'oj-sdi2',
  'OJ-SDC': 'oj-sdc',
  PN: 'pn',
};

const PREFIX_ORDER = ['OJ-SDI1T', 'OJ-SDI1', 'OJ-SDI2', 'OJ-SDC', 'OJ-TP/OE', 'SUM', 'PN'];

// Regex que casa TODOS os cabeçalhos no início de linha. Captura o prefixo e
// o número. O lookahead garante boundary (TAB, espaço, fim de linha).
const HEADER_RE =
  /^(SUM|OJ-TP\/OE|OJ-SDI1T|OJ-SDI1|OJ-SDI2|OJ-SDC|PN)-(\d+)(?=\s|\t|$)/m;

const HEADER_RE_GLOBAL =
  /^(SUM|OJ-TP\/OE|OJ-SDI1T|OJ-SDI1|OJ-SDI2|OJ-SDC|PN)-(\d+)(?=\s|\t|$)/gm;

/**
 * Quebra o texto plano do livro em blocos por documento. Cada chave do Map é
 * o rótulo completo (ex.: "SUM-1", "OJ-SDI1-31") apontando para o bloco
 * íntegro até o próximo cabeçalho.
 *
 * Quando um cabeçalho aparece múltiplas vezes (raro — pode acontecer se a
 * referência interna estiver no início de linha por quebra do RTF), mantém
 * apenas o bloco MAIS LONGO (heurística: o real é sempre o mais rico).
 */
export function splitLivroBlocks(rawText: string): Map<string, string> {
  const matches: Array<{ rotulo: string; start: number }> = [];
  let m: RegExpExecArray | null;
  // Reset lastIndex e itera
  HEADER_RE_GLOBAL.lastIndex = 0;
  while ((m = HEADER_RE_GLOBAL.exec(rawText)) !== null) {
    matches.push({ rotulo: `${m[1]}-${m[2]}`, start: m.index });
  }

  const out = new Map<string, string>();
  for (let i = 0; i < matches.length; i++) {
    const { rotulo, start } = matches[i];
    const end = i + 1 < matches.length ? matches[i + 1].start : rawText.length;
    const block = rawText.slice(start, end).trimEnd();
    const existing = out.get(rotulo);
    // Mantém o bloco mais longo (real vs referência cruzada interna)
    if (!existing || block.length > existing.length) {
      out.set(rotulo, block);
    }
  }
  return out;
}

function parsePrefix(rotulo: string): { prefix: string; numero: number } {
  // Encontra o prefixo conhecido mais longo que prefixa `rotulo`.
  for (const p of PREFIX_ORDER) {
    if (rotulo.startsWith(`${p}-`)) {
      const n = Number(rotulo.slice(p.length + 1));
      return { prefix: p, numero: n };
    }
  }
  throw new Error(`prefixo desconhecido em rotulo=${rotulo}`);
}

/**
 * Detecta a situação canônica olhando o cabeçalho do bloco. O cabeçalho
 * normalmente tem o status entre parênteses: "(mantida)", "(cancelada)",
 * "(alterada)", "(nova redação)", "(itens I, II cancelados ...)" etc.
 */
function detectSituacao(cabecalho: string): {
  situacao: TstLivroSituacao;
  motivo: string | null;
} {
  // Pegamos o primeiro parêntese significativo (pulando refs a leis, CLT etc.)
  const parens = [...cabecalho.matchAll(/\(([^()]+)\)/g)].map((m) => m[1]);
  for (const p of parens) {
    const low = p.toLowerCase();
    // Cancelamento (singular ou plural: cancelado/cancelada/cancelados/canceladas).
    if (/\bcancelad[ao]s?\b|\bcancelament/.test(low)) {
      // "Item I cancelado" significa que a súmula como um todo foi ALTERADA
      // (apenas alguns itens estão cancelados). Quando o documento INTEIRO foi
      // cancelado, o token costuma vir sem qualificadores tipo "item" /
      // "alínea" / "inciso".
      // NOTA: `itens?` em regex significa "iten" + opcional "s" — NÃO casa
      // "item". Usamos alternativas explícitas para evitar essa armadilha.
      if (/\b(?:item|itens|al[ií]nea|al[ií]neas|inciso|incisos|par[áa]grafo|par[áa]grafos)\b/.test(low)) {
        return { situacao: 'ALTERADA', motivo: p.trim() };
      }
      return { situacao: 'CANCELADA', motivo: p.trim() };
    }
    if (/\brevist[ao]s?\b|\brevis[ãa]o\b/.test(low)) {
      return { situacao: 'REVISTA', motivo: p.trim() };
    }
    if (
      /\balterad[ao]s?\b|\bnova\s+reda[çc][ãa]o\b|\breda[çc][ãa]o\s+alterada\b|\binserid[ao]s?\s+dispositivo\b|\breda[çc][ãa]o\s+do\s+item|\baltera[çc][ãa]o\b|\bincorporad[ao]s?\b/i.test(
        p,
      )
    ) {
      return { situacao: 'ALTERADA', motivo: p.trim() };
    }
    if (/\bmantid[ao]s?\b/.test(low)) {
      return { situacao: 'CRIADA', motivo: p.trim() };
    }
  }
  // Sem indicação explícita — assume CRIADA (default conservador).
  return { situacao: 'CRIADA', motivo: null };
}

function parseResolucoes(text: string): TstLivroResolucao[] {
  const out: TstLivroResolucao[] = [];
  const re =
    /Res\.\s*(\d+)\/(\d{4})(?:[,\s]+(DJ|DEJT|RA)\s*(?:divulgad[oa]\s+em\s+)?([0-9.,º\s\-]+?))?(?=\s*(?:[-,;.)<]|Res\.|$|Histórico|\n))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({
      numero: `${m[1]}/${m[2]}`,
      ano: Number(m[2]),
      tipo: m[3] ?? null,
      divulgadoEm: m[4]?.trim().replace(/\s+/g, ' ') ?? null,
    });
  }
  return out;
}

function parseItensRomanos(corpo: string): TstLivroItem[] {
  // Itens começam em nova linha com "I -", "II –", etc.
  // RTF do TST usa tanto hífen ASCII (-) quanto en dash (–, U+2013) e
  // ocasionalmente em dash (—, U+2014). Aceitamos os 3.
  const itemRe =
    /(?:^|\n)\s*(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX)\s+[-–—]\s+/g;
  const starts: Array<{ ordem: string; idx: number; afterDash: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(corpo)) !== null) {
    const matchStart = m.index + (m[0].startsWith('\n') ? 1 : 0);
    starts.push({
      ordem: m[1],
      idx: matchStart,
      afterDash: m.index + m[0].length,
    });
  }
  if (starts.length === 0) return [];

  const itens: TstLivroItem[] = [];
  for (let i = 0; i < starts.length; i++) {
    const { ordem, afterDash } = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1].idx : corpo.length;
    const texto = corpo.slice(afterDash, end).trim().replace(/\s+/g, ' ');
    // Cancelamento detectado quando o item contém um parêntese com palavra de
    // cancelamento ("cancelado", "perda de eficácia", "Lei 13.467/2017"…). O
    // parêntese costuma vir perto do fim do item (antes da resolução "Res.
    // 225/2025"), mas pode haver texto após — por isso não exigimos $.
    const cancelMatch = /\(([^()]*\b(?:cancelad[ao]|perda\s+de\s+efic[áa]cia|13\.467\/2017)[^()]*)\)/i.exec(
      texto,
    );
    itens.push({
      ordem,
      texto,
      cancelled: cancelMatch !== null,
      cancelMotivo: cancelMatch ? cancelMatch[1].trim() : undefined,
    });
  }
  return itens;
}

function parseHistorico(historicoRaw: string): TstLivroHistoricoEntrada[] {
  // Cada entrada é uma linha ou um trecho separado por dupla quebra de linha.
  return historicoRaw
    .split(/\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5 && !/^Histórico:?$/i.test(s))
    .map((texto) => ({ texto }));
}

function extractLeiArticles(text: string): string[] {
  const found = new Set<string>();
  const re = /Lei\s*(?:nº|n\.º|n°)?\s*14\.?133[^.]*?art\.\s*(\d{1,3})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    found.add(m[1]);
  }
  return Array.from(found).sort((a, b) => Number(a) - Number(b));
}

function extractCltArticles(text: string): string[] {
  const found = new Set<string>();
  const re = /art\.\s*(\d{1,4}(?:-[A-Z])?)(?:[^.]*?da\s+CLT)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    found.add(m[1]);
  }
  return Array.from(found).sort((a, b) => {
    const na = parseInt(a, 10);
    const nb = parseInt(b, 10);
    if (na === nb) return a.localeCompare(b);
    return na - nb;
  });
}

/**
 * Parseia UM bloco do livro. `rawBlock` é o trecho desde o cabeçalho
 * `PREFIX-N` até (exclusivo) o próximo cabeçalho.
 */
export function parseLivroBlock(rawBlock: string, url: string | null = null): TstLivroBlock {
  // 1) Cabeçalho = primeira linha
  const firstNewline = rawBlock.indexOf('\n');
  const headerLine =
    firstNewline >= 0 ? rawBlock.slice(0, firstNewline) : rawBlock;
  const rest = firstNewline >= 0 ? rawBlock.slice(firstNewline + 1) : '';

  // 2) Identificador
  const headerMatch = HEADER_RE.exec(headerLine);
  if (!headerMatch) {
    throw new Error(
      `bloco sem cabeçalho válido: ${rawBlock.slice(0, 100)}`,
    );
  }
  const prefix = headerMatch[1];
  const numero = Number(headerMatch[2]);
  const rotulo = `${prefix}-${numero}`;
  const serie = PREFIX_TO_SERIE[prefix];

  // 3) Título: tudo entre o número e a primeira ocorrência de "(" ou " – Res."
  const afterRotulo = headerLine.slice(headerMatch[0].length).replace(/^\s*\t*\s*/, '');
  let titulo = afterRotulo;
  const cutAt = (() => {
    const parenIdx = afterRotulo.indexOf('(');
    const dashIdx = afterRotulo.search(/\s[–\-]\s*Res\./);
    const candidates = [parenIdx, dashIdx].filter((i) => i >= 0);
    return candidates.length ? Math.min(...candidates) : -1;
  })();
  if (cutAt > 0) titulo = afterRotulo.slice(0, cutAt).trim();
  titulo = titulo.replace(/[\s ]+/g, ' ').trim();

  // 4) Situação canônica
  const { situacao, motivo: situacaoMotivo } = detectSituacao(headerLine);

  // 5) Corpo: texto após cabeçalho, antes de "Histórico:" se houver
  const histIdx = rest.search(/^\s*Histórico:?/m);
  const corpoRaw = histIdx >= 0 ? rest.slice(0, histIdx) : rest;
  const historicoRaw = histIdx >= 0 ? rest.slice(histIdx).replace(/^[^\n]*\n/, '') : '';

  // Tese = corpo "limpo" (sem TABs estranhos)
  const tese = corpoRaw
    .replace(/\t+/g, ' ')
    .replace(/ /g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .trim();

  // 6) Itens romanos (se houver)
  const itens = parseItensRomanos(tese);

  // 7) Resoluções
  const resolucoes = parseResolucoes(headerLine + '\n' + corpoRaw);

  // 8) Histórico
  const historico = parseHistorico(historicoRaw);

  // 9) Refs cruzadas
  const scan = `${headerLine}\n${tese}`;
  const leiArticles = extractLeiArticles(scan);
  const cltArticles = extractCltArticles(scan);

  return {
    serie,
    numero,
    rotulo,
    titulo,
    cabecalhoCompleto: headerLine.replace(/\s+/g, ' ').trim(),
    situacao,
    situacaoMotivo,
    tese,
    itens,
    resolucoes,
    historico,
    url,
    leiArticles,
    cltArticles,
    rawBlock,
  };
}

/**
 * Parseia o texto inteiro do livro: split + parseLivroBlock para cada um.
 */
export function parseLivroText(
  rawText: string,
  urls: Map<string, string> = new Map(),
): TstLivroBlock[] {
  const blocks = splitLivroBlocks(rawText);
  const out: TstLivroBlock[] = [];
  for (const [rotulo, block] of blocks) {
    const url = urls.get(rotulo) ?? null;
    out.push(parseLivroBlock(block, url));
  }
  // Ordena: SUM → OJ-TP/OE → OJ-SDI1 → OJ-SDI1T → OJ-SDI2 → OJ-SDC → PN, dentro por número
  const serieOrder: TstLivroSerie[] = [
    'sumula',
    'oj-tp-oe',
    'oj-sdi1',
    'oj-sdi1t',
    'oj-sdi2',
    'oj-sdc',
    'pn',
  ];
  out.sort((a, b) => {
    const sa = serieOrder.indexOf(a.serie);
    const sb = serieOrder.indexOf(b.serie);
    if (sa !== sb) return sa - sb;
    return a.numero - b.numero;
  });
  return out;
}
