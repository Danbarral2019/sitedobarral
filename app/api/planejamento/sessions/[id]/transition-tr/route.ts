import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";
import { materializeTRWithInheritance } from "@/lib/planejamento/session-manager";

interface Ctx {
  params: Promise<{ id: string }>;
  user: { userId: string };
}

/**
 * POST /api/planejamento/sessions/[id]/transition-tr
 * Materializa o TR da sessão, pré-carregando campos herdados do ETP.
 * Idempotente: se o TR já existe, retorna-o sem alterações.
 */
export const POST = withAuth(async (_request: NextRequest, context) => {
  const { id } = await (context as Ctx).params;
  const userId = (context as Ctx).user.userId;

  const session = await prisma.planningSession.findFirst({
    where: { id, userId, deletedAt: null },
    include: {
      documents: {
        include: { sections: { select: { status: true, required: true } } },
      },
    },
  });
  if (!session) {
    return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });
  }

  const etp = session.documents.find((d) => d.type === "ETP");
  if (!etp) {
    return NextResponse.json(
      { error: "ETP ainda não materializado nesta sessão." },
      { status: 409 },
    );
  }
  const missingRequired = etp.sections.filter(
    (s) =>
      s.required &&
      s.status !== "CONFIRMED" &&
      s.status !== "SKIPPED_WITH_JUSTIFICATION",
  ).length;
  if (missingRequired > 0) {
    return NextResponse.json(
      {
        error: `Ainda há ${missingRequired} seções obrigatórias do ETP pendentes.`,
        missingRequired,
      },
      { status: 409 },
    );
  }

  try {
    const tr = await materializeTRWithInheritance(id);
    return NextResponse.json({ tr }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao materializar TR" },
      { status: 500 },
    );
  }
});
