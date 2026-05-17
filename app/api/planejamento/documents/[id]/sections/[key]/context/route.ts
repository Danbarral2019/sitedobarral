import { NextRequest, NextResponse } from "next/server";
import { withUserApi } from "@/lib/api/handler";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/cache/rate-limit-helper";
import { buildSectionContext } from "@/lib/planejamento/rag";
import { getTrailBySlug } from "@/data/planejamento/trails";
import type { TrailDefinition } from "@/data/planejamento/types";
import { NotFoundError, ConflictError } from "@/lib/errors/api-error";

/**
 * Retorna o contexto didático (excertos, artigos, atos) para alimentar o
 * painel didático. Não chama LLM — só RAG + heurísticas. Cacheado no
 * `semanticSearch` via Redis.
 */
export const GET = withUserApi<{ id: string; key: string }>(async (_request: NextRequest, ctx) => {
  const { id, key } = ctx.params;
  const userId = ctx.user.userId;
  await enforceRateLimit(`planejamento:context:${userId}`, 30, 60);

  const section = await prisma.planningDocumentSection.findFirst({
    where: {
      documentId: id,
      sectionKey: key,
      document: { session: { userId, deletedAt: null } },
    },
    include: {
      document: {
        include: {
          session: { include: { trailTemplate: true } },
        },
      },
    },
  });
  if (!section) {
    throw new NotFoundError("Seção");
  }

  const trail = resolveTrail(section);
  if (!trail) {
    throw new ConflictError("Trilha não disponível");
  }
  const def = trail.sections.find((s) => s.key === key);
  if (!def) {
    throw new ConflictError("Definição não encontrada");
  }
  const descricao = section.document.session.descricaoLivre ?? "";
  if (descricao.length < 20) {
    return NextResponse.json({
      excerpts: [],
      articles: [],
      relatedActs: [],
      anchorageScore: 0,
      topSimilarity: 0,
      note: "onboarding-pendente",
    });
  }

  const sectionCtx = await buildSectionContext(def, {
    descricaoLivre: descricao,
    contentMd: section.contentMd,
  });

  return NextResponse.json({
    excerpts: sectionCtx.excerpts,
    articles: sectionCtx.articles,
    relatedActs: sectionCtx.relatedActs,
    sources: sectionCtx.sources,
    anchorageScore: sectionCtx.anchorageScore,
    topSimilarity: sectionCtx.topSimilarity,
  });
});

function resolveTrail(section: {
  document: {
    session: { trailTemplate: { definitionJsonCache: string } | null; natureza: string | null };
    type: string;
  };
}): TrailDefinition | null {
  const tpl = section.document.session.trailTemplate;
  if (tpl) {
    try {
      return JSON.parse(tpl.definitionJsonCache) as TrailDefinition;
    } catch {
      /* ignore */
    }
  }
  if (
    section.document.session.natureza === "SERVICO_CONTINUADO" &&
    section.document.type === "ETP"
  ) {
    return getTrailBySlug("servico-comum-continuado-etp") ?? null;
  }
  return null;
}
