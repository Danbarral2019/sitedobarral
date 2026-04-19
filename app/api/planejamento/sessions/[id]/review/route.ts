import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";
import { runReview } from "@/lib/planejamento/review";

interface Ctx {
  params: Promise<{ id: string }>;
  user: { userId: string };
}

/**
 * POST /api/planejamento/sessions/[id]/review
 * Executa o checklist de conformidade + coherence check ETP↔TR e retorna
 * um relatório estruturado. Não altera nada no DB — chamadas repetidas são
 * seguras e baratas.
 */
export const POST = withAuth(async (_request: NextRequest, context) => {
  const { id } = await (context as Ctx).params;
  const userId = (context as Ctx).user.userId;
  const session = await prisma.planningSession.findFirst({
    where: { id, userId, deletedAt: null },
    select: { id: true },
  });
  if (!session) {
    return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });
  }
  const report = await runReview(id);
  return NextResponse.json({ report });
});
