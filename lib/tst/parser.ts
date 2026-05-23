import type {
  TstSumulaParsed,
  TstSumulaItem,
  TstSumulaIrr,
  TstSumulaResolucao,
  TstSumulaSituacao,
} from './types';

const ROMAN_RE = /^(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX)\s+-\s+/;
const ROMAN_AT_START = /^(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX)\s+-\s+/m;

const SITUACAO_VALUES: ReadonlySet<TstSumulaSituacao> = new Set([
  'CRIADA',
  'ALTERADA',
  'CANCELADA',
  'REVISTA',
]);

function normalizeWhitespace(s: string): string {
  return (
    s
      // Remove caracteres de controle invalidos no Postgres (NUL, BEL, etc.)
      // que quebram inserts em colunas text/varchar do utf8.
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
      // Espacos nao-quebraveis viram espaco normal
      .replace(/[ ​]/g, ' ')
      .replace(/\r\n?/g, '\n')
  );
}

function collapseSoftWraps(s: string): string {
  // Junta quebras de linha "soltas" dentro de um parágrafo, preservando quebras
  // antes de marcadores fortes (itens romanos no início da linha, Observação,
  // Tese, Situação) e linhas em branco.
  const lines = s.split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1] ?? '';
    const looksLikeItemStart = ROMAN_RE.test(next.trimStart());
    const looksLikeStrongToken =
      /^(Observação|Tese|Situação|Inteiro teor)\s*:/.test(next.trimStart());
    const blankBreak = line.trim() === '' || next.trim() === '';
    if (blankBreak || looksLikeItemStart || looksLikeStrongToken) {
      out.push(line);
    } else {
      // junta com a próxima
      lines[i + 1] = line.replace(/\s+$/, '') + ' ' + next.replace(/^\s+/, '');
    }
  }
  return out.join('\n').replace(/[ \t]+/g, ' ').replace(/ \n/g, '\n');
}

/**
 * Quebra o texto plano do PDF em blocos por súmula. Retorna mapa numero→bloco
 * (texto bruto do bloco, sem normalização).
 */
export function splitIntoSumulaBlocks(rawText: string): Map<number, string> {
  const text = normalizeWhitespace(rawText);
  const re = /^Súmula\s+nº\s+(\d+)\s+do\s+TST\s*$/gm;
  const matches: Array<{ numero: number; start: number; headerEnd: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    matches.push({
      numero: Number(m[1]),
      start: m.index,
      headerEnd: m.index + m[0].length,
    });
  }
  const out = new Map<number, string>();
  for (let i = 0; i < matches.length; i++) {
    const { numero, start } = matches[i];
    const end = i + 1 < matches.length ? matches[i + 1].start : text.length;
    out.set(numero, text.slice(start, end).trim());
  }
  return out;
}

function findTokenIndex(s: string, token: string): number {
  // Aceita o token mesmo quando "colado" no fim de outra palavra (ex.: "...21.11.2003Tese:")
  const idx = s.indexOf(token);
  return idx;
}

function detectSituacao(block: string): {
  situacao: TstSumulaSituacao;
  motivo: string | null;
} {
  // O token "Situação:" aparece imediatamente antes do estado canônico (sempre em
  // UPPERCASE) — ex.: "Situação: CANCELADA", "Situação:\nCANCELADA". O motivo
  // textual fica no campo "Observação" (extraído separadamente).
  const re = /Situação:\s*([A-ZÁÉÍÓÚÊÔÇÃÕ]+)/;
  const m = block.match(re);
  if (m) {
    const val = m[1] as TstSumulaSituacao;
    if (SITUACAO_VALUES.has(val)) return { situacao: val, motivo: null };
  }
  // Fallback heurístico: PDF futuro pode introduzir "REVISTA" etc.
  if (/Situação:\s*REVISTA/i.test(block)) return { situacao: 'REVISTA', motivo: null };
  // Default conservador: CRIADA (não cancela nem altera nada)
  return { situacao: 'CRIADA', motivo: null };
}

