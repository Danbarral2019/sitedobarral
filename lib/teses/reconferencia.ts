/**
 * A seleção dos enunciados com veredito provisório (spec §4.1, nível 2) para a
 * fila de reconferência da folha de calibração.
 *
 * Extraído de `scripts/build-folha-teses-tcu.ts` para ser testável sem banco:
 * aquele script chama `main()` no escopo do módulo, e importar a função de lá
 * dispararia o script inteiro — Prisma de produção e busca no TCU incluídos —
 * a cada rodada de teste.
 */
export interface CartaoReconferencia {
  chave: string;
  enunciadoNovo: string;
  enunciadoAnterior: string;
  julgadoPor: string;
  julgadoEm: Date;
}

/**
 * Os enunciados vigentes que carregam veredito provisório, cada um ao lado do
 * texto que foi efetivamente aprovado.
 *
 * Selecionada ANTES e independentemente dos recortes de `--min-no-voto` e
 * `--tema`: quem já foi conferido uma vez não pode sumir da fila por um limiar
 * de citação.
 */
export function selecionarReconferencia(
  destilacoes: Array<{
    chave: string;
    enunciados: Array<{ id: string; enunciado: string; reconferenciaPendente: boolean; herdadoDe: string | null }>;
  }>,
  anterioresPorId: Map<string, { enunciado: string; julgadoPor: string | null; julgadoEm: Date | null }>
): CartaoReconferencia[] {
  const cartoes: CartaoReconferencia[] = [];
  for (const d of destilacoes) {
    for (const e of d.enunciados) {
      if (!e.reconferenciaPendente || !e.herdadoDe) continue;
      const ant = anterioresPorId.get(e.herdadoDe);
      if (!ant || !ant.julgadoPor || !ant.julgadoEm) continue;
      cartoes.push({
        chave: d.chave,
        enunciadoNovo: e.enunciado,
        enunciadoAnterior: ant.enunciado,
        julgadoPor: ant.julgadoPor,
        julgadoEm: ant.julgadoEm,
      });
    }
  }
  return cartoes;
}
