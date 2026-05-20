import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { handleApiError } from '@/lib/errors/error-handler';

/**
 * GET /api/admin/tribunal-decisions/pending
 * Lista decisões pendentes de aprovação, ordenadas por relevância
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '10', 10)));

    const where = { approvalStatus: 'pending' };

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
          leiArticles: true, leiArticlesArr: true,
          url: true,
          relevanceScore: true,
          confidence: true,
          classificationReasoning: true,
          createdAt: true,
        },
        orderBy: [
          { relevanceScore: 'desc' },
          { createdAt: 'desc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.tribunalDecision.count({ where }),
    ]);

    return NextResponse.json({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
