import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";
import { getTrailBySlug } from "@/data/planejamento/trails";

interface Ctx {
  params: Promise<{ id: string }>;
  user: { userId: string };
}

export const GET = withAuth(async (_request: NextRequest, context) => {
  const { id } = await (context as Ctx).params;
  const userId = (context as Ctx).user.userId;

  const doc = await prisma.planningDocument.findFirst({
    where: { id, session: { userId, deletedAt: null } },
    include: {
      session: { select: { id: true, titulo: true, natureza: true, trailTemplateId: true, status: true, learningMode: true } },
      sections: { orderBy: { ordem: "asc" } },
    },
  });

  if (!doc) {
    return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
  }

  // Anexa metadata didática estática da trilha (conceito/fundamento) para o
  // painel esquerdo não precisar de outra chamada. Não inclui RAG (feito sob demanda).
  let trail = null;
  const template = doc.session.trailTemplateId
    ? await prisma.planningTrailTemplate.findUnique({
        where: { id: doc.session.trailTemplateId },
      })
    : null;
  if (template) {
    try {
      trail = JSON.parse(template.definitionJsonCache);
    } catch {
      /* ignore */
    }
  }
  if (!trail && doc.session.natureza === "SERVICO_CONTINUADO" && doc.type === "ETP") {
    trail = getTrailBySlug("servico-comum-continuado-etp") ?? null;
  }

  return NextResponse.json({ document: doc, trail });
});
