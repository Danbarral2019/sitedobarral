import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { handleApiError } from '@/lib/errors/error-handler';

/**
 * GET /api/admin/tribunal-decisions
 * Lista todas as decisões (admin) — sem filtro de approvalStatus por padrão
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    const tribunal = searchParams.get('tribunal');
    const ano = searchParams.get('ano');
    const tema = searchParams.get('tema');
    const artigo = searchParams.get('artigo');
    const q = searchParams.get('q');
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '10', 10)));

    const where: Record<string, unknown> = {};

    if (tribunal) where.tribunalCode = tribunal;
    if (ano) where.year = parseInt(ano, 10);
    if (status) where.approvalStatus = status;

    if (tema) {
      where.themes = { contains: tema, mode: 'insensitive' };
    }

    if (artigo) {
      where.leiArticles = { contains: artigo, mode: 'insensitive' };
    }

    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { ementa: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.tribunalDecision.findMany({
        where,
        select: {
          id: true,
          tribunalCode: true,
          tribunalName: true,
          decisionType: true,
          decisionNumber: true,
          title: true,
          ementa: true,
          relator: true,
          orgaoJulgador: true,
          dataJulgamento: true,
          themes: true,
          leiArticles: true,
          url: true,
          approvalStatus: true,
          relevanceScore: true,
          isRelevant: true,
          confidence: true,
          createdAt: true,
        },
        orderBy: [
          { createdAt: 'desc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.tribunalDecision.count({ where }),
    ]);

    const formatted = items.map(item => ({
      ...item,
      ementa: item.ementa.length > 300 ? item.ementa.slice(0, 300) + '...' : item.ementa,
    }));

    return NextResponse.json({
      items: formatted,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
