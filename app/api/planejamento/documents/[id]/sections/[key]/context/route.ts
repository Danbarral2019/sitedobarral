import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/cache/rate-limit-helper";
import { buildSectionContext } from "@/lib/planejamento/rag";
import { getTrailBySlug } from "@/data/planejamento/trails";
import type { TrailDefinition } from "@/data/planejamento/types";

interface Ctx {
  params: Promise<{ id: string; key: string }>;
  user: { userId: string };
}

/**
 * Retorna o contexto didático (excertos, artigos, atos) para alimentar o
 * painel didático. Não chama LLM — só RAG + heurísticas. Cacheado no
 * `semanticSearch` via Redis.
 */
export const GET = withAuth(async (_request: NextRequest, context) => {
  const { id, key } = await (context as Ctx).params;
  const userId = (context as Ctx).user.userId;
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
    return NextResponse.json({ error: "Seção não encontrada" }, { status: 404 });
  }

  const trail = resolveTrail(section);
  if (!trail) {
    return NextResponse.json({ error: "Trilha não disponível" }, { status: 409 });
  }
  const def = trail.sections.find((s) => s.key === key);
  if (!def) {
    return NextResponse.json({ error: "Definição não encontrada" }, { status: 409 });
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

  const ctx = await buildSectionContext(def, {
    descricaoLivre: descricao,
    contentMd: section.contentMd,
  });

  return NextResponse.json({
    excerpts: ctx.excerpts,
    articles: ctx.articles,
    relatedActs: ctx.relatedActs,
    sources: ctx.sources,
    anchorageScore: ctx.anchorageScore,
    topSimilarity: ctx.topSimilarity,
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
