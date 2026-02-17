import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminAuth } from '@/lib/api-middleware';

/**
 * GET /api/admin/tcu-highlights
 * Lista destaques TCU com filtros e paginação
 * Query: status, page, pageSize, countOnly
 */
export const GET = withAdminAuth(async (request: NextRequest) => {
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
    const count = await prisma.tcuHighlight.count({
      where: { status: 'pending' },
    });
    return NextResponse.json({ count });
  }

  const [highlights, total] = await Promise.all([
    prisma.tcuHighlight.findMany({
      where,
      include: {
        document: {
          select: {
            id: true,
            title: true,
            url: true,
            description: true,
            acordaoNumero: true,
            acordaoAno: true,
            leiArticles: true,
            metaTcu: {
              select: {
                relator: true,
                orgaoJulgador: true,
                dataJulgamento: true,
                area: true,
                tema: true,
                subtema: true,
              },
            },
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
    prisma.tcuHighlight.count({ where }),
  ]);

  // Contagens por status
  const [pending, dismissed, willWrite, written] = await Promise.all([
    prisma.tcuHighlight.count({ where: { status: 'pending' } }),
    prisma.tcuHighlight.count({ where: { status: 'dismissed' } }),
    prisma.tcuHighlight.count({ where: { status: 'will_write' } }),
    prisma.tcuHighlight.count({ where: { status: 'written' } }),
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
