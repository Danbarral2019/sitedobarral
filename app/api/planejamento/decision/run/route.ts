import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/cache/rate-limit-helper";
import { zDecisionRunBody } from "@/data/planejamento/types";
import { getDecisionMatrixBySlug } from "@/data/planejamento/decision-matrix/modalidade-julgamento-v1";
import { runDecisionMatrix } from "@/lib/planejamento/decision-engine";

/**
 * POST /api/planejamento/decision/run
 * Body: { sessionId, matrixSlug, inputs }
 * Executa a matriz determinística e grava PlanningDecisionRun.
 */
export const POST = withAuth(async (request: NextRequest, context) => {
  const userId = (context!.user as { userId: string }).userId;
  await enforceRateLimit(`planejamento:decision:${userId}`, 20, 60);

  const body = await request.json().catch(() => ({}));
  const parsed = zDecisionRunBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const session = await prisma.planningSession.findFirst({
    where: { id: parsed.data.sessionId, userId, deletedAt: null },
    select: { id: true },
  });
  if (!session) {
    return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });
  }

  const matrix = getDecisionMatrixBySlug(parsed.data.matrixSlug);
  if (!matrix) {
    return NextResponse.json({ error: "Matriz não encontrada" }, { status: 404 });
  }

  const result = runDecisionMatrix(matrix, parsed.data.inputs);

  const run = await prisma.planningDecisionRun.create({
    data: {
      sessionId: session.id,
      matrixSlug: matrix.slug,
      matrixVersion: matrix.version,
      inputsJson: JSON.stringify(parsed.data.inputs),
      resultJson: JSON.stringify(result),
    },
  });

  // Vincula a última execução ao ETP da sessão (para o gatilho "estimativa-valor")
  const etp = await prisma.planningDocument.findFirst({
    where: { sessionId: session.id, type: "ETP" },
    select: { id: true },
  });
  if (etp) {
    await prisma.planningDocument.update({
      where: { id: etp.id },
      data: { decisionRunId: run.id },
    });
  }

  return NextResponse.json({ run, result }, { status: 201 });
});
