import { NextResponse } from "next/server";
import { withUserApi } from "@/lib/api/handler";
import { ApiError, ConflictError, NotFoundError, ValidationError } from "@/lib/errors/api-error";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/cache/rate-limit-helper";
import { generateSectionText } from "@/lib/planejamento/section-generator";
import { getTrailBySlug } from "@/data/planejamento/trails";
import type { TrailDefinition } from "@/data/planejamento/types";

const MAX_CONTENT = 40_000;

export const POST = withUserApi<{ id: string; key: string }>(async (request, { params, user, logger }) => {
  const { id, key } = params;
  const userId = user.userId;

  // Rate-limit dedicado (10/min) para geração — mais caro que edição
  await enforceRateLimit(`planejamento:generate:${userId}`, 10, 60);

  const body = await request.json().catch(() => ({}));
  const mode: "fresh" | "refine" = body.mode === "refine" ? "refine" : "fresh";
  const userHints =
    typeof body.userHints === "string" ? body.userHints.slice(0, 1500) : undefined;

  // Busca seção + ownership + trilha em uma query
  const section = await prisma.planningDocumentSection.findFirst({
    where: {
      documentId: id,
      sectionKey: key,
      document: { session: { userId, deletedAt: null } },
    },
    include: {
      document: {
        include: {
          session: {
            include: { trailTemplate: true },
          },
        },
      },
    },
  });
  if (!section) {
    throw new NotFoundError("Seção");
  }

  const trail = resolveTrail(section);
  if (!trail) {
    throw new ConflictError("Trilha da sessão não disponível.");
  }
  const def = trail.sections.find((s) => s.key === key);
  if (!def) {
    throw new ConflictError("Definição de seção não encontrada na trilha.");
  }

  const session = section.document.session;
  if (!session.descricaoLivre || session.descricaoLivre.length < 20) {
    throw new ValidationError(
      "Sessão sem descrição suficiente. Refaça o onboarding antes de gerar texto.",
    );
  }

  try {
    const result = await generateSectionText({
      def,
      descricaoLivre: session.descricaoLivre,
      contentMd: mode === "refine" ? section.contentMd : null,
      mode,
      userHints,
      userId,
    });

    const truncated = result.text.slice(0, MAX_CONTENT);
    const updated = await prisma.planningDocumentSection.update({
      where: { id: section.id },
      data: {
        contentMd: truncated,
        status: section.status === "PENDING" ? "DRAFTED" : section.status,
        generationProvenance: result.provenance,
        sourcesJson: JSON.stringify(result.sources),
        sufficiencyScore: result.anchorageScore,
        lastEditedAt: new Date(),
      },
    });

    return NextResponse.json({
      section: updated,
      generation: {
        provenance: result.provenance,
        sources: result.sources,
        anchorageScore: result.anchorageScore,
        topSimilarity: result.topSimilarity,
        model: result.model,
        latencyMs: result.latencyMs,
        tokens: result.tokens,
      },
    });
  } catch (err) {
    logger.error({ err }, "[planejamento/generate] falhou");
    throw new ApiError(
      500,
      err instanceof Error ? err.message : "Erro ao gerar texto",
      "GENERATION_FAILED",
    );
  }
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
  // Fallback para o catálogo TS quando a trilha ainda não foi publicada
  if (
    section.document.session.natureza === "SERVICO_CONTINUADO" &&
    section.document.type === "ETP"
  ) {
    return getTrailBySlug("servico-comum-continuado-etp") ?? null;
  }
  return null;
}
