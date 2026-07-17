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

/**
 * Suba ao mudar a semântica da análise: o backfill reprocessa quem estiver
 * defasado (compara com `tcuAnalise.v`).
 *
 * v2 (15/07): `seccionar-acordao.ts` passou a exigir "Nº" no marcador do
 * dispositivo (RE_ACORDAO) — uma linha "ACÓRDÃO" solta deixou de fechar a
 * seção do voto. Os 66 acórdãos já processados em produção têm `v: 1`
 * (seccionamento antigo) e precisam ser reprocessados.
 *
 * v3 (17/07): o voto real passou a ser o ÚLTIMO "VOTO" antes do dispositivo,
 * não o primeiro. O TCU transcreve a decisão recorrida (com sua própria linha
 * "VOTO") dentro do relatório; pegar o primeiro rotulava trecho do relatório
 * como voto e inflava `forte.voto`. Afetava 14 dos 1.685 acórdãos. Reprocessar
 * a partir do texto guardado (sem re-baixar) via scripts/reanalyze-tcu.ts.
 *
 * v4 (17/07): `artigosCitados` passou a descartar artigos amarrados a outra
 * norma ("art. 103 da Resolução-TCU 259"), que a proximidade da 14.133 na
 * janela carimbava indevidamente. Removeu 444 pares (art,seção) em 190 dos
 * 1.685 acórdãos, 0 adicionados — art. 103 (Resolução 259), 37 (CF), 43/50
 * (Lei 8.666/9.784) à frente. Ver lib/lei-14133/citation-extractor.ts.
 *
 * v5 (17/07): sinal do voto para regra concreta. `artigosDebatidos` passou a
 * marcar "debatido" todo artigo NÃO-por-termos citado no voto (razão de
 * decidir), independente do vínculo da IA. `leiArticlesDebated` deixou de ser
 * subconjunto de `leiArticlesArr`. Só a lista derivada muda; o JSON de
 * contagens é o mesmo do v4.
 */
export const ANALISE_VERSAO = 5;

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

/**
 * Escapa o termo e: (1) troca espaço simples por `\s+`, porque o texto
 * extraído de RTF traz quebras de linha e espaços duplos entre as palavras de
 * termos compostos ("segurança jurídica", "vinculação ao edital"); (2) cerca
 * com lookaround `(?<!\p{L})...(?!\p{L})` para exigir borda de palavra.
 *
 * Por que não `\b`: 8 dos 22 princípios do art. 5º estão contidos no próprio
 * antônimo ("legalidade" dentro de "ilegalidade", "segurança jurídica" dentro
 * de "insegurança jurídica" etc.) — sem borda, a regex casava o antônimo e
 * invertia o sinal (contava como se o princípio tivesse sido afirmado). `\b`
 * do JS não serve porque não reconhece acentuação (`ç`, `ã`, `í`) como letra;
 * `\p{L}` (com a flag `u`) reconhece.
 */
const termoComBorda = (termo: string) =>
  `(?<!\\p{L})${escapar(termo).replace(/ /g, '\\s+')}(?!\\p{L})`;

/** "princípio da economicidade" — o princípio sendo nomeado como tal. */
const reForte = (termo: string) =>
  new RegExp(`princ[íi]pios?\\s+(?:d[aeo]s?\\s+)?${termoComBorda(termo)}`, 'giu');

/** O termo isolado. Sinal secundário: sozinho não decide nada. */
const reFraco = (termo: string) => new RegExp(termoComBorda(termo), 'giu');

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

/**
 * ⚠️ `artigosVinculados` filtra APENAS os `termos` (a via do art. 5º): só os
 * termos dos artigos já em `artigosVinculados` (no backfill, `d.leiArticlesArr`
 * — atribuído pela IA) entram em `termos`. Um acórdão que debata economicidade
 * por páginas mas que a IA nunca marcou com o art. 5º é invisível por essa via.
 *
 * `artigosCitados` NÃO é filtrado por `artigosVinculados` — é a citação textual
 * lida do inteiro teor. Por isso, desde o v5, `leiArticlesDebated` (que inclui
 * artigo concreto citado no voto) NÃO é mais subconjunto de `leiArticlesArr`:
 * a IA sub-vincula regra concreta, e a citação no voto é prova própria. A
 * hierarquia `debatido > citado > vinculado` de prisma/schema.prisma vale para
 * a via de TERMOS (art. 5º), não para a via de citação no voto.
 */
export function analisarAcordao(
  texto: string,
  artigosVinculados: string[],
  opts?: { truncado?: boolean }
): TcuAnalise {
  const secoes = seccionarAcordao(texto);

  const artigosCitados: Record<string, ContagemSecao> = {};
  for (const c of extractCitations(texto)) {
    // Exige proximidade da 14.133 e descarta o que está amarrado a outra norma
    // ("art. 103 da Resolução-TCU 259"), que a proximidade sozinha carimbaria.
    if (!c.nearLei14133 || c.boundToOtherNorm) continue;
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

/**
 * Aplica o limiar. Derivado — recomputável a partir do JSON, sem rede.
 *
 * Dois sinais, por natureza do artigo:
 *  - Artigos com lista de termos (só o art. 5º): debatido = princípio NOMEADO
 *    no voto (limiar `LIMIAR_DEBATIDO`). Congelado — o art. 5º é o caso difícil
 *    (princípio vira adorno retórico), calibrado e mantido por decisão do Daniel.
 *  - Artigos de regra concreta (todos os demais): debatido = CITADO NO VOTO
 *    (razão de decidir). Confirmado em golden dos arts. 59 e 67 (20/20). É fonte
 *    própria — NÃO filtra por `leiArticlesArr`: a citação no voto é prova
 *    objetiva, e a IA sub-vincula regra concreta (perde 64% dessas citações).
 *
 * ⚠️ Por isso `leiArticlesDebated` já NÃO é subconjunto de `leiArticlesArr`
 * (ver nota em analisarAcordao e prisma/schema.prisma).
 */
export function artigosDebatidos(a: TcuAnalise): string[] {
  const out = new Set<string>();

  for (const [art, termos] of Object.entries(a.termos)) {
    const debatido = Object.values(termos).some(
      (t) =>
        (t.forte.voto ?? 0) >= LIMIAR_DEBATIDO.forteVoto ||
        (t.fraco.voto ?? 0) >= LIMIAR_DEBATIDO.fracoVoto
    );
    if (debatido) out.add(art);
  }

  for (const [art, secs] of Object.entries(a.artigosCitados)) {
    if (TERMOS_POR_ARTIGO[art]) continue; // artigo por-termos tratado acima
    if ((secs.voto ?? 0) >= 1) out.add(art);
  }

  return [...out].sort();
}
