import { NextRequest, NextResponse } from "next/server";
import { withUserApi } from "@/lib/api/handler";
import { prisma } from "@/lib/prisma";
import { zCheckpointAnswerBody } from "@/data/planejamento/types";
import { ValidationError, NotFoundError } from "@/lib/errors/api-error";

/**
 * POST /api/planejamento/documents/[id]/sections/[key]/checkpoint
 * Registra resposta conceitual do aluno. Informativa (sem gatekeeping).
 */
export const POST = withUserApi<{ id: string; key: string }>(async (request: NextRequest, ctx) => {
  const { id, key } = ctx.params;
  const userId = ctx.user.userId;

  const body = await request.json().catch(() => ({}));
  const parsed = zCheckpointAnswerBody.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Dados inválidos", parsed.error.issues);
  }

  const section = await prisma.planningDocumentSection.findFirst({
    where: {
      documentId: id,
      sectionKey: key,
      document: { session: { userId, deletedAt: null } },
    },
    select: { id: true },
  });
  if (!section) {
    throw new NotFoundError("Seção");
  }

  const updated = await prisma.planningDocumentSection.update({
    where: { id: section.id },
    data: {
      conceptualCheckAnswerMd: parsed.data.answerMd,
      conceptualCheckPassed: parsed.data.selfEvaluation === "passed",
      conceptualCheckAnsweredAt: new Date(),
    },
    select: {
      id: true,
      sectionKey: true,
      conceptualCheckAnswerMd: true,
      conceptualCheckPassed: true,
      conceptualCheckAnsweredAt: true,
    },
  });
  return NextResponse.json({ checkpoint: updated });
});
