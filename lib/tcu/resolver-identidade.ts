/**
 * Resolve a identidade oficial de um acórdão contra o TCU (spec §4.2).
 *
 * A identidade NÃO vem da nossa base nem do grafo: o colegiado do grafo é
 * extraído por regex do texto de quem cita e discorda da base em casos reais,
 * e em 39 das 93 teses o acórdão-líder sequer existe como Document.
 */
import { buscarAcordaoPorNumero, escolherCandidato } from './buscar-acordao-tcu';
import type { IdentidadeAlvo } from './persistir-tese';

export type { IdentidadeAlvo };

/**
 * Resultado discriminado: `null` colapsava três situações que pedem decisões
 * diferentes de quem chama. Falha de rede é passageira — o alvo volta à fila e
 * uma nova passada resolve. "Não encontrado" e "ambíguo" são (em regra)
 * permanentes: só mudam se o TCU publicar o acórdão que falta, ou desambiguar
 * o que existe hoje. Sem essa distinção, o backfill não tem como dizer quantos
 * alvos valem uma nova execução e quantos não.
 */
export type ResultadoIdentidade =
  | { tipo: 'resolvido'; identidade: IdentidadeAlvo }
  | { tipo: 'naoEncontrado' }
  | { tipo: 'ambiguo'; candidatos: number }
  | { tipo: 'erroTransitorio'; erro: string };

export async function resolverIdentidade(numero: number, ano: number): Promise<ResultadoIdentidade> {
  let candidatos;
  try {
    candidatos = await buscarAcordaoPorNumero(numero, ano);
  } catch (e) {
    // Falha de rede não é ambiguidade: o alvo continua na fila para a
    // próxima passada, sem gravar identidade errada.
    return { tipo: 'erroTransitorio', erro: e instanceof Error ? e.message : String(e) };
  }
  const escolhido = escolherCandidato(candidatos);
  if (escolhido) {
    return {
      tipo: 'resolvido',
      identidade: {
        acordaoKey: escolhido.key,
        colegiadoAlvo: escolhido.colegiado || null,
        relatorAlvo: escolhido.relator,
        urlAlvo: escolhido.link || null,
      },
    };
  }
  // `escolherCandidato` devolve null tanto para zero quanto para dois-ou-mais
  // candidatos não-relação (spec §4.2) — para distinguir, olhamos a lista de
  // candidatos nós mesmos, com o mesmo filtro que ele usa internamente.
  const completos = candidatos.filter((c) => !c.isRelacao);
  if (completos.length === 0) return { tipo: 'naoEncontrado' };
  return { tipo: 'ambiguo', candidatos: completos.length };
}
