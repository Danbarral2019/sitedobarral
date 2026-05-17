import { NextRequest, NextResponse } from "next/server";
import { withUserApi } from "@/lib/api/handler";
import { prisma } from "@/lib/prisma";
import { getTrailBySlug } from "@/data/planejamento/trails";
import { NotFoundError } from "@/lib/errors/api-error";
import type { ApiContext } from "@/lib/api/types";

export const GET = withUserApi<{ id: string }>(async (_request: NextRequest, ctx: ApiContext<{ id: string }>) => {
  const { id } = ctx.params;
  const userId = ctx.user.userId;

  const doc = await prisma.planningDocument.findFirst({
    where: { id, session: { userId, deletedAt: null } },
    include: {
      session: { select: { id: true, titulo: true, natureza: true, trailTemplateId: true, status: true, learningMode: true } },
      sections: { orderBy: { ordem: "asc" } },
    },
  });

  if (!doc) {
    throw new NotFoundError("Documento");
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
