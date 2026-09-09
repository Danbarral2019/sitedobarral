/**
 * O plano do backfill da spec §7, em dois movimentos distintos.
 *
 * Função pura: decide o que fazer, não faz. Assim os dois movimentos são
 * testáveis sem banco, e o script fica só com a parte que escreve.
 *
 * A decisão de herdar NÃO é reimplementada aqui — ela vem de `carregarVeredito`
 * com o nível 2 ligado, a mesma função que a redestilação usa. Uma segunda
 * implementação estaria livre para divergir da primeira, e é justamente contra
 * isso que este projeto centraliza suas regras.
 *
 * POR QUE O PLANO NÃO CARREGA `retiradoEm`/`retiradoMotivo`.
 * A redestilação ao vivo espalha o retorno inteiro de `carregarVeredito`,
 * retirada incluída; aqui os campos são escritos à mão e a retirada fica de
 * fora. Medido em 09/09/2026: as 3 únicas retiradas do banco estão todas na
 * versão VIGENTE — nenhum acórdão retirado foi redestilado depois —, então não
 * há nada a recuperar, e o nível 2 fecha a lacuna para toda redestilação
 * futura. O argumento repousa num fato do banco naquela data: se um dia
 * aparecer acórdão retirado numa versão ANTERIOR à vigente, este plano precisa
 * passar a carregar os dois campos.
 */
import { carregarVeredito, type AnteriorParaHeranca } from './carregar-veredito';

const ETIQUETA_DE_LOTE = ':lote-';

export type AnteriorJulgavel = AnteriorParaHeranca;

/** Um julgamento é de pessoa quando não traz a etiqueta de lote. */
function ehConferenciaIndividual(julgadoPor: string | null | undefined): boolean {
  return julgadoPor != null && !julgadoPor.includes(ETIQUETA_DE_LOTE);
}

export interface PlanoHerdar {
  chave: string;
  enunciadoId: string;
  veredito: string;
  publicado: boolean;
  herdadoDe: string;
}

/**
 * O segundo movimento também grava `herdadoDe`, e não só a marca de pendência.
 * Sem ele a fila da folha descarta o enunciado em silêncio
 * (`lib/teses/reconferencia.ts` exige `reconferenciaPendente` E `herdadoDe`), e
 * o movimento inteiro — cujo propósito declarado é "tornar visível o que hoje
 * está escondido" — não mostraria nada a ninguém.
 */
export interface PlanoMarcar {
  chave: string;
  enunciadoId: string;
  herdadoDe: string;
}

export interface GrupoDeVersoes {
  chave: string;
  vigentes: Array<{
    id: string;
    enunciado: string;
    veredito: string | null;
    julgadoPor: string | null;
  }>;
  anteriores: AnteriorJulgavel[];
}

export function planejarBackfill(
  grupos: GrupoDeVersoes[]
): { herdar: PlanoHerdar[]; marcar: PlanoMarcar[] } {
  const herdar: PlanoHerdar[] = [];
  const marcar: PlanoMarcar[] = [];

  for (const g of grupos) {
    // Uma conferência individual em qualquer enunciado da versão anterior
    // qualifica o grupo: a folha julga por cartão de acórdão, então o
    // julgamento vale para a versão inteira.
    //
    // Guardamos QUAL enunciado era, não apenas que houve um: é o id dele que o
    // segundo movimento grava em `herdadoDe`. Gravar o antecessor de lote em
    // vez deste faria a fila derrubar o cartão (`reconferencia.ts` exige
    // autoria no antecessor) ou, pior, a folha exibiria "Aprovada por
    // danbarral:lote-confianca-alta" — atribuindo a uma pessoa um carimbo
    // automático.
    const conferidoIndividualmente = g.anteriores.find(
      (a) => a.veredito !== null && ehConferenciaIndividual(a.julgadoPor)
    );

    for (const v of g.vigentes) {
      const h = carregarVeredito(v.enunciado, g.anteriores, { herdarComTextoDiferente: true });

      // Texto idêntico não é assunto do backfill: a redestilação já resolveu
      // pelo nível 1, e marcar pendência aqui seria pendência falsa.
      if (!h.reconferenciaPendente) continue;

      if (v.veredito === null) {
        // Primeiro movimento. `h.veredito` só é não-nulo quando a versão
        // anterior falou com uma voz só — a regra da Task 1 já cuidou disso.
        if (h.veredito === null || h.herdadoDe === null) continue;
        herdar.push({
          chave: g.chave,
          enunciadoId: v.id,
          veredito: h.veredito,
          publicado: h.publicado,
          herdadoDe: h.herdadoDe,
        });
        continue;
      }

      // Segundo movimento: o vigente já tem veredito, então nada sai do ar.
      //
      // Quem já foi conferido por uma PESSOA nesta versão está lido — pedir
      // reconferência aqui inventaria trabalho sobre o que acabou de ser
      // julgado, e contradiria `lib/tcu/dados-do-veredito.ts`, que zera a flag
      // justamente para significar "julgado".
      if (ehConferenciaIndividual(v.julgadoPor)) continue;

      // Só marca quando o antecessor foi conferência individual — marcar um
      // lote que sucede outro lote não informa nada a ninguém.
      if (conferidoIndividualmente) {
        marcar.push({ chave: g.chave, enunciadoId: v.id, herdadoDe: conferidoIndividualmente.id });
      }
    }
  }

  return { herdar, marcar };
}
