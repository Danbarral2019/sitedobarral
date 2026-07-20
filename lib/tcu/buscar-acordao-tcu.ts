/**
 * Cliente da API de busca do TCU — resolve "número de acórdão" em candidatos
 * (metadados + ementa + KEY do inteiro teor). Isolado num módulo só de propósito:
 * a rota do TCU já mudou uma vez, então um conserto futuro fica local.
 *
 * ⚠️ O body é `text/plain` com o termo CRU ("2622/2013"), NÃO application/json —
 * este último retorna HTTP 415 (descoberto em 2026-07-19).
 */
const BUSCA_URL = 'https://pesquisa.apps.tcu.gov.br/api/publico/entidades/busca';
const UA = 'Mozilla/5.0 (compatible; SiteBarral/1.0; +https://profdanielbarral.com)';
const TIMEOUT_MS = 20_000;

export interface CandidatoAcordao {
  numero: number;
  ano: number;
  colegiado: string;
  relator: string | null;
  ementa: string;
  key: string;
  link: string;
  /** Título traz "Acórdão de Relação" (decisão simplificada) — preferimos o acórdão completo. */
  isRelacao: boolean;
}

const TITULO_RE = /(\d[\d.]*)\s*\/\s*(\d{4})(?:\s+ATA\s+\d+\/\d{4})?\s*-\s*(.+)$/i;
const ehRelacao = (s: string) => /ac[óo]rd[ãa]o\s+de\s+rela[çc][ãa]o/i.test(s || '');

function canonColegiado(raw: string): string {
  const s = (raw || '').toLowerCase();
  if (s.includes('plen')) return 'Plenário';
  if (s.includes('primeira') || /\b1[ªa]/.test(s)) return 'Primeira Câmara';
  if (s.includes('segunda') || /\b2[ªa]/.test(s)) return 'Segunda Câmara';
  return (raw || '').trim();
}

export function parseEntidade(e: { titulo: string; subtitulo?: string; texto?: string; link: string }): CandidatoAcordao | null {
  const key = /KEY:(ACORDAO-COMPLETO-\d+)/.exec(e.link || '')?.[1];
  const tm = TITULO_RE.exec(e.titulo || '');
  if (!key || !tm) return null;
  const numero = parseInt(tm[1].replace(/\./g, ''), 10);
  const ano = parseInt(tm[2], 10);
  if (!Number.isFinite(numero) || numero <= 0 || ano < 1990 || ano > 2100) return null;

  return {
    numero,
    ano,
    colegiado: canonColegiado(tm[3]),
    relator: /relator:\s*(.+)$/i.exec(e.subtitulo || '')?.[1]?.trim() || null,
    ementa: (e.texto || '').trim(),
    key,
    link: `https://pesquisa.apps.tcu.gov.br/documento/${key.toLowerCase()}`,
    isRelacao: ehRelacao(e.titulo),
  };
}

export function escolherCandidato(cands: CandidatoAcordao[], colegiadoPreferido?: string): CandidatoAcordao | null {
  if (!cands.length) return null;
  if (colegiadoPreferido) {
    const c = cands.find((x) => x.colegiado === colegiadoPreferido && !x.isRelacao);
    if (c) return c;
  }
  const completos = cands.filter((c) => !c.isRelacao);
  return (completos[0] ?? cands[0]) || null;
}

export async function buscarAcordaoPorNumero(numero: number, ano: number): Promise<CandidatoAcordao[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(BUSCA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', Accept: 'application/json', 'User-Agent': UA },
      body: `${numero}/${ano}`,
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`Busca TCU ${r.status} ${r.statusText}`);
    const data = (await r.json()) as { entidades?: unknown[] };
    const ents: unknown[] = Array.isArray(data?.entidades) ? data.entidades : [];
    return ents
      .map((e) => parseEntidade(e as { titulo: string; subtitulo?: string; texto?: string; link: string }))
      .filter((c): c is CandidatoAcordao => c !== null)
      .filter((c) => c.numero === numero && c.ano === ano);
  } finally {
    clearTimeout(t);
  }
}
