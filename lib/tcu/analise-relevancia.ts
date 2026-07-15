/**
 * Conta, por seção do acórdão, os termos-chave de cada artigo vinculado.
 *
 * Guarda CONTAGENS, não veredito: o limiar de "quantas menções no voto = razão
 * de decidir" mora em LIMIAR_DEBATIDO, fora do dado, e é recomputável sem
 * re-baixar nada. Foi IA embutida no critério que produziu os 448 vínculos
 * fantasma do art. 5º — aqui não entra LLM.
 *
 * Ref.: docs/superpowers/specs/2026-07-15-tcu-inteiro-teor-relevancia-design.md
 */
import { seccionarAcordao, secaoDe, type Secoes } from './seccionar-acordao';
import { TERMOS_POR_ARTIGO } from '../../data/lei-14133-termos';
import { extractCitations } from '../lei-14133/citation-extractor';

/** Suba ao mudar a semântica da análise: o backfill reprocessa quem estiver defasado. */
export const ANALISE_VERSAO = 1;

/**
 * Limiar provisório. Calibrado em UM acórdão (1135/2026) no spike de 15/07:
 * "julgamento objetivo" aparecia forte=1 / fraco=11 no voto e era a razão de
 * decidir; a proposta original (forte >= 2) não teria pego nenhum acórdão,
 * porque o julgador nomeia o princípio uma vez e depois usa o nome nu.
 * VALIDAR com o golden set de 10 acórdãos antes de confiar.
 */
export const LIMIAR_DEBATIDO = { forteVoto: 1, fracoVoto: 3 };

export interface ContagemSecao { relatorio?: number; voto?: number; acordao?: number }
export interface TermoContagem { forte: ContagemSecao; fraco: ContagemSecao }

export interface TcuAnalise {
  v: number;
  extraidoEm: string;
  chars: number;
  truncado?: boolean;
  secoes: Secoes | null;
  artigosCitados: Record<string, ContagemSecao>;
  termos: Record<string, Record<string, TermoContagem>>;
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** "princípio da economicidade" — o princípio sendo nomeado como tal. */
const reForte = (termo: string) =>
  new RegExp(`princ[íi]pios?\\s+(?:d[aeo]s?\\s+)?${escapar(termo)}`, 'gi');

/** O termo isolado. Sinal secundário: sozinho não decide nada. */
const reFraco = (termo: string) => new RegExp(escapar(termo), 'gi');

function contarPorSecao(texto: string, re: RegExp, secoes: Secoes | null): ContagemSecao {
  const out: ContagemSecao = {};
  for (const m of texto.matchAll(re)) {
    if (m.index === undefined) continue;
    const s = secaoDe(secoes, m.index);
    if (!s) continue; // cabeçalho não conta
    out[s] = (out[s] ?? 0) + 1;
  }
  return out;
}

export function analisarAcordao(
  texto: string,
  artigosVinculados: string[],
  opts?: { truncado?: boolean }
): TcuAnalise {
  const secoes = seccionarAcordao(texto);

  const artigosCitados: Record<string, ContagemSecao> = {};
  for (const c of extractCitations(texto)) {
    if (!c.nearLei14133) continue;
    const s = secaoDe(secoes, c.index);
    if (!s) continue;
    artigosCitados[c.article] ??= {};
    artigosCitados[c.article][s] = (artigosCitados[c.article][s] ?? 0) + 1;
  }

  const termos: Record<string, Record<string, TermoContagem>> = {};
  for (const art of artigosVinculados) {
    const lista = TERMOS_POR_ARTIGO[art];
    if (!lista) continue; // artigo sem termos: a citação direta já resolve
    for (const termo of lista) {
      const forte = contarPorSecao(texto, reForte(termo), secoes);
      const fraco = contarPorSecao(texto, reFraco(termo), secoes);
      if (!Object.keys(forte).length && !Object.keys(fraco).length) continue;
      termos[art] ??= {};
      termos[art][termo] = { forte, fraco };
    }
  }

  return {
    v: ANALISE_VERSAO,
    extraidoEm: new Date().toISOString(),
    chars: texto.length,
    ...(opts?.truncado ? { truncado: true } : {}),
    secoes,
    artigosCitados,
    termos,
  };
}

/** Aplica o limiar. Derivado — recomputável a partir do JSON, sem rede. */
export function artigosDebatidos(a: TcuAnalise): string[] {
  const out: string[] = [];
  for (const [art, termos] of Object.entries(a.termos)) {
    const debatido = Object.values(termos).some(
      (t) =>
        (t.forte.voto ?? 0) >= LIMIAR_DEBATIDO.forteVoto ||
        (t.fraco.voto ?? 0) >= LIMIAR_DEBATIDO.fracoVoto
    );
    if (debatido) out.push(art);
  }
  return out.sort();
}