function parseResolucoes(observacao: string): TstSumulaResolucao[] {
  // Padrões: "Res. 121/2003, DJ 19, 20 e 21.11.2003" / "Res. 225/2025, DEJT divulgado em 30.06, 01 e 02.07.2025"
  const out: TstSumulaResolucao[] = [];
  const re = /Res\.\s*(\d+)\/(\d{4})(?:[,\s]+(DJ|DEJT)\s*(?:divulgado\s+em\s+)?([0-9.,\sÀ-ú-]+?))?(?=\s*(?:[-,;.)<]|Res\.|Tese:|$))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(observacao)) !== null) {
    const numero = m[1];
    const ano = Number(m[2]);
    const tipo = m[3] ?? null;
    const divulgadoEm = m[4]?.trim().replace(/\s+/g, ' ') ?? null;
    out.push({ numero: `${numero}/${ano}`, ano, tipo, divulgadoEm });
  }
  return out;
}

function parseIrrs(observacao: string): TstSumulaIrr[] {
  // Bloco IRR no PDF: <b>Entendimento reafirmado no IRR nº NNN.<br>IRR-NNN TÍTULO...
  // (RR-XXXX, Tribunal Pleno, publicado em DD.MM.YYYY, rel. Min. NOME)</b><br>TESE.
  // Soft-wraps do PDF inserem quebras no meio de campos — normalizamos antes do match.
  const flat = observacao.replace(/\s+/g, ' ');
  const out: TstSumulaIrr[] = [];
  const re = /<b>\s*Entendimento\s+reafirmado\s+no\s+IRR\s+nº\s+(\d+)\.?\s*<br>\s*IRR-\d+\s+([^(<]*?)\s*\(\s*(RR-[\d.\-/]+)\s*,\s*([^,]+),\s*publicado\s+em\s+([\d.]+)\s*,\s*rel\.\s*([^)]+)\s*\)\s*<\/b>\s*<br>\s*([^<]*?)(?=Tese:|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(flat)) !== null) {
    out.push({
      numero: m[1],
      titulo: m[2].trim(),
      rrNumero: m[3],
      publicadoEm: m[5],
      relator: m[6].trim().replace(/\s+/g, ' '),
      tese: m[7].trim(),
    });
  }
  return out;
}

