import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { apiLogger } from "@/lib/logger";

/**
 * GET /api/admin/dou/auto-approved
 * Retorna documentos DOU auto-aprovados que ainda não foram validados manualmente
 *
 * Critérios:
 * - approvalStatus: 'auto_approved' (classificados como alta relevância)
 * - imported: false (ainda não validados manualmente)
 * - isRelevant: true (confirmado como relevante)
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

    // Buscar documentos auto-aprovados não validados
    const autoApprovedDocs = await prisma.dOUStagingDocument.findMany({
      where: {
        approvalStatus: 'auto_approved',
        imported: false,
        isRelevant: true,
      },
      orderBy: [
        { confidence: 'desc' },  // Maior confiança primeiro
        { createdAt: 'desc' },   // Mais recentes primeiro
      ],
      take: 100, // Limitar a 100 documentos
    });

    // Formatar resposta
    const formatted = autoApprovedDocs.map(doc => ({
      id: doc.id,
      douId: doc.douId,
      title: doc.title,
      abstract: doc.abstract,
      url: doc.url,
      section: doc.section,
      publishDate: doc.publishDate, // STRING no formato DD/MM/YYYY
      category: doc.category,
      confidence: doc.confidence,
      hierarchyStr: doc.hierarchyStr || '',
      approvalStatus: doc.approvalStatus,
      isRelevant: doc.isRelevant,
      requiresReview: doc.requiresReview,
      reasoning: doc.reasoning,
      createdAt: doc.createdAt.toISOString(),
      // Campos adicionais úteis para exibição
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
    apiLogger.error({ err: error }, '[DOU Auto-Approved] Error:');
    return NextResponse.json(
      {
        error: 'Failed to fetch auto-approved documents',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
