import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/errors/error-handler';

/**
 * GET /api/jurisprudencia
 * API pública de jurisprudência — retorna decisões aprovadas e relevantes
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const tribunal = searchParams.get('tribunal');
    const ano = searchParams.get('ano');
    const tema = searchParams.get('tema');
    const artigo = searchParams.get('artigo');
    const decisionType = searchParams.get('decisionType');
    const relator = searchParams.get('relator');
    const orgao = searchParams.get('orgao');
    const dataFrom = searchParams.get('dataFrom');
    const dataTo = searchParams.get('dataTo');
    const q = searchParams.get('q');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '10', 10)));

    const where: Record<string, unknown> = {
      isRelevant: true,
      approvalStatus: { in: ['auto_approved', 'manually_approved'] },
    };

    if (tribunal) {
      where.tribunalCode = tribunal;
    }

    if (ano) {
      where.year = parseInt(ano, 10);
    }

    if (tema) {
      where.themes = { contains: tema, mode: 'insensitive' };
    }

    if (artigo) {
      where.leiArticles = { contains: artigo, mode: 'insensitive' };
    }

    if (decisionType) {
      where.decisionType = decisionType;
    }

    if (relator) {
      where.relator = { contains: relator, mode: 'insensitive' };
    }

    if (orgao) {
      where.orgaoJulgador = { contains: orgao, mode: 'insensitive' };
    }

    if (dataFrom || dataTo) {
      const dateFilter: Record<string, Date> = {};
      if (dataFrom) dateFilter.gte = new Date(dataFrom);
      if (dataTo) dateFilter.lte = new Date(dataTo);
      where.dataJulgamento = dateFilter;
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
          summary: true,
          relator: true,
          orgaoJulgador: true,
          dataJulgamento: true,
          themes: true,
          leiArticles: true,
          url: true,
        },
        orderBy: [
          { dataJulgamento: { sort: 'desc', nulls: 'last' } },
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
