/**
 * Agregações puras para o probe da rede de precedentes (Fase 0). Recebe as
 * citações já processadas (origem, alvo, seção, casamento) e devolve os números
 * que decidem GO/NO-GO. Sem banco, sem I/O — testável isoladamente.
 */

export interface CitacaoProcessada {
  /** id do Document que CITA. */
  origemId: string;
  numero: number;
  ano: number;
  /** Seção onde a citação caiu, ou null (cabeçalho / fora de seção). */
  secao: 'relatorio' | 'voto' | 'acordao' | null;
  /** A citação aponta para um acórdão que já temos na base? */
  matched: boolean;
  /** id do Document alvo, se matched. */
  alvoId: string | null;
}

function mediana(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function densidade(
  cits: CitacaoProcessada[],
  totalAcordaos: number
): { acordaosComCitacao: number; totalCitacoes: number; media: number; mediana: number } {
  const porOrigem = new Map<string, number>();
  for (const c of cits) porOrigem.set(c.origemId, (porOrigem.get(c.origemId) ?? 0) + 1);

  const contagens = [...porOrigem.values()];
  // Preenche 0 para os acórdãos analisados que não citaram ninguém.
  while (contagens.length < totalAcordaos) contagens.push(0);
  contagens.sort((a, b) => a - b);

  return {
    acordaosComCitacao: porOrigem.size,
    totalCitacoes: cits.length,
    media: totalAcordaos ? cits.length / totalAcordaos : 0,
    mediana: mediana(contagens),
  };
}

export function porSecao(
  cits: CitacaoProcessada[]
): { relatorio: number; voto: number; acordao: number; semSecao: number } {
  const r = { relatorio: 0, voto: 0, acordao: 0, semSecao: 0 };
  for (const c of cits) {
    if (c.secao === null) r.semSecao++;
    else r[c.secao]++;
  }
  return r;
}

export function taxaMatching(
  cits: CitacaoProcessada[]
): { internas: number; externas: number; taxa: number } {
  const internas = cits.filter((c) => c.matched).length;
  return { internas, externas: cits.length - internas, taxa: cits.length ? internas / cits.length : 0 };
}

export interface LeadingCase {
  /** "numero/ano" do acórdão citado. */
  chave: string;
  alvoId: string | null;
  /** Nº de acórdãos DISTINTOS que o citam (autoridade). */
  citadoPor: number;
  /** Quantos desses o citam no VOTO (razão de decidir). */
  noVoto: number;
}

export function rankingLeadingCases(cits: CitacaoProcessada[], limite = 30): LeadingCase[] {
  const porAlvo = new Map<string, { alvoId: string | null; origens: Set<string>; voto: Set<string> }>();
  for (const c of cits) {
    const chave = `${c.numero}/${c.ano}`;
    let e = porAlvo.get(chave);
    if (!e) {
      e = { alvoId: c.alvoId, origens: new Set(), voto: new Set() };
      porAlvo.set(chave, e);
    }
    e.origens.add(c.origemId);
    if (c.secao === 'voto') e.voto.add(c.origemId);
  }
  return [...porAlvo.entries()]
    .map(([chave, e]) => ({ chave, alvoId: e.alvoId, citadoPor: e.origens.size, noVoto: e.voto.size }))
    .sort((a, b) => b.citadoPor - a.citadoPor || b.noVoto - a.noVoto)
    .slice(0, limite);
}
