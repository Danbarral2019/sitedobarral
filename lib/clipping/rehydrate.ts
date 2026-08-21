import { prisma } from '@/lib/prisma';
import type { ClippingItem } from './sources/types';
import type { SentItemRef } from './sent-history';
import type { ClippingGroup, ClippingItemRendered } from '@/lib/email-templates/daily-clipping';
import type { Dispositivo } from './dispositivo-extractor';

/**
 * Reconstrói os itens de um envio já feito, a partir das referências gravadas
 * em `DailyClippingSend.acordaoIdsIncluded`.
 *
 * Resolve as DUAS origens que o clipping multi-tribunal usa — `document-tcu`
 * vive em `Document` (modelo legado, com os campos `tcu*`) e
 * `tribunal-decision` vive em `TribunalDecision` — e devolve o mesmo
 * `ClippingGroup[]` que o e-mail consome, para que arquivo e e-mail mostrem a
 * mesma coisa sem duas implementações do mesmo conteúdo.
 *
 * Leitura pura: os bullets de IA já foram gerados e persistidos no envio, então
 * aqui eles são apenas lidos do cache. Abrir o arquivo nunca chama LLM.
 */

const TCU_TRIBUNAL_NAME = 'Tribunal de Contas da União';

function parseAiBullets(raw: string | null | undefined): string[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return undefined;
    const filtered = parsed.filter((s): s is string => typeof s === 'string');
    return filtered.length > 0 ? filtered : undefined;
  } catch {
    return undefined;
  }
}

function parseDispositivos(raw: unknown): Dispositivo[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.filter(
      (d): d is Dispositivo =>
        typeof d === 'object' &&
        d !== null &&
        typeof (d as Dispositivo).numero === 'string' &&
        typeof (d as Dispositivo).texto === 'string'
    );
  }
  if (typeof raw === 'string') {
    try {
      return parseDispositivos(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  return [];
}

const DOC_SELECT = {
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
  clippingExtract: { select: { dispositivos: true, extractMethod: true, aiBullets: true } },
} as const;

const TRIBUNAL_SELECT = {
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
  aiBullets: true,
} as const;

type DocRow = {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  url: string | null;
  tcuNumeroAcordao: string | null;
  tcuEmentaCompleta: string | null;
  tcuRelator: string | null;
  tcuOrgaoJulgador: string | null;
  tcuLinkPDF: string | null;
  tcuDataJulgamento: Date | null;
  uploadedAt: Date;
  clippingExtract: { dispositivos: unknown; extractMethod: string; aiBullets?: string | null } | null;
};

type TribunalRow = {
  id: string;
  tribunalCode: string;
  tribunalName: string;
  decisionType: string;
  decisionNumber: string;
  title: string;
  ementa: string;
  fullText: string | null;
  relator: string | null;
  orgaoJulgador: string | null;
  dataJulgamento: Date | null;
  url: string | null;
  pdfUrl: string | null;
  relevanceScore: number | null;
  createdAt: Date;
  aiBullets: string | null;
};

function docToRendered(d: DocRow): ClippingItemRendered {
  const item: ClippingItem = {
    sourceKind: 'document-tcu',
    sourceId: d.id,
    tribunalCode: 'TCU',
    tribunalName: TCU_TRIBUNAL_NAME,
    decisionType: 'acordao',
    decisionNumber: d.tcuNumeroAcordao || d.title || '',
    title: d.title,
    dataJulgamento: d.tcuDataJulgamento,
    relator: d.tcuRelator,
    orgaoJulgador: d.tcuOrgaoJulgador || 'TCU',
    ementa: (d.tcuEmentaCompleta || d.description || '').trim(),
    fullText: d.content,
    linkExternal: d.url,
    linkPdf: d.tcuLinkPDF,
    relevanceScore: null,
    publishedAt: d.uploadedAt,
  };
  return {
    item,
    aiBullets: parseAiBullets(d.clippingExtract?.aiBullets),
    dispositivos: parseDispositivos(d.clippingExtract?.dispositivos),
  };
}

function tribunalToRendered(t: TribunalRow): ClippingItemRendered {
  const item: ClippingItem = {
    sourceKind: 'tribunal-decision',
    sourceId: t.id,
    tribunalCode: t.tribunalCode,
    tribunalName: t.tribunalName,
    decisionType: t.decisionType,
    decisionNumber: t.decisionNumber,
    title: t.title,
    dataJulgamento: t.dataJulgamento,
    relator: t.relator,
    orgaoJulgador: t.orgaoJulgador,
    ementa: t.ementa,
    fullText: t.fullText,
    linkExternal: t.url,
    linkPdf: t.pdfUrl,
    relevanceScore: t.relevanceScore,
    publishedAt: t.createdAt,
  };
  return { item, aiBullets: parseAiBullets(t.aiBullets) };
}

export interface RehydratedSend {
  groups: ClippingGroup[];
  /** Referências que não existem mais em nenhuma das duas tabelas. */
  missingIds: string[];
}

/**
 * Busca as duas tabelas de uma vez e devolve os itens agrupados por tribunal,
 * na ordem em que os tribunais aparecem no envio (que é a ordem do e-mail).
 */
export async function rehydrateSentItems(refs: SentItemRef[]): Promise<RehydratedSend> {
  if (refs.length === 0) return { groups: [], missingIds: [] };

  const docIds = refs.filter((r) => r.kind === 'document-tcu').map((r) => r.id);
  const tribunalIds = refs.filter((r) => r.kind === 'tribunal-decision').map((r) => r.id);

  const [docs, decisoes] = await Promise.all([
    docIds.length
      ? (prisma.document.findMany({ where: { id: { in: docIds } }, select: DOC_SELECT }) as Promise<DocRow[]>)
      : Promise.resolve([] as DocRow[]),
    tribunalIds.length
      ? (prisma.tribunalDecision.findMany({
          where: { id: { in: tribunalIds } },
          select: TRIBUNAL_SELECT,
        }) as Promise<TribunalRow[]>)
      : Promise.resolve([] as TribunalRow[]),
  ]);

  const docMap = new Map(docs.map((d) => [d.id, d]));
  const tribunalMap = new Map(decisoes.map((t) => [t.id, t]));

  const groups: ClippingGroup[] = [];
  const groupIndex = new Map<string, ClippingGroup>();
  const missingIds: string[] = [];
  const jaVisto = new Set<string>();

  for (const ref of refs) {
    // Envios antigos podem repetir o mesmo id (race no sync); mostrar uma vez só.
    const chave = `${ref.kind}:${ref.id}`;
    if (jaVisto.has(chave)) continue;
    jaVisto.add(chave);

    let rendered: ClippingItemRendered | null = null;
    if (ref.kind === 'document-tcu') {
      const d = docMap.get(ref.id);
      if (d) rendered = docToRendered(d);
    } else {
      const t = tribunalMap.get(ref.id);
      if (t) rendered = tribunalToRendered(t);
    }

    if (!rendered) {
      missingIds.push(ref.id);
      continue;
    }

    const code = rendered.item.tribunalCode;
    let group = groupIndex.get(code);
    if (!group) {
      group = { tribunalCode: code, tribunalName: rendered.item.tribunalName, items: [] };
      groupIndex.set(code, group);
      groups.push(group);
    }
    group.items.push(rendered);
  }

  return { groups, missingIds };
}
