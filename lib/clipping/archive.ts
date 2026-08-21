import { prisma } from '@/lib/prisma';
import type { ClippingGroup } from '@/lib/email-templates/daily-clipping';
import { identificacaoDoJulgado } from '@/lib/email-templates/daily-clipping';
import { parseSentItemsPayload } from '@/lib/clipping/sent-history';
import { rehydrateSentItems } from '@/lib/clipping/rehydrate';

const BR_TZ_OFFSET_HOURS = 3;

export function startOfBrasiliaDay(date: Date): Date {
  const offsetMs = BR_TZ_OFFSET_HOURS * 60 * 60 * 1000;
  const local = new Date(date.getTime() - offsetMs);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() + offsetMs);
}

export function parseSentDateParam(dateStr: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return null;
  const [, y, mo, d] = m;
  const candidate = startOfBrasiliaDay(new Date(`${y}-${mo}-${d}T12:00:00Z`));
  if (Number.isNaN(candidate.getTime())) return null;
  return candidate;
}

export function formatSentDateParam(date: Date): string {
  const local = new Date(date.getTime() - BR_TZ_OFFSET_HOURS * 60 * 60 * 1000);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, '0');
  const d = String(local.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function referenceDateFromSentDate(sentDate: Date): Date {
  return new Date(sentDate.getTime() - 24 * 60 * 60 * 1000);
}

export interface ArchiveEntrySummary {
  sentDate: Date;
  status: string;
  acordaoCount: number;
  totalSent: number | null;
  preview: string;
}

export async function listArchiveEntries(opts: {
  limit?: number;
  offset?: number;
} = {}): Promise<{ entries: ArchiveEntrySummary[]; total: number }> {
  const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100);
  const offset = Math.max(opts.offset ?? 0, 0);

  const [rows, total] = await Promise.all([
    prisma.dailyClippingSend.findMany({
      where: { status: { in: ['success', 'partial'] }, acordaoCount: { gt: 0 } },
      orderBy: { sentDate: 'desc' },
      skip: offset,
      take: limit,
      select: {
        sentDate: true,
        status: true,
        acordaoCount: true,
        totalSent: true,
        acordaoIdsIncluded: true,
      },
    }),
    prisma.dailyClippingSend.count({
      where: { status: { in: ['success', 'partial'] }, acordaoCount: { gt: 0 } },
    }),
  ]);

  const allRefs = rows.flatMap((r) => parseSentItemsPayload(r.acordaoIdsIncluded));
  const previewMap = new Map<string, string>();

  const docIds = allRefs.filter((r) => r.kind === 'document-tcu').map((r) => r.id);
  const tribunalIds = allRefs.filter((r) => r.kind === 'tribunal-decision').map((r) => r.id);

  if (docIds.length > 0) {
    const docs = await prisma.document.findMany({
      where: { id: { in: docIds } },
      select: {
        id: true,
        title: true,
        tcuNumeroAcordao: true,
        tcuOrgaoJulgador: true,
        tcuEmentaCompleta: true,
      },
    });
    for (const d of docs) {
      const rotulo = identificacaoDoJulgado({
        title: d.title,
        decisionNumber: d.tcuNumeroAcordao || d.title || '',
        tribunalCode: 'TCU',
        tribunalName: 'Tribunal de Contas da União',
        orgaoJulgador: d.tcuOrgaoJulgador,
      });
      const ementa = (d.tcuEmentaCompleta || '').slice(0, 100);
      previewMap.set(`document-tcu:${d.id}`, rotulo ? `${rotulo}${ementa ? ` — ${ementa}` : ''}` : ementa);
    }
  }

  if (tribunalIds.length > 0) {
    const decisoes = await prisma.tribunalDecision.findMany({
      where: { id: { in: tribunalIds } },
      select: {
        id: true,
        title: true,
        decisionNumber: true,
        tribunalCode: true,
        tribunalName: true,
        orgaoJulgador: true,
        ementa: true,
      },
    });
    for (const t of decisoes) {
      const rotulo = identificacaoDoJulgado(t);
      const ementa = (t.ementa || '').slice(0, 100);
      previewMap.set(
        `tribunal-decision:${t.id}`,
        rotulo ? `${rotulo}${ementa ? ` — ${ementa}` : ''}` : ementa
      );
    }
  }

  const entries: ArchiveEntrySummary[] = rows.map((r) => {
    const refs = parseSentItemsPayload(r.acordaoIdsIncluded);
    const previews = refs
      .map((ref) => previewMap.get(`${ref.kind}:${ref.id}`))
      .filter((s): s is string => Boolean(s));
    const preview = previews.slice(0, 2).join(' · ');
    return {
      sentDate: r.sentDate,
      status: r.status,
      acordaoCount: r.acordaoCount,
      totalSent: r.totalSent ?? null,
      preview: preview || '(sem preview)',
    };
  });

  return { entries, total };
}

