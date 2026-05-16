import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { handleApiError } from '@/lib/errors/error-handler';
import { ValidationError, NotFoundError } from '@/lib/errors/api-error';
import { generateDecisionSummary } from '@/lib/tribunal-scrapers/classifier';
import { apiLogger } from "@/lib/logger";

/**
 * POST /api/admin/tribunal-decisions/approve
 * Aprovar ou rejeitar uma decisão individual
 * Gera resumo IA automaticamente ao aprovar (se ausente)
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, action, adminNotes } = body;

    if (!id || !action) {
      throw new ValidationError('Campos "id" e "action" são obrigatórios');
    }

    if (!['approve', 'reject'].includes(action)) {
      throw new ValidationError('action deve ser "approve" ou "reject"');
    }

    const decision = await prisma.tribunalDecision.findUnique({ where: { id } });
    if (!decision) {
      throw new NotFoundError('Decisão não encontrada');
    }

    // Gerar resumo IA ao aprovar se ainda não tem
    let summary = decision.summary;
    if (action === 'approve' && !summary) {
      try {
        summary = await generateDecisionSummary({
          title: decision.title,
          ementa: decision.ementa,
          fullText: decision.fullText || undefined,
          decisionType: decision.decisionType,
        });
      } catch (err) {
        apiLogger.error({ err: err }, '[approve] Failed to generate summary:');
      }
    }

    const updated = await prisma.tribunalDecision.update({
      where: { id },
      data: {
        approvalStatus: action === 'approve' ? 'manually_approved' : 'manually_rejected',
        reviewedBy: authResult.user?.email || authResult.user?.userId || 'admin',
        reviewedAt: new Date(),
        adminNotes: adminNotes || null,
        ...(summary !== decision.summary ? { summary } : {}),
      },
    });

    return NextResponse.json({
      success: true,
      id: updated.id,
      approvalStatus: updated.approvalStatus,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
