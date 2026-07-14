/**
 * Lógica pura do monitor de ONs da AGU (cron ons-monitor).
 *
 * Raspa a página oficial `gov.br/agu/.../onsagu` (fonte autoritativa) e a compara
 * com o banco para detectar:
 *   - ONs NOVAS (na página, ausentes no banco) → candidatas a importar;
 *   - REDAÇÃO ALTERADA (enunciado do banco diverge do da página);
 *   - ausentes da página (informativo — possíveis revogações).
 *
 * Tudo aqui é função pura (sem DB/rede) para ser testável. A rota injeta o HTML
 * e os registros do banco.
 */
import * as cheerio from 'cheerio';

export interface PageON {
  key: string;
  onNumber: number;
  onYear: number;
  enunciado: string;
  douUrl: string | null;
}

export interface DbON {
  key: string;
  isPublic: boolean;
  content: string | null;
}

export interface OnsDiff {
  novasNaPagina: string[];
  redacaoAlterada: { key: string; containment: number }[];
  ausentesDaPagina: string[];
}

/** ONs removidas a pedido (temas de pessoal) — não sinalizar como "novas". */
export const EXCLUIDAS = new Set(['104/2026', '106/2026']);

/** ONs públicas que a página AGU sabidamente NÃO lista (revogadas/antigas da CNU) —
 *  não sinalizar como "ausentes" a cada rodada. */
export const KNOWN_ABSENT_FROM_PAGE = new Set(['1/2016', '2/2016', '4/2016', '6/2017', '95/2025']);

/**
 * Contenção mínima do enunciado da página dentro do `content` do banco. Abaixo
 * disso, considera-se a redação possivelmente alterada. Usamos CONTENÇÃO (page ⊆ db),
 * não similaridade simétrica (Jaccard), porque o `content` do banco costuma ter
 * boilerplate extra ("redação dada pela Portaria…", "Referência", "Fonte") que
 * derruba o Jaccard e gera falso positivo — a pergunta certa é se o texto da
 * página ainda está PRESENTE no banco. Calibrado em dados reais (14/07): menor
 * contenção legítima observada = 0,89; margem confortável até 0,75. */
export const CONTAINMENT_THRESHOLD = 0.75;

/**
 * Decodifica o HTML escolhendo entre utf-8 e latin-1 pela que produz menos
 * artefatos. O servidor da AGU é inconsistente (ora utf-8, ora iso-8859-1);
 * um heurístico ingênuo ("1 caractere inválido → latin-1") mojibaka o documento
 * inteiro, então comparamos as duas decodificações.
 */
export function decodeBest(buf: Buffer): string {
  const utf8 = buf.toString('utf-8');
  const latin1 = buf.toString('latin1');
  const badUtf8 = (utf8.match(/�/g) || []).length;
  const badLatin1 = (latin1.match(/[ÃÂ][\x80-\xBF -¿]/g) || []).length;
  return badUtf8 <= badLatin1 ? utf8 : latin1;
}

/** Extrai as ONs da página (cada uma num `div.on-card`). */
export function parseOnsPage(html: string): PageON[] {
  const $ = cheerio.load(html);
  const out: PageON[] = [];
  $('.on-card').each((_, el) => {
    const card = $(el);
    const m = card.find('.on-titulo').text().match(/Normativa\s+n?[º°.]?\s*(\d+)\s*\/\s*(\d{4})/i);
    if (!m) return;
    const onNumber = parseInt(m[1], 10);
    const onYear = parseInt(m[2], 10);
    const href = card.find('.on-titulo a').first().attr('href') || null;
    out.push({
      key: `${onNumber}/${onYear}`,
      onNumber,
      onYear,
      enunciado: card.find('.on-corpo').text().replace(/\s+/g, ' ').trim(),
      douUrl: href && /in\.gov\.br/i.test(href) ? href : null,
    });
  });
  return out;
}

/** Tokeniza texto normalizado (minúsculas, sem acentos, só alfanumérico). */
export function tokenize(s: string): Set<string> {
  const norm = s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
  return new Set(norm.split(/[^a-z0-9]+/).filter((t) => t.length > 1));
}

/** Similaridade de Jaccard entre dois conjuntos de tokens. */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 1 : inter / union;
}

/** Fração dos tokens de `part` presentes em `whole` (contenção part ⊆ whole). */
export function containment(part: Set<string>, whole: Set<string>): number {
  if (part.size === 0) return 1;
  let inter = 0;
  for (const t of part) if (whole.has(t)) inter++;
  return inter / part.size;
}

/** Compara a página com o banco e devolve os três buckets. */
export function diffOns(page: PageON[], db: DbON[]): OnsDiff {
  const dbByKey = new Map(db.map((d) => [d.key, d]));
  const pageKeys = new Set(page.map((p) => p.key));

  const novasNaPagina: string[] = [];
  const redacaoAlterada: { key: string; containment: number }[] = [];

  for (const p of page) {
    if (EXCLUIDAS.has(p.key)) continue;
    const d = dbByKey.get(p.key);
    if (!d) { novasNaPagina.push(p.key); continue; }
    const dbText = (d.content ?? '').trim();
    // só compara quando ambos têm texto substantivo (evita comparar enunciado curto vs integral)
    if (dbText.length > 80 && p.enunciado.length > 80) {
      const cont = containment(tokenize(p.enunciado), tokenize(dbText));
      if (cont < CONTAINMENT_THRESHOLD) redacaoAlterada.push({ key: p.key, containment: Math.round(cont * 100) / 100 });
    }
  }

  const ausentesDaPagina: string[] = [];
  for (const d of db) {
    if (!d.isPublic) continue;
    if (EXCLUIDAS.has(d.key) || KNOWN_ABSENT_FROM_PAGE.has(d.key)) continue;
    if (!pageKeys.has(d.key)) ausentesDaPagina.push(d.key);
  }

  return {
    novasNaPagina: novasNaPagina.sort(),
    redacaoAlterada: redacaoAlterada.sort((a, b) => a.containment - b.containment),
    ausentesDaPagina: ausentesDaPagina.sort(),
  };
}
