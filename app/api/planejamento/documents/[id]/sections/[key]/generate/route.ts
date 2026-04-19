import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/cache/rate-limit-helper";
import { generateSectionText } from "@/lib/planejamento/section-generator";
import { getTrailBySlug } from "@/data/planejamento/trails";
import type { TrailDefinition } from "@/data/planejamento/types";

interface Ctx {
  params: Promise<{ id: string; key: string }>;
  user: { userId: string };
}

const MAX_CONTENT = 40_000;

export const POST = withAuth(async (request: NextRequest, context) => {
  const { id, key } = await (context as Ctx).params;
  const userId = (context as Ctx).user.userId;

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
    return NextResponse.json({ error: "Seção não encontrada" }, { status: 404 });
  }

  const trail = resolveTrail(section);
  if (!trail) {
    return NextResponse.json(
      { error: "Trilha da sessão não disponível." },
      { status: 409 },
    );
  }
  const def = trail.sections.find((s) => s.key === key);
  if (!def) {
    return NextResponse.json(
      { error: "Definição de seção não encontrada na trilha." },
      { status: 409 },
    );
  }

  const session = section.document.session;
  if (!session.descricaoLivre || session.descricaoLivre.length < 20) {
    return NextResponse.json(
      {
        error:
          "Sessão sem descrição suficiente. Refaça o onboarding antes de gerar texto.",
      },
      { status: 400 },
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
    console.error("[planejamento/generate] falhou", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao gerar texto" },
      { status: 500 },
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
