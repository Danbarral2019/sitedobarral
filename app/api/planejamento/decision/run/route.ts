import { NextRequest, NextResponse } from "next/server";
import { withUserApi } from "@/lib/api/handler";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/cache/rate-limit-helper";
import { zDecisionRunBody } from "@/data/planejamento/types";
import { getDecisionMatrixBySlug } from "@/data/planejamento/decision-matrix/modalidade-julgamento-v1";
import { runDecisionMatrix } from "@/lib/planejamento/decision-engine";
import { ValidationError, NotFoundError } from "@/lib/errors/api-error";

/**
 * POST /api/planejamento/decision/run
 * Body: { sessionId, matrixSlug, inputs }
 * Executa a matriz determinística e grava PlanningDecisionRun.
 */
export const POST = withUserApi(async (request: NextRequest, ctx) => {
  const userId = ctx.user.userId;
  await enforceRateLimit(`planejamento:decision:${userId}`, 20, 60);

  const body = await request.json().catch(() => ({}));
  const parsed = zDecisionRunBody.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Dados inválidos", parsed.error.issues);
  }

  const session = await prisma.planningSession.findFirst({
    where: { id: parsed.data.sessionId, userId, deletedAt: null },
    select: { id: true },
  });
  if (!session) {
    throw new NotFoundError("Sessão");
  }

  const matrix = getDecisionMatrixBySlug(parsed.data.matrixSlug);
  if (!matrix) {
    throw new NotFoundError("Matriz");
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
