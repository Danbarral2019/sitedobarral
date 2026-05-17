import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminApi } from '@/lib/api/handler';
import { ConflictError, NotFoundError } from '@/lib/errors/api-error';

export const runtime = 'nodejs';

export const POST = withAdminApi<{ id: string }>(async (request, ctx) => {
  const { id } = ctx.params;
  const adminEmail = ctx.user.email;
  const body = await request.json().catch(() => ({}));
  const reason = String(body?.reason || '').trim().substring(0, 1000) || null;

  const staging = await prisma.dOUStagingDocument.findUnique({ where: { id } });
  if (!staging) throw new NotFoundError('Staging');
  if (staging.finalDecision) {
    throw new ConflictError(`Já ${staging.finalDecision}`);
  }

  await prisma.dOUStagingDocument.update({
    where: { id },
    data: {
      finalDecision: 'rejected',
      reviewedAt: new Date(),
      reviewedBy: adminEmail,
      adminNotes: reason,
      classificationCorrect: false,
    },
  });

  return NextResponse.json({ success: true });
});
