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

export async function resolverIdentidade(numero: number, ano: number): Promise<IdentidadeAlvo | null> {
  let candidatos;
  try {
    candidatos = await buscarAcordaoPorNumero(numero, ano);
  } catch {
    // Falha de rede não é ambiguidade: devolve null e o alvo continua na fila
    // para a próxima passada, sem gravar identidade errada.
    return null;
  }
  const escolhido = escolherCandidato(candidatos);
  if (!escolhido) return null;
  return {
    acordaoKey: escolhido.key,
    colegiadoAlvo: escolhido.colegiado || null,
    relatorAlvo: escolhido.relator,
    urlAlvo: escolhido.link || null,
  };
}
