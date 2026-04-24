import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { feedback, note } = body as { feedback?: unknown; note?: unknown };

    if (
      feedback !== null &&
      feedback !== 1 &&
      feedback !== -1
    ) {
      return NextResponse.json(
        { error: 'feedback must be 1, -1, or null' },
        { status: 400 },
      );
    }
    if (note !== undefined && typeof note !== 'string') {
      return NextResponse.json(
        { error: 'note must be a string' },
        { status: 400 },
      );
    }
    const trimmedNote =
      typeof note === 'string' ? note.trim().slice(0, 500) || null : undefined;

    const entry = await prisma.searchHistory.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!entry || entry.userId !== authResult.user.userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
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
    console.error('Error updating search history feedback:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
