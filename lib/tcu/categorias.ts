/**
 * Categorias que as FILAS de processamento do TCU devem enxergar.
 *
 * 'acordao'       = acervo curado por relevância temática, visível no site.
 * 'acordao-grafo' = combustível do grafo de precedentes, invisível ao usuário.
 *
 * As superfícies do site NÃO devem usar esta constante — elas filtram
 * 'acordao' e é justamente assim que o combustível fica fora delas.
 */
export const CATEGORIAS_ACORDAO = ['acordao', 'acordao-grafo'] as const;
