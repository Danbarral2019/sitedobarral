import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";
import { zCheckpointAnswerBody } from "@/data/planejamento/types";

interface Ctx {
  params: Promise<{ id: string; key: string }>;
  user: { userId: string };
}

/**
 * POST /api/planejamento/documents/[id]/sections/[key]/checkpoint
 * Registra resposta conceitual do aluno. Informativa (sem gatekeeping).
 */
export const POST = withAuth(async (request: NextRequest, context) => {
  const { id, key } = await (context as Ctx).params;
  const userId = (context as Ctx).user.userId;

  const body = await request.json().catch(() => ({}));
  const parsed = zCheckpointAnswerBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
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
    return NextResponse.json({ error: "Seção não encontrada" }, { status: 404 });
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
