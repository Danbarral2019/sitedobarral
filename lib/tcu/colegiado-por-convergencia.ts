/**
 * Resolve o colegiado do acórdão-líder por convergência dos votos citantes
 * (spec §4.3), para quando a identidade oficial do TCU não resolve (ambígua
 * ou não encontrada). Nível 2 de procedência — sem rede, consulta local ao
 * grafo que já temos.
 *
 * Convergência NÃO é maioria — isso continua descartado pela spec §4.1, que
 * rejeitou "colegiado majoritário das arestas" por evidência de erro de
 * extração. A regra aqui é mais estrita: exige UNANIMIDADE entre os citantes
 * que informam colegiado. Um único discordante já derruba para "sem
 * colegiado" (nível 3) — não há voto de desempate.
 */
import { prisma } from '../prisma';

export async function colegiadoPorConvergencia(
  numero: number,
  ano: number
): Promise<{ colegiado: string; citantes: number } | null> {
  const arestas = await prisma.acordaoCitacao.findMany({
    where: { numeroAlvo: numero, anoAlvo: ano, colegiadoAlvo: { not: null } },
    select: { colegiadoAlvo: true },
  });

  // `not: null` no Prisma não barra string vazia — arestas com colegiadoAlvo
  // extraído como '' não informam nada e não podem contar como convergência.
  const informam = arestas
    .map((a) => (a.colegiadoAlvo ?? '').trim())
    .filter((c) => c.length > 0);
  if (informam.length === 0) return null;

  const distintos = new Set(informam);
  if (distintos.size !== 1) return null;

  return { colegiado: [...distintos][0], citantes: informam.length };
}
