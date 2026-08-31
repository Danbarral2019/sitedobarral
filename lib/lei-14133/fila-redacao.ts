/**
 * Fila de redação dos comentários da Lei 14.133.
 *
 * O editor de comentário já existia e é bom. O que faltava para escrever vinte
 * comentários era saber POR ONDE COMEÇAR e ONDE PAROU: a árvore da lei mostra
 * 196 artigos em ordem numérica, sem indicar quais já foram comentados nem
 * quais importam mais.
 *
 * O critério de prioridade é quantos documentos do acervo citam o artigo. É o
 * sinal disponível hoje: o art. 75 é citado por ~195 documentos e muitos
 * artigos por nenhum. Comentar primeiro o que o acervo mais cita é comentar
 * primeiro o que o leitor mais encontra.
 *
 * O histórico de busca não serve como prioridade: guarda texto livre, não
 * número de artigo, e o site abriu ao público em 31/08/2026 — ainda não há
 * tráfego que sustente a conta.
 */

export interface ArtigoNaFila {
  numero: string;
  ementa: string;
  documentCount: number;
  professorComment: string | null;
}

export interface ProgressoRedacao {
  comentados: number;
  total: number;
  /** 0 a 100, arredondado. */
  percentual: number;
}

export function calcularProgresso(artigos: ArtigoNaFila[]): ProgressoRedacao {
  const comentados = artigos.filter(temComentario).length;
  const total = artigos.length;
  return {
    comentados,
    total,
    percentual: total === 0 ? 0 : Math.round((comentados / total) * 100),
  };
}

/** Comentário em branco ou só com espaços não conta como comentado. */
export function temComentario(a: ArtigoNaFila): boolean {
  return (a.professorComment ?? '').trim().length > 0;
}

export interface OpcoesFila {
  /** Inclui os já comentados no fim da lista. Default: false. */
  incluirComentados?: boolean;
}

/**
 * Ordena a fila: pendentes primeiro, os mais citados na frente.
 *
 * O desempate é pelo número do artigo em ordem numérica — não alfabética, que
 * poria o art. 100 antes do art. 9º. Artigos com sufixo de letra (184-A) vêm
 * logo depois do seu número base.
 */
export function ordenarFila(
  artigos: ArtigoNaFila[],
  { incluirComentados = false }: OpcoesFila = {},
): ArtigoNaFila[] {
  const pendentes = artigos.filter((a) => !temComentario(a));
  const ordenados = [...pendentes].sort(compararPrioridade);

  if (!incluirComentados) return ordenados;

  const comentados = artigos.filter(temComentario).sort(compararPrioridade);
  return [...ordenados, ...comentados];
}

function compararPrioridade(a: ArtigoNaFila, b: ArtigoNaFila): number {
  if (b.documentCount !== a.documentCount) return b.documentCount - a.documentCount;
  return ordemNumerica(a.numero) - ordemNumerica(b.numero);
}

/** "9" → 9000, "10" → 10000, "184-A" → 184001. */
export function ordemNumerica(numero: string): number {
  const m = numero.match(/^(\d+)(?:-([A-Z]))?$/);
  if (!m) return Number.MAX_SAFE_INTEGER;
  const base = parseInt(m[1], 10) * 1000;
  const sufixo = m[2] ? m[2].charCodeAt(0) - 64 : 0;
  return base + sufixo;
}

/**
 * Próximo artigo a comentar depois de salvar o atual.
 *
 * Devolve o primeiro pendente que não seja o que acabou de ser salvo — ele
 * ainda pode constar como pendente na lista em memória, que só é recarregada
 * depois.
 */
export function proximoDaFila(
  artigos: ArtigoNaFila[],
  numeroAtual: string,
): ArtigoNaFila | null {
  const fila = ordenarFila(artigos).filter((a) => a.numero !== numeroAtual);
  return fila[0] ?? null;
}
