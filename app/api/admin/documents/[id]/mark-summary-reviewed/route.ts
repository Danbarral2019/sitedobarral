import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminApi } from '@/lib/api/handler';
import { NotFoundError, ValidationError } from '@/lib/errors/api-error';
import type { ApiContext } from '@/lib/api/types';

/**
 * POST /api/admin/documents/[id]/mark-summary-reviewed
 * Body: { reviewed?: boolean }   (default true)
 *
 * Flag de aprovação humana para o resumo IA. Quando `true`, o badge
 * "Resumo IA não revisado" some na UI do aluno. Permite reverter para `false`
 * (ex.: se o resumo for regerado e precisar de nova revisão).
 */
export const POST = withAdminApi<{ id: string }>(async (request: NextRequest, ctx: ApiContext<{ id: string }>) => {
  const { id } = ctx.params;
  const body = await request.json().catch(() => ({}));
  const reviewed = body?.reviewed !== false; // default true

  const document = await prisma.document.findUnique({
    where: { id },
    select: { id: true, title: true, summary: true },
  });

  if (!document) {
    throw new NotFoundError('Documento');
  }

  if (!document.summary) {
    throw new ValidationError('Documento não possui summary IA para revisar');
  }

  const updated = await prisma.document.update({
    where: { id },
    data: {
      summaryReviewedByAdmin: reviewed,
      summaryReviewedAt: reviewed ? new Date() : null,
      summaryReviewedBy: reviewed ? ctx.user.email : null,
    },
    select: {
      id: true,
      title: true,
      summaryReviewedByAdmin: true,
      summaryReviewedAt: true,
      summaryReviewedBy: true,
    },
  });

  return NextResponse.json({ success: true, document: updated });
});
