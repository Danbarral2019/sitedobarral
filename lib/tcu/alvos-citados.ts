/**
 * Núcleo puro da carga dos acórdãos do TCU que só existem como citação
 * (docs/HANDOFF-2026-09-27-nuvem-alvos-citados-tcu.md). Decide o que entra e
 * com quais marcas; não toca rede nem banco.
 *
 * Por que a carga caminha o feed de dados abertos, e não a lista de alvos: a
 * busca por número (`buscarAcordaoPorNumero`) dá a identidade oficial e a KEY,
 * mas não o link do RTF. O link (`urlArquivo`, com o `item0` interno do SAGAS)
 * só vem no item do feed, e o feed não aceita filtro por número nem por ano
 * (medido em 27/09/2026). Então a identidade vem da busca, o RTF vem do feed,
 * e os dois se encontram pela KEY.
 */
import {
  montarDadosDocument,
  ehAproveitavel,
  parseDataSessao,
  type ItemFeed,
} from './backfill-retroativo';
import type { CandidatoAcordao } from './buscar-acordao-tcu';

/** `reviewedBy` desta carga: proveniência distinta da campanha de julho ('backfill-grafo'). */
export const MARCA_ALVOS_CITADOS = 'alvos-citados-tcu';

export interface ItemFeedComKey extends ItemFeed {
  key?: string;
}

export interface AlvoCitado {
  numero: number;
  ano: number;
  no_voto: number;
}

export interface AlvoPendente extends AlvoCitado {
  chave: string;
}

export const chaveDe = (numero: number, ano: number) => `${numero}/${ano}`;

/**
 * Alvos que ainda valem trabalho, dos mais citados no voto para os menos.
 * Sai quem já é Document (qualquer categoria), quem já tem destilação atual e
 * quem já foi dado como ambíguo ou não encontrado (AlvoIdentidadeIrresolvida),
 * para que nenhum desses seja consultado de novo a cada execução.
 */
export function selecionarPendentes(
  alvos: AlvoCitado[],
  excluir: { documentos: Set<string>; teses: Set<string>; irresolvidos: Set<string> }
): AlvoPendente[] {
  return alvos
    .map((a) => ({ ...a, chave: chaveDe(a.numero, a.ano) }))
    .filter((a) => !excluir.documentos.has(a.chave) && !excluir.teses.has(a.chave) && !excluir.irresolvidos.has(a.chave))
    .sort((x, y) => y.no_voto - x.no_voto);
}

export type DecisaoItem =
  | { tipo: 'ingerir'; origem: 'identidade' | 'convergencia' }
  | { tipo: 'ignorar'; motivo: string }
  | { tipo: 'naoEncontrado' }
  | { tipo: 'ambiguo'; candidatos: number };

function mesmoAcordao(item: ItemFeedComKey, escolhido: CandidatoAcordao, colegiadoDoItem: string): boolean {
  // A KEY é a identidade inequívoca. Sem ela no item (não observado, mas o feed
  // não garante), cai para o colegiado: o candidato já é único no colegiado.
  return item.key ? item.key === escolhido.key : colegiadoDoItem === escolhido.colegiado;
}

/**
 * Decide o que fazer com UM item do feed cujo número/ano é alvo pendente.
 *
 * Ordem do handoff: identidade oficial → convergência dos citantes → se
 * ainda ambíguo, não ingerir. `ignorar` não é estado terminal: o item é outra
 * variante do mesmo número (outro colegiado, relação), e o acórdão certo pode
 * aparecer mais adiante no feed. `naoEncontrado` e `ambiguo` são terminais e
 * vão para AlvoIdentidadeIrresolvida.
 *
 * `colegiadoDoItem` já canônico ('Plenário' | 'Primeira Câmara' | 'Segunda Câmara').
 */
export function decidirItemDoFeed(args: {
  item: ItemFeedComKey;
  candidatos: CandidatoAcordao[];
  /** Colegiado unânime entre os citantes (colegiadoPorConvergencia), ou null. */
  convergencia: string | null;
}): DecisaoItem {
  const { item, candidatos, convergencia } = args;
  const completos = candidatos.filter((c) => !c.isRelacao);
  if (completos.length === 0) return { tipo: 'naoEncontrado' };

  if (!ehAproveitavel(item)) return { tipo: 'ignorar', motivo: 'item de relação ou sem RTF' };
  const colegiadoDoItem = colegiadoCanonico(item.colegiado);

  if (completos.length === 1) {
    return mesmoAcordao(item, completos[0], colegiadoDoItem)
      ? { tipo: 'ingerir', origem: 'identidade' }
      : { tipo: 'ignorar', motivo: 'outra variante do número' };
  }

  if (convergencia) {
    const doColegiado = completos.filter((c) => c.colegiado === convergencia);
    if (doColegiado.length === 1) {
      return mesmoAcordao(item, doColegiado[0], colegiadoDoItem)
        ? { tipo: 'ingerir', origem: 'convergencia' }
        : { tipo: 'ignorar', motivo: 'colegiado diverge da convergência' };
    }
  }
  return { tipo: 'ambiguo', candidatos: completos.length };
}

/** Mesmo mapeamento de `montarDadosDocument` (lib/tcu/backfill-retroativo.ts). */
export function colegiadoCanonico(colegiado: string | null | undefined): string {
  const c = (colegiado ?? '').trim();
  if (/1[ªa]\s*c/i.test(c) || /primeira/i.test(c)) return 'Primeira Câmara';
  if (/2[ªa]\s*c/i.test(c) || /segunda/i.test(c)) return 'Segunda Câmara';
  return 'Plenário';
}

/**
 * Dados do Document: as marcas de invisibilidade da campanha de julho
 * (categoria do grafo, isPublic false), com proveniência própria e FORA da
 * fila de embeddings. `skipped` impede o cron process-index-jobs de chamar o
 * Gemini; religar a fila é decisão posterior, com o teto elevado.
 */
export function montarDocumentoAlvo(item: ItemFeedComKey): Record<string, unknown> | null {
  const base = montarDadosDocument(item);
  if (!base) return null;
  return { ...base, reviewedBy: MARCA_ALVOS_CITADOS, embeddingStatus: 'skipped' };
}

/**
 * Sinal determinístico de fim da caminhada: todos os itens datados da página
 * estão abaixo do ano do alvo mais antigo. Página vazia não conclui (lição de
 * 21/07: resposta vazia pode ser soluço da API), e página com datas
 * misturadas também não, porque o feed profundo mistura datas.
 */
export function feedPassouDoAno(itens: ItemFeedComKey[], anoMinimo: number): boolean {
  const anos = itens
    .map((i) => parseDataSessao(i.dataSessao))
    .filter((d): d is string => d !== null)
    .map((d) => Number(d.slice(0, 4)));
  return anos.length > 0 && anos.every((a) => a < anoMinimo);
}
