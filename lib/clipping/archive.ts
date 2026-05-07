import { prisma } from '@/lib/prisma';
import type { ClippingAcordao } from '@/lib/email-templates/daily-clipping';
import type { Dispositivo } from '@/lib/clipping/dispositivo-extractor';

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

type DocSelect = {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  tcuNumeroAcordao: string | null;
  tcuEmentaCompleta: string | null;
  tcuRelator: string | null;
  tcuOrgaoJulgador: string | null;
  tcuLinkPDF: string | null;
  tcuDataJulgamento: Date | null;
  clippingExtract: {
    dispositivos: unknown;
    extractMethod: string;
  } | null;
};

export const ACORDAO_SELECT = {
  id: true,
  title: true,
  description: true,
  url: true,
  tcuNumeroAcordao: true,
  tcuEmentaCompleta: true,
  tcuRelator: true,
  tcuOrgaoJulgador: true,
  tcuLinkPDF: true,
  tcuDataJulgamento: true,
  clippingExtract: { select: { dispositivos: true, extractMethod: true } },
} as const;

export function mapDocToAcordao(doc: DocSelect): ClippingAcordao {
  return {
    documentId: doc.id,
    numeroAcordao: doc.tcuNumeroAcordao || doc.title || '',
    colegiado: doc.tcuOrgaoJulgador || 'TCU',
    relator: doc.tcuRelator,
    dataSessao: doc.tcuDataJulgamento,
    ementa: (doc.tcuEmentaCompleta || doc.description || '').trim(),
    linkPdf: doc.tcuLinkPDF,
    linkInternal: doc.url,
    dispositivos: (doc.clippingExtract?.dispositivos as Dispositivo[] | undefined) ?? [],
    extractMethod:
      (doc.clippingExtract?.extractMethod as ClippingAcordao['extractMethod'] | undefined) ?? 'failed',
  };
}

function parseAcordaoIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
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

  const allIds = rows.flatMap((r) => parseAcordaoIds(r.acordaoIdsIncluded));
  const previewMap = new Map<string, string>();
  if (allIds.length > 0) {
    const docs = await prisma.document.findMany({
      where: { id: { in: allIds } },
      select: { id: true, title: true, tcuNumeroAcordao: true, tcuEmentaCompleta: true },
    });
    for (const d of docs) {
      const num = d.tcuNumeroAcordao || d.title;
      const ementa = (d.tcuEmentaCompleta || '').slice(0, 100);
      previewMap.set(d.id, num ? `${num}${ementa ? ` — ${ementa}` : ''}` : ementa);
    }
  }

  const entries: ArchiveEntrySummary[] = rows.map((r) => {
    const ids = parseAcordaoIds(r.acordaoIdsIncluded);
    const previews = ids
      .map((id) => previewMap.get(id))
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
  acordaos: ClippingAcordao[];
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
  const ids = parseAcordaoIds(send.acordaoIdsIncluded);
  if (ids.length === 0) {
    return {
      sentDate: send.sentDate,
      referenceDate: referenceDateFromSentDate(send.sentDate),
      status: send.status,
      acordaos: [],
      missingIds: [],
    };
  }

  const docs = await prisma.document.findMany({
    where: { id: { in: ids } },
    select: ACORDAO_SELECT,
  });
  const docMap = new Map(docs.map((d) => [d.id, d]));
  const acordaos: ClippingAcordao[] = [];
  const missingIds: string[] = [];
  for (const id of ids) {
    const doc = docMap.get(id);
    if (doc) acordaos.push(mapDocToAcordao(doc));
    else missingIds.push(id);
  }
  return {
    sentDate: send.sentDate,
    referenceDate: referenceDateFromSentDate(send.sentDate),
    status: send.status,
    acordaos,
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

  const matchingDocs = await prisma.document.findMany({
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
  });
  if (matchingDocs.length === 0) return [];
  const matchedIds = new Set(matchingDocs.map((d) => d.id));
  const docMap = new Map(matchingDocs.map((d) => [d.id, d]));

  const sends = await prisma.dailyClippingSend.findMany({
    where: { status: { in: ['success', 'partial'] }, acordaoCount: { gt: 0 } },
    orderBy: { sentDate: 'desc' },
    select: { sentDate: true, acordaoCount: true, acordaoIdsIncluded: true },
  });

  const hits: ArchiveSearchHit[] = [];
  for (const s of sends) {
    const ids = parseAcordaoIds(s.acordaoIdsIncluded);
    const matched = ids.filter((id) => matchedIds.has(id));
    if (matched.length === 0) continue;
    const matchedNumeros = matched
      .map((id) => docMap.get(id)?.tcuNumeroAcordao || docMap.get(id)?.title || '')
      .filter(Boolean);
    const firstEmenta = (docMap.get(matched[0])?.tcuEmentaCompleta || '').slice(0, 200);
    hits.push({
      sentDate: s.sentDate,
      acordaoCount: s.acordaoCount,
      matchedNumeros,
      snippet: firstEmenta,
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