function parseItensRomanos(tese: string): TstSumulaItem[] {
  // Estratégia:
  // 1. Remove envelopes <s>...</s> mas registra os trechos cancelados em ranges.
  // 2. Acha posições onde uma linha começa com "I -", "II -", etc.
  // 3. Para cada item, extrai (ordem, texto). Item é cancelled se qualquer parte
  //    do seu texto sobrepunha um envelope <s>.
  // Caso a tese não tenha itens romanos, retorna [].
  if (!ROMAN_AT_START.test(tese)) return [];

  // Mapeia ranges de <s>
  const cancelRanges: Array<[number, number]> = [];
  const cleanParts: string[] = [];
  let cursor = 0;
  const tagRe = /<s>([\s\S]*?)<\/s>/g;
  let mm: RegExpExecArray | null;
  while ((mm = tagRe.exec(tese)) !== null) {
    cleanParts.push(tese.slice(cursor, mm.index));
    const innerStart = cleanParts.join('').length;
    cleanParts.push(mm[1]);
    const innerEnd = cleanParts.join('').length;
    cancelRanges.push([innerStart, innerEnd]);
    cursor = mm.index + mm[0].length;
  }
  cleanParts.push(tese.slice(cursor));
  const clean = cleanParts.join('');

  // Pré-normaliza inserindo quebra antes de cada "X - " (X romano) que tenha
  // fronteira semântica (início, ponto, parêntese de fechamento, dois-pontos,
  // ponto-e-vírgula). Isso captura itens consecutivos que o soft-wrap colou
  // numa mesma linha (ex.: "...autoridade competente.) II - Para efeito...").
  const cleanNorm = clean.replace(
    /([.)\];:]\s*)(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX)\s+-\s+/g,
    '$1\n$2 - ',
  );

  // Acha cada início de item romano (multiline)
  const itemStarts: Array<{ ordem: string; idx: number; afterDash: number }> = [];
  const itemRe = /(?:^|\n)\s*(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX)\s+-\s+/g;
  let im: RegExpExecArray | null;
  while ((im = itemRe.exec(cleanNorm)) !== null) {
    const ordem = im[1];
    // idx do "I" — pula o primeiro \n se houver
    const matchStart = im.index + (im[0].startsWith('\n') ? 1 : 0);
    const afterDash = im.index + im[0].length;
    itemStarts.push({ ordem, idx: matchStart, afterDash });
  }
  if (itemStarts.length === 0) return [];

  // Mapeia índices de cleanNorm → clean (cleanNorm pode ter '\n' extras
  // inseridos pelo replace). cancelRanges é em coords do `clean` original.
  // Para casar cada item ao seu range cancelled, usamos a substring do item em
  // clean: procura ocorrência única do padrão "ORDEM - <prefixo do texto>".
  const itens: TstSumulaItem[] = [];
  for (let i = 0; i < itemStarts.length; i++) {
    const { ordem, afterDash } = itemStarts[i];
    const end = i + 1 < itemStarts.length ? itemStarts[i + 1].idx : cleanNorm.length;
    const texto = cleanNorm
      .slice(afterDash, end)
      .trim()
      .replace(/\s+/g, ' ');
    // Para descobrir se cancelled, localiza o início do item em `clean`
    // (que mantém os ranges cancelados originais).
    const probe = `${ordem} -`;
    const cleanIdx = clean.indexOf(`${probe} ${texto.slice(0, 30)}`);
    let cancelled = false;
    if (cleanIdx >= 0) {
      cancelled = cancelRanges.some(([s, e]) => s <= cleanIdx + 2 && e >= cleanIdx + probe.length);
    }
    itens.push({ ordem, texto, cancelled });
  }
  return itens;
}

function extractLeiArticles(text: string): string[] {
  // Captura "Lei nº 14.133/2021, art. X" / "Lei 14.133, art. Y" e similares
  const found = new Set<string>();
  const re = /Lei\s*(?:nº|n\.º|n°|n\.\s*°)?\s*14\.?133[^.]*?art\.\s*(\d{1,3})(?:[-A-Za-z])?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    found.add(m[1]);
  }
  return Array.from(found).sort((a, b) => Number(a) - Number(b));
}

