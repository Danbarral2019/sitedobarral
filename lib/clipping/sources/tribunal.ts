import { prisma } from '@/lib/prisma';
import { sentRefKey, type ClippingItem } from './types';

export interface FetchTribunalItemsParams {
  tribunalCode: string;
  windowDays: number;
  alreadySentKeys?: Set<string>;
  limit?: number;
  /**
   * Threshold mínimo de relevanceScore. Default 55 (mesmo do classifier
   * que marca `approvalStatus='auto_approved'`).
   */
  minRelevanceScore?: number;
  /**
   * Idade máxima do julgado, em meses, medida pela `dataJulgamento`.
   * Default 3, sobrescrevível por `CLIPPING_MAX_IDADE_MESES`.
   */
  maxIdadeMeses?: number;
}

const DEFAULT_MIN_RELEVANCE = 55;
const DEFAULT_MAX_IDADE_MESES = 3;
const APPROVED_STATUSES = ['auto_approved', 'manually_approved'];

function maxIdadeMesesDoAmbiente(): number {
  const raw = process.env.CLIPPING_MAX_IDADE_MESES;
  if (!raw) return DEFAULT_MAX_IDADE_MESES;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_IDADE_MESES;
}

/**
 * Extrai decisões aprovadas de um tribunal (TCE-PE, TCE-RS, STJ, etc.) que
 * caíram na janela de `windowDays` e ainda não foram enviadas no clipping
 * (skip via `alreadySentKeys`).
 *
 * Duas datas diferentes, com papéis diferentes:
 *
 * - `createdAt` (janela de `windowDays`) responde "isto é novidade PARA NÓS?".
 *   Não pode ser trocado por `dataJulgamento`: os conectores do STF e do STJ
 *   coletam uma vez por mês, então um acórdão chega ao banco 30 a 35 dias
 *   depois de julgado e nunca caberia numa janela de 14 dias medida pela data
 *   de julgamento — os dois tribunais sumiriam do clipping.
 * - `dataJulgamento` (teto de `maxIdadeMeses`) responde "isto ainda é notícia?".
 *   Sem ele, um backfill de acervo torna elegível o histórico inteiro de uma
 *   vez, e o clipping *diário* passa a enviar julgado de 2022 como se fosse do
 *   dia. Foi o que aconteceu com o STF (210 elegíveis) e com o STJ (262) —
 *   medido em 19/08/2026.
 *
 * Decisão sem `dataJulgamento` fica de fora: não há como afirmar que é recente.
 * Hoje isso só alcança 529 registros do TST, que já estão fora do clipping por
 * outros motivos.
 */
export async function fetchTribunalItems(
  params: FetchTribunalItemsParams
): Promise<ClippingItem[]> {
  const {
    tribunalCode,
    windowDays,
    alreadySentKeys,
    limit,
    minRelevanceScore = DEFAULT_MIN_RELEVANCE,
    maxIdadeMeses = maxIdadeMesesDoAmbiente(),
  } = params;

  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const julgadoDesde = new Date();
  julgadoDesde.setMonth(julgadoDesde.getMonth() - maxIdadeMeses);

  const rows = await prisma.tribunalDecision.findMany({
    where: {
      // Case-insensitive: defesa em profundidade contra split de case histórico
      // no tribunalCode (decisões legadas minúsculas vs canônico maiúsculo).
      tribunalCode: { equals: tribunalCode, mode: 'insensitive' },
      approvalStatus: { in: APPROVED_STATUSES },
      createdAt: { gte: since },
      dataJulgamento: { gte: julgadoDesde },
      relevanceScore: { gte: minRelevanceScore },
    },
    select: {
      id: true,
      tribunalCode: true,
      tribunalName: true,
      decisionType: true,
      decisionNumber: true,
      title: true,
      ementa: true,
      fullText: true,
      relator: true,
      orgaoJulgador: true,
      dataJulgamento: true,
      url: true,
      pdfUrl: true,
      relevanceScore: true,
      createdAt: true,
    },
    orderBy: [
      { relevanceScore: 'desc' },
      { dataJulgamento: 'desc' },
    ],
  });

  const items: ClippingItem[] = [];
  for (const r of rows) {
    const item: ClippingItem = {
      sourceKind: 'tribunal-decision',
      sourceId: r.id,
      tribunalCode: r.tribunalCode,
      tribunalName: r.tribunalName,
      decisionType: r.decisionType,
      decisionNumber: r.decisionNumber,
      title: r.title,
      dataJulgamento: r.dataJulgamento,
      relator: r.relator,
      orgaoJulgador: r.orgaoJulgador,
      ementa: r.ementa,
      fullText: r.fullText,
      linkExternal: r.url,
      linkPdf: r.pdfUrl,
      relevanceScore: r.relevanceScore,
      publishedAt: r.createdAt,
    };

    if (alreadySentKeys && alreadySentKeys.has(sentRefKey(item))) continue;
    items.push(item);
    if (limit && items.length >= limit) break;
  }

  return items;
}
