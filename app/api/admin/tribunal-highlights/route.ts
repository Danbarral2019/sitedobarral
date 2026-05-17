import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminApi } from '@/lib/api/handler';

/**
 * GET /api/admin/tribunal-highlights
 * Lista destaques TCE com filtros e paginação
 * Query: status, page, pageSize, countOnly
 */
export const GET = withAdminApi(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const countOnly = searchParams.get('countOnly') === 'true';
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '20');

  const where: Record<string, unknown> = {};
  if (status && ['pending', 'dismissed', 'will_write', 'written'].includes(status)) {
    where.status = status;
  }

  // Apenas contagem (para badge do menu)
  if (countOnly) {
    const count = await prisma.tribunalHighlight.count({
      where: { status: 'pending' },
    });
    return NextResponse.json({ count });
  }

  const [highlights, total] = await Promise.all([
    prisma.tribunalHighlight.findMany({
      where,
      include: {
        tribunalDecision: {
          select: {
            id: true,
            title: true,
            ementa: true,
            url: true,
            tribunalCode: true,
            tribunalName: true,
            decisionNumber: true,
            year: true,
            relator: true,
            orgaoJulgador: true,
            dataJulgamento: true,
            leiArticles: true,
            themes: true,
          },
        },
      },
      orderBy: [
        { status: 'asc' },
        { aiArticleWorthiness: 'desc' },
        { createdAt: 'desc' },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.tribunalHighlight.count({ where }),
  ]);

  // Contagens por status
  const [pending, dismissed, willWrite, written] = await Promise.all([
    prisma.tribunalHighlight.count({ where: { status: 'pending' } }),
    prisma.tribunalHighlight.count({ where: { status: 'dismissed' } }),
    prisma.tribunalHighlight.count({ where: { status: 'will_write' } }),
    prisma.tribunalHighlight.count({ where: { status: 'written' } }),
  ]);

  return NextResponse.json({
    highlights,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    stats: { pending, dismissed, willWrite, written },
  });
});
