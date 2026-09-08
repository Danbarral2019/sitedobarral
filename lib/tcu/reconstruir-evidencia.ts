/**
 * Reconstrói a evidência de uma destilação já gravada (spec §7.2).
 *
 * Difere de `persistirDestilacao`, que grava a evidência com o dossiê em mãos:
 * aqui o dossiê já não existe e precisa ser recomposto do grafo no estado em
 * que estava na data da destilação. Por isso a verificação por contagem — e por
 * isso a urgência: cada dia de crescimento do grafo torna a reconstrução mais
 * frágil.
 *
 * O lookup dos citantes usa `citantesDoDossie` (mesmo módulo de
 * `persistir-tese.ts`), não uma consulta inline — as duas rotas precisam
 * compartilhar a MESMA regra de descarte de evidência sem caminho para o
 * inteiro teor, ou a evidência de uma delas diverge da outra.
 */
import { coletarTrechosDoAlvo } from './trechos-de-citacao';
import { indicesDeclarados } from './elegibilidade-tese';
import { citantesDoDossie, citanteDoTrecho } from './citantes-do-dossie';

export interface LinhaTrecho {
  ordem: number;
  trecho: string;
  origemNumero: number;
  origemAno: number;
  origemColegiado: string | null;
  origemUrl: string | null;
  origemLinkPDF: string | null;
  origemDocumentId: string | null;
  noVoto: boolean;
}

export interface ResultadoReconstrucao {
  status: 'ok' | 'contagem-divergente';
  linhasPorEnunciado: Record<string, LinhaTrecho[]>;
  descartados: number;
}

export async function reconstruirEvidencia(
  destilacao: { id: string; numeroAlvo: number; anoAlvo: number; criadoEm: Date; dossieTrechos: number },
  enunciados: Array<{ id: string; trechosFonte: unknown }>,
): Promise<ResultadoReconstrucao> {
  const dossie = await coletarTrechosDoAlvo(
    { numero: destilacao.numeroAlvo, ano: destilacao.anoAlvo },
    { ateData: destilacao.criadoEm },
  );

  // A guarda que impede exibir evidência trocada. É o sinal disponível — e o
  // corte por criadoEm é o que efetivamente reconstrói o conjunto certo — mas
  // ela cobre MENOS do que "a evidência reconstruída é a original". São três
  // furos conhecidos, todos com a contagem intacta:
  //
  // 1. Teto de 40. Num alvo saturado, um citante novo entra no top-40 e
  //    desloca outro: a contagem continua 40 e os índices apontam para
  //    trechos diferentes (spec §7).
  // 2. Dedup. `montarDossie` deduplica ANTES de ordenar e mantém a primeira
  //    ocorrência na ordem de entrada; na destilação original essa ordem vinha
  //    de um findMany sem orderBy, indefinida. Citações a precedente com
  //    redação idêntica entre acórdãos são comuns no TCU (o parágrafo padrão
  //    copiado de voto em voto), então o representante que sobrevive à dedup
  //    pode ser outro citante com o mesmo texto — origem trocada, contagem
  //    inalterada. Vale para alvos ABAIXO do teto.
  // 3. Empates. Empate em (noVoto, comprimento) era desfeito pela ordem de
  //    chegada e hoje é desfeito por origemChave: reordenação silenciosa,
  //    contagem inalterada. Também vale abaixo do teto.
  //
  // Nenhum dos três é corrigível — a informação original não existe. Ficam
  // registrados porque a decisão da spec §7.2 ("perder teses é preferível a
  // exibir evidência trocada") está sendo tomada com uma guarda mais fraca do
  // que o texto supõe.
  //
  // Auditoria posterior: linha reconstruída tem `capturadoEm` muito posterior
  // a `destilacao.criadoEm`; linha gravada pelo cron tem os dois quase iguais.
  if (dossie.trechos.length !== destilacao.dossieTrechos) {
    return { status: 'contagem-divergente', linhasPorEnunciado: {}, descartados: enunciados.length };
  }

  const citantes = await citantesDoDossie(dossie);

  const linhasPorEnunciado: Record<string, LinhaTrecho[]> = {};
  let descartados = 0;

  for (const e of enunciados) {
    const indices = indicesDeclarados(e.trechosFonte);
    if (indices.length === 0) { descartados++; continue; }

    const linhas: LinhaTrecho[] = [];
    let invalido = false;
    for (const i of indices) {
      const t = dossie.trechos[i];
      if (!t) { invalido = true; break; }
      const [n, a] = t.origemChave.split('/');
      const origemNumero = parseInt(n, 10);
      const origemAno = parseInt(a, 10);
      if (!Number.isFinite(origemNumero) || !Number.isFinite(origemAno)) { invalido = true; break; }
      const doc = citanteDoTrecho(citantes, t);
      // Invariante da spec §7.1: todo trecho consumível tem ao menos um
      // caminho para o inteiro teor. Sem nenhum, não se grava.
      if (!doc?.id && !doc?.url && !doc?.tcuLinkPDF) { invalido = true; break; }
      linhas.push({
        ordem: i,
        trecho: t.trecho,
        origemNumero,
        origemAno,
        origemColegiado: doc?.tcuOrgaoJulgador ?? null,
        origemUrl: doc?.url ?? null,
        origemLinkPDF: doc?.tcuLinkPDF ?? null,
        origemDocumentId: doc?.id ?? null,
        noVoto: t.noVoto,
      });
    }
    if (invalido) { descartados++; continue; }
    linhasPorEnunciado[e.id] = linhas;
  }

  return { status: 'ok', linhasPorEnunciado, descartados };
}
