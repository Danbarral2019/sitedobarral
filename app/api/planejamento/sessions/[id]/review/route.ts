import { NextRequest, NextResponse } from "next/server";
import { withUserApi } from "@/lib/api/handler";
import { prisma } from "@/lib/prisma";
import { runReview } from "@/lib/planejamento/review";
import { NotFoundError } from "@/lib/errors/api-error";

/**
 * POST /api/planejamento/sessions/[id]/review
 * Executa o checklist de conformidade + coherence check ETP↔TR e retorna
 * um relatório estruturado. Não altera nada no DB — chamadas repetidas são
 * seguras e baratas.
 */
export const POST = withUserApi<{ id: string }>(async (_request: NextRequest, ctx) => {
  const { id } = ctx.params;
  const userId = ctx.user.userId;
  const session = await prisma.planningSession.findFirst({
    where: { id, userId, deletedAt: null },
    select: { id: true },
  });
  if (!session) {
    throw new NotFoundError("Sessão");
  }
  const report = await runReview(id);
  return NextResponse.json({ report });
});
