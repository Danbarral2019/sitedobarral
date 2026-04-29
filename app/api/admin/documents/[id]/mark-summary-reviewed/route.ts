import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminAuth } from '@/lib/api-middleware';

interface RouteContext {
  params: Promise<{ id: string }>;
  user: { email: string };
}

/**
 * POST /api/admin/documents/[id]/mark-summary-reviewed
 * Body: { reviewed?: boolean }   (default true)
 *
 * Flag de aprovação humana para o resumo IA. Quando `true`, o badge
 * "Resumo IA não revisado" some na UI do aluno. Permite reverter para `false`
 * (ex.: se o resumo for regerado e precisar de nova revisão).
 */
export const POST = withAdminAuth(async (request: NextRequest, context: RouteContext) => {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const reviewed = body?.reviewed !== false; // default true

    const document = await prisma.document.findUnique({
      where: { id },
      select: { id: true, title: true, summary: true },
    });

    if (!document) {
      return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });
    }

    if (!document.summary) {
      return NextResponse.json(
        { error: 'Documento não possui summary IA para revisar' },
        { status: 422 }
      );
    }

    const updated = await prisma.document.update({
      where: { id },
      data: {
        summaryReviewedByAdmin: reviewed,
        summaryReviewedAt: reviewed ? new Date() : null,
        summaryReviewedBy: reviewed ? context.user.email : null,
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
  } catch (error) {
    console.error('[Mark Summary Reviewed] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar status de revisão' },
      { status: 500 }
    );
  }
});