export interface ArchiveEntryDetail {
  sentDate: Date;
  referenceDate: Date;
  status: string;
  /**
   * Itens do envio agrupados por tribunal — o mesmo shape que o e-mail consome.
   * Substituiu o antigo `acordaos: ClippingAcordao[]`, que só sabia representar
   * o TCU e deixava de fora os itens de `TribunalDecision`.
   */
  groups: ClippingGroup[];
  /** Ids que não existem mais em nenhuma das duas tabelas. */
  missingIds: string[];
}

export async function getArchiveEntry(sentDate: Date): Promise<ArchiveEntryDetail | null> {
  const send = await prisma.dailyClippingSend.findUnique({
    where: { sentDate },
    select: {
      sentDate: true,
      status: true,
      acordaoIdsIncluded: true,
    },
  });
  if (!send) return null;

  const refs = parseSentItemsPayload(send.acordaoIdsIncluded);
  const { groups, missingIds } = await rehydrateSentItems(refs);

  return {
    sentDate: send.sentDate,
    referenceDate: referenceDateFromSentDate(send.sentDate),
    status: send.status,
    groups,
    missingIds,
  };
}

export interface ArchiveSearchHit {
  sentDate: Date;
  acordaoCount: number;
  matchedNumeros: string[];
  snippet: string;
}

export async function searchArchive(query: string, limit = 30): Promise<ArchiveSearchHit[]> {
  const term = query.trim();
  if (term.length < 2) return [];

  // As duas origens do clipping: TCU vive em `Document`, os demais tribunais em
  // `TribunalDecision`. Buscar só a primeira deixava os envios multi-tribunal
  // fora do resultado.
  const [matchingDocs, matchingDecisions] = await Promise.all([
    prisma.document.findMany({
      where: {
        category: 'acordao',
        OR: [
          { title: { contains: term, mode: 'insensitive' } },
          { tcuEmentaCompleta: { contains: term, mode: 'insensitive' } },
          { tcuNumeroAcordao: { contains: term, mode: 'insensitive' } },
        ],
      },
      select: { id: true, title: true, tcuNumeroAcordao: true, tcuEmentaCompleta: true },
      take: 200,
    }),
    prisma.tribunalDecision.findMany({
      where: {
        OR: [
          { title: { contains: term, mode: 'insensitive' } },
          { ementa: { contains: term, mode: 'insensitive' } },
          { decisionNumber: { contains: term, mode: 'insensitive' } },
        ],
      },
      select: { id: true, title: true, decisionNumber: true, ementa: true },
      take: 200,
    }),
  ]);

  if (matchingDocs.length === 0 && matchingDecisions.length === 0) return [];

  // Chaveado por "<kind>:<id>" para que um id de Document nunca case com um id
  // de TribunalDecision.
  const rotuloPorChave = new Map<string, { rotulo: string; ementa: string }>();
  for (const d of matchingDocs) {
    rotuloPorChave.set(`document-tcu:${d.id}`, {
      rotulo: d.tcuNumeroAcordao || d.title || '',
      ementa: d.tcuEmentaCompleta || '',
    });
  }
  for (const t of matchingDecisions) {
    rotuloPorChave.set(`tribunal-decision:${t.id}`, {
      rotulo: t.title || t.decisionNumber || '',
      ementa: t.ementa || '',
    });
  }

  const sends = await prisma.dailyClippingSend.findMany({
    where: { status: { in: ['success', 'partial'] }, acordaoCount: { gt: 0 } },
    orderBy: { sentDate: 'desc' },
    select: { sentDate: true, acordaoCount: true, acordaoIdsIncluded: true },
  });

  const hits: ArchiveSearchHit[] = [];
  for (const s of sends) {
    const refs = parseSentItemsPayload(s.acordaoIdsIncluded);
    const matched = refs
      .map((ref) => rotuloPorChave.get(`${ref.kind}:${ref.id}`))
      .filter((v): v is { rotulo: string; ementa: string } => Boolean(v));
    if (matched.length === 0) continue;

    hits.push({
      sentDate: s.sentDate,
      acordaoCount: s.acordaoCount,
      matchedNumeros: matched.map((m) => m.rotulo).filter(Boolean),
      snippet: (matched[0].ementa || '').slice(0, 200),
    });
    if (hits.length >= limit) break;
  }
  return hits;
}

export async function userIsEligibleForClipping(userId: string): Promise<boolean> {
  const now = new Date();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      clippingOptOut: true,
      emailVerified: true,
      subscriptions: {
        where: { status: 'active', currentPeriodEnd: { gt: now } },
        select: { id: true },
        take: 1,
      },
      enrollments: {
        where: { OR: [{ isLifetime: true }, { expiresAt: { gt: now } }] },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (!user.emailVerified) return false;
  return user.subscriptions.length > 0 || user.enrollments.length > 0;
}
