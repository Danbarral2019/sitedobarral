import { prisma } from '@/lib/prisma';
import { sentRefKey, type ClippingItem } from './sources/types';

export interface SentItemRef {
  kind: 'document-tcu' | 'tribunal-decision';
  id: string;
}

/**
 * Payload polimórfico armazenado em DailyClippingSend.acordaoIdsIncluded.
 *
 * Formato atual (multi-tribunal):
 *   { "v": 2, "items": [{"kind":"document-tcu","id":"..."}, {"kind":"tribunal-decision","id":"..."}] }
 *
 * Formato legado (TCU-only):
 *   ["doc-id-1", "doc-id-2"]   ← array de Document.id direto
 *
 * `parseSentItemsPayload` é tolerante a ambos.
 */
const PAYLOAD_VERSION = 2;

interface PayloadV2 {
  v: 2;
  items: SentItemRef[];
}

export function serializeSentItems(items: SentItemRef[]): string {
  const payload: PayloadV2 = { v: PAYLOAD_VERSION, items };
  return JSON.stringify(payload);
}

export function parseSentItemsPayload(raw: string | null | undefined): SentItemRef[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Legado: array de strings (Document.id, todos TCU)
      return parsed
        .filter((id): id is string => typeof id === 'string')
        .map(id => ({ kind: 'document-tcu' as const, id }));
    }
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.items)) {
      return parsed.items.filter(
        (i: unknown): i is SentItemRef =>
          !!i &&
          typeof i === 'object' &&
          'kind' in (i as object) &&
          'id' in (i as object) &&
          ((i as SentItemRef).kind === 'document-tcu' ||
            (i as SentItemRef).kind === 'tribunal-decision') &&
          typeof (i as SentItemRef).id === 'string'
      );
    }
  } catch {
    // payload inválido — trata como vazio
  }
  return [];
}

/**
 * Lê envios com `sentDate` >= now - windowDays e retorna um Set contendo
 * `"<kind>:<id>"` para cada item já enviado. Usado pelos source fetchers
 * para excluir itens já destacados em edições recentes.
 *
 * Ignora envios com `status='no_content'` ou `status='failed'` (sem efeito
 * real no aluno). Inclui `status='partial'` em andamento — sem isso,
 * rodadas duplas no mesmo dia repetiriam itens.
 */
export async function getSentIdsInWindow(windowDays: number): Promise<Set<string>> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const sends = await prisma.dailyClippingSend.findMany({
    where: {
      sentDate: { gte: since },
      status: { in: ['success', 'partial'] },
    },
    select: { acordaoIdsIncluded: true },
    orderBy: { sentDate: 'desc' },
  });

  const keys = new Set<string>();
  for (const s of sends) {
    const items = parseSentItemsPayload(s.acordaoIdsIncluded);
    for (const item of items) {
      keys.add(`${item.kind}:${item.id}`);
    }
  }
  return keys;
}

/** Constrói o payload de envio a partir de uma lista de ClippingItems. */
export function buildSentItemsPayload(items: ClippingItem[]): string {
  return serializeSentItems(
    items.map(i => ({ kind: i.sourceKind, id: i.sourceId }))
  );
}

export { sentRefKey };
