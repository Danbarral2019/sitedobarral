import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { handleApiError } from '@/lib/errors/error-handler';
import { ValidationError } from '@/lib/errors/api-error';
import { generateDecisionSummary } from '@/lib/tribunal-scrapers/classifier';

/**
 * POST /api/admin/tribunal-decisions/bulk-approve
 * Aprovar ou rejeitar múltiplas decisões de uma vez
 * Gera resumo IA automaticamente ao aprovar (se ausente)
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { ids, action } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      throw new ValidationError('Campo "ids" deve ser um array não vazio');
    }

    if (!['approve', 'reject'].includes(action)) {
      throw new ValidationError('action deve ser "approve" ou "reject"');
    }

    const reviewer = authResult.user?.email || authResult.user?.userId || 'admin';

    if (action === 'approve') {
      // Ao aprovar em lote, gerar resumo IA para decisões sem summary
      const decisions = await prisma.tribunalDecision.findMany({
        where: { id: { in: ids } },
        select: { id: true, title: true, ementa: true, fullText: true, decisionType: true, summary: true },
      });

      let updatedCount = 0;
      for (const d of decisions) {
        let summary = d.summary;
        if (!summary) {
          try {
            summary = await generateDecisionSummary({
              title: d.title,
              ementa: d.ementa,
              fullText: d.fullText || undefined,
              decisionType: d.decisionType,
            });
          } catch (err) {
            console.error(`[bulk-approve] Failed to generate summary for ${d.id}:`, err);
          }
        }
        await prisma.tribunalDecision.update({
          where: { id: d.id },
          data: {
            approvalStatus: 'manually_approved',
            reviewedBy: reviewer,
            reviewedAt: new Date(),
            ...(summary !== d.summary ? { summary } : {}),
          },
        });
        updatedCount++;
      }

      return NextResponse.json({ success: true, updatedCount });
    }

    // Rejeição em lote — sem necessidade de gerar summary
    const result = await prisma.tribunalDecision.updateMany({
      where: { id: { in: ids } },
      data: {
        approvalStatus: 'manually_rejected',
        reviewedBy: reviewer,
        reviewedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      updatedCount: result.count,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
