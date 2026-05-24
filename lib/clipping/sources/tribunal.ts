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
}

const DEFAULT_MIN_RELEVANCE = 55;
const APPROVED_STATUSES = ['auto_approved', 'manually_approved'];

/**
 * Extrai decisões aprovadas de um tribunal (TCE-PE, TCE-RS, STJ, etc.) que
 * caíram na janela de `windowDays` e ainda não foram enviadas no clipping
 * (skip via `alreadySentKeys`).
 *
 * Usa `createdAt` (não `updatedAt`) para a janela — evita que decisões
 * reclassificadas retroativamente para `auto_approved` apareçam fora do
 * intervalo correto.
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
  } = params;

  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const rows = await prisma.tribunalDecision.findMany({
    where: {
      // Case-insensitive: defesa em profundidade contra split de case histórico
      // no tribunalCode (decisões legadas minúsculas vs canônico maiúsculo).
      tribunalCode: { equals: tribunalCode, mode: 'insensitive' },
      approvalStatus: { in: APPROVED_STATUSES },
      createdAt: { gte: since },
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
