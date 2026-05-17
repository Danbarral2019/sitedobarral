import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminApi } from '@/lib/api/handler';

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
export const PATCH = withAdminApi<{ id: string }>(async (
  request: NextRequest,
  ctx,
) => {
  const { id } = ctx.params;
  const body = await request.json();

  if (body.action !== 'confirm' && body.action !== 'reject') {
    return NextResponse.json({ error: 'Invalid action. Use "confirm" or "reject".' }, { status: 400 });
  }

  const reviewStatus = body.action === 'confirm' ? 'confirmed' : 'rejected';

  const updated = await prisma.legislativeActRelation.update({
    where: { id },
    data: {
      reviewStatus,
      confirmedBy: ctx.user.email,
      confirmedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, relation: updated });
});

/**
 * DELETE — remove a relação da base. Use quando quiser apagar (não só marcar como rejected).
 */
export const DELETE = withAdminApi<{ id: string }>(async (
  _request: NextRequest,
  ctx,
) => {
  const { id } = ctx.params;
  await prisma.legislativeActRelation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
