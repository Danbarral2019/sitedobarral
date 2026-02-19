import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { handleApiError } from '@/lib/errors/error-handler';
import { ValidationError } from '@/lib/errors/api-error';

/**
 * POST /api/admin/tribunal-decisions/bulk-approve
 * Aprovar ou rejeitar múltiplas decisões de uma vez
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

    const result = await prisma.tribunalDecision.updateMany({
      where: { id: { in: ids } },
      data: {
        approvalStatus: action === 'approve' ? 'manually_approved' : 'manually_rejected',
        reviewedBy: authResult.user?.email || authResult.user?.userId || 'admin',
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
