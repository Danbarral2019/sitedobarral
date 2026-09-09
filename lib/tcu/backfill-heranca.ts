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
 */
import { carregarVeredito, type EnunciadoJulgavel } from './carregar-veredito';

const ETIQUETA_DE_LOTE = ':lote-';

export type AnteriorJulgavel = EnunciadoJulgavel & {
  julgadoEm: Date | null;
  julgadoPor: string | null;
  publicado?: boolean;
  vitrinePublica?: boolean;
  retiradoEm?: Date | null;
  retiradoMotivo?: string | null;
};

export interface PlanoHerdar {
  enunciadoId: string;
  veredito: string;
  publicado: boolean;
  herdadoDe: string;
}

export interface GrupoDeVersoes {
  vigentes: Array<{ id: string; enunciado: string; veredito: string | null }>;
  anteriores: AnteriorJulgavel[];
}

export function planejarBackfill(
  grupos: GrupoDeVersoes[]
): { herdar: PlanoHerdar[]; marcar: string[] } {
  const herdar: PlanoHerdar[] = [];
  const marcar: string[] = [];

  for (const g of grupos) {
    // Uma conferência individual em qualquer enunciado da versão anterior
    // qualifica o grupo: a folha julga por cartão de acórdão, então o
    // julgamento vale para a versão inteira.
    const houveConferenciaIndividual = g.anteriores.some(
      (a) => a.veredito !== null && a.julgadoPor !== null && !a.julgadoPor.includes(ETIQUETA_DE_LOTE)
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
          enunciadoId: v.id,
          veredito: h.veredito,
          publicado: h.publicado,
          herdadoDe: h.herdadoDe,
        });
        continue;
      }

      // Segundo movimento: o vigente já tem veredito, então nada sai do ar.
      // Só marca, e só quando o antecessor foi conferência individual —
      // marcar um lote que sucede outro lote não informa nada a ninguém.
      if (houveConferenciaIndividual) marcar.push(v.id);
    }
  }

  return { herdar, marcar };
}