function extractCltArticles(text: string): string[] {
  // Captura "art. X da CLT" / "art. X, § Y, da CLT"
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

function deriveThemes(
  numero: number,
  situacao: TstSumulaSituacao,
  titulo: string,
  tese: string,
  cltArticles: string[],
): string[] {
  const themes: string[] = [`situacao:${situacao}`, 'tst', 'clt'];
  // Tematização: olha título + tese (uppercase normalizado) — alguns títulos
  // do TST são genéricos ("CONTRATO DE PRESTAÇÃO DE SERVIÇOS") mas o corpo
  // contém os termos discriminantes ("empresa interposta", "tomador").
  const t = `${titulo} ${tese}`.toUpperCase();
  const keywordMap: Array<[RegExp, string]> = [
    [/TERCEIRIZ|EMPRESA\s+INTERPOST|VÍNCULO|TOMADOR/, 'terceirizacao'],
    [/CONTRATO\s+DE\s+PRESTAÇÃO|PRESTAÇÃO\s+DE\s+SERVIÇOS/, 'contrato-prestacao-servicos'],
    [/RESPONSABILIDADE\s+SUBSIDIÁRIA/, 'responsabilidade-subsidiaria'],
    [/FISCALIZAÇÃO/, 'fiscalizacao'],
    [/REPACTUAÇÃO|REAJUSTAMENTO/, 'repactuacao'],
    [/PLANILHA|CUSTO/, 'planilha-custos'],
    [/EQUIPARAÇÃO\s+SALARIAL/, 'equiparacao-salarial'],
    [/ESTABILIDADE/, 'estabilidade'],
    [/JUSTA\s+CAUSA/, 'justa-causa'],
    [/AVISO\s+PRÉVIO/, 'aviso-previo'],
    [/HORAS\s+EXTRAS?|JORNADA|INTERVALO\s+INTRAJORNADA/, 'jornada-horas-extras'],
    [/INSALUBRIDADE|PERICULOSIDADE/, 'adicionais'],
    [/FGTS/, 'fgts'],
    [/FÉRIAS/, 'ferias'],
    [/GRATIFICAÇÃO\s+NATALINA|13|DÉCIMO\s+TERCEIRO/, 'gratificacao-natalina'],
    [/AÇÃO\s+RESCISÓRIA|RESCISÓRIA/, 'acao-rescisoria'],
    [/COMPETÊNCIA|JUSTIÇA\s+DO\s+TRABALHO/, 'competencia'],
    [/PRESCRIÇÃO/, 'prescricao'],
    [/PROFESSOR/, 'professor'],
    [/SERVIDOR\s+PÚBLICO|ADMINISTRAÇÃO\s+PÚBLICA/, 'administracao-publica'],
  ];
  const set = new Set<string>(themes);
  for (const [re, key] of keywordMap) {
    if (re.test(t)) set.add(key);
  }
  for (const art of cltArticles) set.add(`clt-art-${art}`);
  return Array.from(set);
}

function buildFullTextMarkdown(parsed: Omit<TstSumulaParsed, 'fullTextMarkdown'>): string {
  const lines: string[] = [];
  lines.push(`# Súmula nº ${parsed.numero} do TST — ${parsed.titulo}`);
  lines.push('');
  lines.push(`**Situação:** ${parsed.situacao}`);
  if (parsed.situacaoMotivo) {
    lines.push('');
    lines.push(`> ${parsed.situacaoMotivo}`);
  }
  if (parsed.resolucoes.length > 0) {
    lines.push('');
    lines.push('## Resoluções');
    for (const r of parsed.resolucoes) {
      const div = r.divulgadoEm ? ` — ${r.tipo ?? ''} ${r.divulgadoEm}`.trimEnd() : '';
      lines.push(`- Res. ${r.numero}${div}`);
    }
  }
  if (parsed.irrs.length > 0) {
    lines.push('');
    lines.push('## Incidente de Recursos Repetitivos (IRR)');
    for (const irr of parsed.irrs) {
      lines.push(`- **IRR nº ${irr.numero}** — ${irr.titulo}`);
      if (irr.rrNumero) {
        const partes = [
          irr.rrNumero,
          irr.publicadoEm ? `publicado em ${irr.publicadoEm}` : null,
          irr.relator ? `rel. ${irr.relator}` : null,
        ].filter(Boolean);
        lines.push(`  - ${partes.join(', ')}`);
      }
      if (irr.tese) lines.push(`  - Tese: ${irr.tese}`);
    }
  }
  lines.push('');
  lines.push('## Tese');
  if (parsed.itens.length > 0) {
    for (const item of parsed.itens) {
      const prefix = item.cancelled ? `~~${item.ordem} -` : `${item.ordem} -`;
      const suffix = item.cancelled ? '~~' : '';
      lines.push(`- ${prefix} ${item.texto}${suffix}`);
      if (item.cancelled && item.cancelMotivo) {
        lines.push(`  - _${item.cancelMotivo}_`);
      }
    }
  } else {
    lines.push(parsed.tese);
  }
  if (parsed.observacao) {
    lines.push('');
    lines.push('## Observação (histórico oficial)');
    lines.push(parsed.observacao);
  }
  return lines.join('\n');
}

/**
 * Parseia um bloco textual correspondente a UMA súmula. Idempotente e puro.
 */
export function parseSumulaBlock(
  block: string,
  numero: number,
  url: string | null,
): TstSumulaParsed {
  const norm = normalizeWhitespace(block);
  // Remove a primeira linha (header "Súmula nº N do TST")
  const headerRe = /^Súmula\s+nº\s+\d+\s+do\s+TST\s*\n/;
  const afterHeader = norm.replace(headerRe, '');

  // Localiza os tokens. Notar que no PDF os tokens "Tese:" e "Situação:" podem
  // aparecer colados ao texto anterior (sem espaço).
  const idxObs = findTokenIndex(afterHeader, 'Observação:');
  const idxTese = findTokenIndex(afterHeader, 'Tese:');
  const idxSit = findTokenIndex(afterHeader, 'Situação:');
  const idxFooter = findTokenIndex(afterHeader, 'Inteiro teor');

  // Título: tudo antes de "Observação:"
  const tituloRaw =
    idxObs >= 0
      ? afterHeader.slice(0, idxObs)
      : afterHeader.split('\n').slice(0, 1).join('\n');
  const titulo = tituloRaw
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Observação: entre "Observação:" e "Tese:" (caso ambos existam)
  let observacao = '';
  if (idxObs >= 0) {
    const obsStart = idxObs + 'Observação:'.length;
    const obsEnd = idxTese >= 0 ? idxTese : idxSit >= 0 ? idxSit : afterHeader.length;
    observacao = afterHeader.slice(obsStart, obsEnd).trim();
  }

  // Tese: entre "Tese:" e "Situação:" (com soft-wrap colapsado)
  let teseRaw = '';
  if (idxTese >= 0) {
    const teseStart = idxTese + 'Tese:'.length;
    const teseEnd = idxSit >= 0 ? idxSit : idxFooter >= 0 ? idxFooter : afterHeader.length;
    teseRaw = afterHeader.slice(teseStart, teseEnd);
  }
  const tese = collapseSoftWraps(teseRaw).trim();

  // Situação
  const { situacao } = detectSituacao(afterHeader);
  // Extrai motivo bruto da observação (texto antes de qualquer Res./IRR — heurístico)
  let situacaoMotivo: string | null = null;
  if (observacao) {
    const m = observacao.match(/^(\([^)]+\)|[^.]+\.)/);
    if (m) situacaoMotivo = m[1].trim();
  }

  // Resoluções
  const resolucoes = parseResolucoes(observacao);

  // IRRs (parser opera sobre observação que pode conter o bloco <b>...</b>)
  const irrs = parseIrrs(observacao);

  // Itens romanos
  const itens = parseItensRomanos(tese);

  // Refs cruzadas (Lei 14.133 e CLT) — usa observação + tese
  const fullScan = `${observacao}\n${tese}`;
  const leiArticles = extractLeiArticles(fullScan);
  const cltArticles = extractCltArticles(fullScan);

  // Ano: derivado da resolução de criação (a mais antiga) ou da mais recente
  let ano: number | null = null;
  if (resolucoes.length > 0) {
    const validos = resolucoes
      .map((r) => r.ano)
      .filter((y): y is number => typeof y === 'number');
    if (validos.length > 0) {
      ano = Math.min(...validos);
    }
  }

  const themes = deriveThemes(numero, situacao, titulo, tese, cltArticles);

  const partial: Omit<TstSumulaParsed, 'fullTextMarkdown'> = {
    numero,
    titulo,
    observacao,
    tese,
    situacao,
    situacaoMotivo,
    url,
    itens,
    irrs,
    resolucoes,
    ano,
    leiArticles,
    cltArticles,
    themes,
    rawBlock: block,
  };

  return {
    ...partial,
    fullTextMarkdown: buildFullTextMarkdown(partial),
  };
}

/**
 * Parseia todas as súmulas do texto plano usando o mapa numero→URL.
 */
export function parseTstSumulas(
  rawText: string,
  urls: Map<number, string>,
): TstSumulaParsed[] {
  const blocks = splitIntoSumulaBlocks(rawText);
  const out: TstSumulaParsed[] = [];
  const sortedNumeros = Array.from(blocks.keys()).sort((a, b) => a - b);
  for (const numero of sortedNumeros) {
    const block = blocks.get(numero)!;
    const url = urls.get(numero) ?? null;
    out.push(parseSumulaBlock(block, numero, url));
  }
  return out;
}
