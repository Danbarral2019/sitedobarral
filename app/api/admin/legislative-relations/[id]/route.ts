import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminAuth } from '@/lib/api-middleware';
import { handleApiError } from '@/lib/errors/error-handler';

export const runtime = 'nodejs';

/**
 * PATCH — confirmar ou rejeitar uma relação detectada pelo detector heurístico.
 *
 * Body:
 *   { "action": "confirm" } → reviewStatus = "confirmed"
 *   { "action": "reject"  } → reviewStatus = "rejected" (mantém o registro pra auditoria)
 *
 * Pra DELETAR a relação completamente (não só rejeitar), use DELETE.
 */
export const PATCH = withAdminAuth(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }>; user: { email: string } },
) => {
  try {
    const { id } = await context.params;
    const body = await request.json();

    if (body.action !== 'confirm' && body.action !== 'reject') {
      return NextResponse.json({ error: 'Invalid action. Use "confirm" or "reject".' }, { status: 400 });
    }

    const reviewStatus = body.action === 'confirm' ? 'confirmed' : 'rejected';

    const updated = await prisma.legislativeActRelation.update({
      where: { id },
      data: {
        reviewStatus,
        confirmedBy: context.user.email,
        confirmedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, relation: updated });
  } catch (error) {
    return handleApiError(error);
  }
});

/**
 * DELETE — remove a relação da base. Use quando quiser apagar (não só marcar como rejected).
 */
export const DELETE = withAdminAuth(async (
  _request: NextRequest,
  context: { params: Promise<{ id: string }>; user: { email: string } },
) => {
  try {
    const { id } = await context.params;
    await prisma.legislativeActRelation.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
});
