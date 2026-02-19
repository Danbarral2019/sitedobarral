import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

/**
 * GET /api/admin/dou/pending
 * Retorna documentos DOU pendentes de aprovação (status='pending')
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação de admin
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Buscar documentos pendentes
    const pendingDocs = await prisma.dOUStagingDocument.findMany({
      where: {
        approvalStatus: 'pending'
      },
      orderBy: {
        publishDate: 'desc'
      },
      take: 50, // Limitar a 50 documentos pendentes
    });

    // Formatar resposta
    const formatted = pendingDocs.map(doc => ({
      id: doc.id,
      douId: doc.douId,
      title: doc.title,
      abstract: doc.abstract,
      url: doc.url,
      section: doc.section,
      publishDate: doc.publishDate,
      category: doc.category,
      confidence: doc.confidence,
      hierarchyStr: doc.hierarchyStr || '',
      approvalStatus: doc.approvalStatus,
      isRelevant: doc.isRelevant,
      requiresReview: doc.requiresReview,
      reasoning: doc.reasoning,
      createdAt: doc.createdAt.toISOString(),
      fullContent: doc.fullContent,
      organ: doc.organ,
      edition: doc.edition,
      page: doc.page,
    }));

    return NextResponse.json({
      success: true,
      count: formatted.length,
      documents: formatted,
    });

  } catch (error) {
    console.error('[DOU Pending] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending documents' },
      { status: 500 }
    );
  }
}
