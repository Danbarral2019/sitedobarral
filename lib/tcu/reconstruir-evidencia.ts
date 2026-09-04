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
import { citantesDoDossie } from './citantes-do-dossie';

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

  // A guarda que impede exibir evidência trocada. Não protege os alvos
  // saturados no teto de 40 — lá a contagem continua batendo enquanto o
  // conteúdo muda — mas é o sinal disponível, e o corte por criadoEm é o que
  // efetivamente reconstrói o conjunto certo.
  if (dossie.trechos.length !== destilacao.dossieTrechos) {
    return { status: 'contagem-divergente', linhasPorEnunciado: {}, descartados: enunciados.length };
  }

  const porChave = await citantesDoDossie(dossie);

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
      const doc = porChave.get(t.origemChave) ?? null;
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
