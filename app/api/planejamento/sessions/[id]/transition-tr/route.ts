import { NextRequest, NextResponse } from "next/server";
import { withUserApi } from "@/lib/api/handler";
import { prisma } from "@/lib/prisma";
import { materializeTRWithInheritance } from "@/lib/planejamento/session-manager";
import { NotFoundError, ConflictError } from "@/lib/errors/api-error";
import type { ApiContext } from "@/lib/api/types";

/**
 * POST /api/planejamento/sessions/[id]/transition-tr
 * Materializa o TR da sessão, pré-carregando campos herdados do ETP.
 * Idempotente: se o TR já existe, retorna-o sem alterações.
 */
export const POST = withUserApi<{ id: string }>(async (_request: NextRequest, ctx: ApiContext<{ id: string }>) => {
  const { id } = ctx.params;
  const userId = ctx.user.userId;

  const session = await prisma.planningSession.findFirst({
    where: { id, userId, deletedAt: null },
    include: {
      documents: {
        include: { sections: { select: { status: true, required: true } } },
      },
    },
  });
  if (!session) {
    throw new NotFoundError("Sessão");
  }

  const etp = session.documents.find((d) => d.type === "ETP");
  if (!etp) {
    throw new ConflictError("ETP ainda não materializado nesta sessão.");
  }
  const missingRequired = etp.sections.filter(
    (s) =>
      s.required &&
      s.status !== "CONFIRMED" &&
      s.status !== "SKIPPED_WITH_JUSTIFICATION",
  ).length;
  if (missingRequired > 0) {
    throw new ConflictError(
      `Ainda há ${missingRequired} seções obrigatórias do ETP pendentes.`,
      { missingRequired },
    );
  }

  const tr = await materializeTRWithInheritance(id);
  return NextResponse.json({ tr }, { status: 201 });
});
