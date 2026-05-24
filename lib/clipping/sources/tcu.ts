import { prisma } from '@/lib/prisma';
import { analyzeRelevanceTCU } from '@/lib/tcu-module';
import { sentRefKey, type ClippingItem } from './types';

const TCU_RELEVANCE_THRESHOLD = 15;
const TCU_TRIBUNAL_NAME = 'Tribunal de Contas da União';

export interface FetchTcuItemsParams {
  since: Date;
  until: Date;
  alreadySentKeys?: Set<string>;
  limit?: number;
}

/**
 * Extrai acórdãos do TCU da janela [since, until) que passam pelo
 * `analyzeRelevanceTCU` (score >= 15). Pipeline TCU original — não muda
 * comportamento, só normaliza o shape para ClippingItem.
 *
 * Os documentos vêm do modelo legado `Document` (category='acordao'),
 * com campos `tcu*` específicos.
 */
export async function fetchTcuItems(
  params: FetchTcuItemsParams
): Promise<ClippingItem[]> {
  const { since, until, alreadySentKeys, limit } = params;

  const candidates = await prisma.document.findMany({
    where: {
      category: 'acordao',
      uploadedAt: { gte: since, lt: until },
    },
    select: {
      id: true,
      title: true,
      description: true,
      content: true,
      url: true,
      tcuNumeroAcordao: true,
      tcuEmentaCompleta: true,
      tcuRelator: true,
      tcuOrgaoJulgador: true,
      tcuLinkPDF: true,
      tcuDataJulgamento: true,
      uploadedAt: true,
    },
    orderBy: [{ tcuDataJulgamento: 'desc' }, { uploadedAt: 'desc' }],
  });

  const items: ClippingItem[] = [];
  for (const c of candidates) {
    const ementa = (c.tcuEmentaCompleta || c.description || '').trim();
    const { score } = analyzeRelevanceTCU(c.title || '', ementa);
    if (score < TCU_RELEVANCE_THRESHOLD) continue;

    const item: ClippingItem = {
      sourceKind: 'document-tcu',
      sourceId: c.id,
      tribunalCode: 'TCU',
      tribunalName: TCU_TRIBUNAL_NAME,
      decisionType: 'acordao',
      decisionNumber: c.tcuNumeroAcordao || c.title || '',
      title: c.title,
      dataJulgamento: c.tcuDataJulgamento,
      relator: c.tcuRelator,
      orgaoJulgador: c.tcuOrgaoJulgador || 'TCU',
      ementa,
      fullText: c.content,
      linkExternal: c.url,
      linkPdf: c.tcuLinkPDF,
      relevanceScore: score,
      publishedAt: c.uploadedAt,
    };

    if (alreadySentKeys && alreadySentKeys.has(sentRefKey(item))) continue;
    items.push(item);
    if (limit && items.length >= limit) break;
  }

  return items;
}
