import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/api-middleware';
import { safeParseArray } from '@/lib/utils';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck.error) return adminCheck.response;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)));
  const ambiguousOnly = searchParams.get('ambiguous') === 'true';
  const minScore = searchParams.get('minScore') ? parseInt(searchParams.get('minScore')!, 10) : undefined;
  const maxScore = searchParams.get('maxScore') ? parseInt(searchParams.get('maxScore')!, 10) : undefined;
  const actType = searchParams.get('actType') || undefined;
  const source = searchParams.get('source') || undefined;
  const ids = searchParams.get('staging_ids')?.split(',').map((s) => s.trim()).filter(Boolean) || [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    finalDecision: null,           // não revisado
    imported: false,
    // só itens v2 (têm classificação editorial)
    editorialScore: { not: null },
  };
  if (ambiguousOnly) where.editorialAmbiguous = true;
  // Spread preserves the baseline { not: null } from the where init above.
  if (minScore !== undefined) where.editorialScore = { ...(where.editorialScore || {}), gte: minScore };
  if (maxScore !== undefined) where.editorialScore = { ...(where.editorialScore || {}), lte: maxScore };
  if (actType) where.editorialActType = actType;
  if (source) where.source = source;
  if (ids.length > 0) where.id = { in: ids };

  const [total, items, lastCron] = await Promise.all([
    prisma.dOUStagingDocument.count({ where }),
    prisma.dOUStagingDocument.findMany({
      where,
      orderBy: [{ editorialScore: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.dOUStagingDocument.findFirst({
      where: { source: 'cron', editorialClassifiedAt: { not: null } },
      orderBy: { editorialClassifiedAt: 'desc' },
      select: { editorialClassifiedAt: true },
    }),
  ]);

  return NextResponse.json({
    items: items.map((s) => ({
      id: s.id,
      title: s.title,
      abstract: s.abstract,
      url: s.url,
      hierarchyStr: s.hierarchyStr,
      publishDate: s.publishDate,
      score: s.editorialScore,
      reason: s.editorialReason,
      summary: s.editorialSummary,
      affects: safeParseArray(s.editorialAffects),
      actType: s.editorialActType,
      ambiguous: s.editorialAmbiguous,
      model: s.editorialModel,
      promptVersion: s.editorialPromptVer,
      source: s.source,
      createdAt: s.createdAt,
    })),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    lastCronAt: lastCron?.editorialClassifiedAt ?? null,
  });
}
