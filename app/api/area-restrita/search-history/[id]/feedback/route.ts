import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { handleApiError } from '@/lib/errors/error-handler';
import { AuthenticationError, NotFoundError, ValidationError } from '@/lib/errors/api-error';

/**
 * PATCH /api/area-restrita/search-history/[id]/feedback
 *
 * Registra feedback do aluno sobre uma busca: 👍 (1), 👎 (-1) ou clear (null).
 * Opcionalmente aceita um `note` curto explicando a reação.
 *
 * Só o dono da busca pode dar feedback nela. Dado é usado em analytics
 * (/api/admin/search-analytics) e para priorizar queries problemáticas
 * para anotação no golden set do eval.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await verifyAuth(req);
    if (!authResult.valid || !authResult.user) {
      throw new AuthenticationError('Unauthorized');
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { feedback, note } = body as { feedback?: unknown; note?: unknown };

    if (
      feedback !== null &&
      feedback !== 1 &&
      feedback !== -1
    ) {
      throw new ValidationError('feedback must be 1, -1, or null');
    }
    if (note !== undefined && typeof note !== 'string') {
      throw new ValidationError('note must be a string');
    }
    const trimmedNote =
      typeof note === 'string' ? note.trim().slice(0, 500) || null : undefined;

    const entry = await prisma.searchHistory.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!entry || entry.userId !== authResult.user.userId) {
      throw new NotFoundError('Registro');
    }

    await prisma.searchHistory.update({
      where: { id },
      data: {
        feedback: feedback as number | null,
        feedbackAt: feedback === null ? null : new Date(),
        ...(trimmedNote !== undefined && { feedbackNote: trimmedNote }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
