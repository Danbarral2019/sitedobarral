/**
 * Helpers de alto nível para sessões de Planejamento.
 *
 * Responsabilidades:
 *  - criar PlanningSession
 *  - materializar PlanningDocument + PlanningDocumentSection[] a partir de
 *    uma PlanningTrailTemplate publicada (ou, em fallback, do catálogo TS)
 *  - soft-delete / restore / hard-delete
 */
import { prisma } from "@/lib/prisma";
import type { TrailDefinition } from "@/data/planejamento/types";
import { getTrailBySlug } from "@/data/planejamento/trails";
import { defaultTrailSlug } from "./constants";
import { defaultLearningModeForUser } from "./user-progress";
import type {
  PlanningDocumentType,
  PlanningNatureza,
} from "@/data/planejamento/types";

export interface CreateSessionInput {
  userId: string;
  titulo: string;
  natureza?: PlanningNatureza;
}

export async function createSession(input: CreateSessionInput) {
  const learningMode = await defaultLearningModeForUser(input.userId);
  return prisma.planningSession.create({
    data: {
      userId: input.userId,
      titulo: input.titulo,
      natureza: input.natureza ?? null,
      status: "ONBOARDING",
      learningMode,
    },
  });
}

export async function listSessions(userId: string, opts?: { includeDeleted?: boolean }) {
  return prisma.planningSession.findMany({
    where: {
      userId,
      deletedAt: opts?.includeDeleted ? undefined : null,
    },
    orderBy: { updatedAt: "desc" },
    include: {
      documents: {
        select: { id: true, type: true, status: true },
      },
    },
    take: 100,
  });
}

export async function getSessionForUser(sessionId: string, userId: string) {
  return prisma.planningSession.findFirst({
    where: { id: sessionId, userId, deletedAt: null },
    include: {
      documents: {
        include: {
          sections: { orderBy: { ordem: "asc" } },
        },
      },
      decisionRuns: { orderBy: { executedAt: "desc" }, take: 10 },
    },
  });
}

export async function softDeleteSession(sessionId: string, userId: string) {
  return prisma.planningSession.updateMany({
    where: { id: sessionId, userId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
}

export async function hardDeleteSession(sessionId: string, userId: string) {
  // Cascade cobre PlanningDocument → PlanningDocumentSection/Version/Export
  return prisma.planningSession.deleteMany({
    where: { id: sessionId, userId },
  });
}

/**
 * Resolve uma TrailDefinition por slug tentando primeiro a cópia publicada
 * em banco (definitionJsonCache) e, em fallback, o catálogo TS — assim o
 * módulo funciona mesmo antes do primeiro "publish" via admin.
 */
export async function resolveTrail(slug: string): Promise<
  | { source: "db"; templateId: string; trail: TrailDefinition; version: number }
  | { source: "code"; templateId: null; trail: TrailDefinition; version: number }
  | null
> {
  const published = await prisma.planningTrailTemplate.findUnique({
    where: { slug },
  });
  if (published?.publishedAt) {
    try {
      const trail = JSON.parse(published.definitionJsonCache) as TrailDefinition;
      return {
        source: "db",
        templateId: published.id,
        trail,
        version: published.version,
      };
    } catch {
      // fallthrough para catálogo TS
    }
  }
  const trail = getTrailBySlug(slug);
  if (!trail) return null;
  return { source: "code", templateId: null, trail, version: trail.version };
}

/**
 * Materializa o ETP (ou TR) a partir da trilha resolvida. Se já existir um
 * documento deste tipo na sessão, retorna o existente (idempotente).
 */
export async function materializeDocumentFromTrail(
  sessionId: string,
  trailSlug: string,
) {
  const resolved = await resolveTrail(trailSlug);
  if (!resolved) throw new Error(`Trilha não encontrada: ${trailSlug}`);

  const existing = await prisma.planningDocument.findUnique({
    where: {
      sessionId_type: { sessionId, type: resolved.trail.documentType },
    },
  });
  if (existing) return existing;

  return prisma.$transaction(async (tx) => {
    const doc = await tx.planningDocument.create({
      data: {
        sessionId,
        type: resolved.trail.documentType,
        status: "PENDING",
      },
    });

    await tx.planningDocumentSection.createMany({
      data: resolved.trail.sections.map((s) => ({
        documentId: doc.id,
        sectionKey: s.key,
        ordem: s.ordem,
        required: s.required,
        discretionary: s.discretionary,
        status: "PENDING",
      })),
    });

    // Atualiza sessão com o trail usado, caso ainda não atribuído
    if (resolved.templateId) {
      await tx.planningSession.update({
        where: { id: sessionId },
        data: {
          trailTemplateId: resolved.templateId,
          natureza: resolved.trail.natureza,
          status: "TRAIL_ETP",
        },
      });
    } else {
      await tx.planningSession.update({
        where: { id: sessionId },
        data: {
          natureza: resolved.trail.natureza,
          status: "TRAIL_ETP",
        },
      });
    }
    return doc;
  });
}

export function resolveDefaultTrailSlug(
  natureza: PlanningNatureza,
  type: PlanningDocumentType,
) {
  return defaultTrailSlug(natureza, type);
}

/**
 * Materializa (ou retorna) o TR de uma sessão, pré-carregando cada seção
 * que possuir `derivesFromSectionKey` com o `contentMd` da seção-fonte do
 * ETP já confirmada. A herança:
 *  - é "best-effort": se a seção do ETP não existir ou não estiver
 *    confirmada/drafted, o TR começa com contentMd vazio;
 *  - persiste a origem em `PlanningDocumentSection.derivedFromSectionId`
 *    para rastreabilidade e para o coherence check.
 */
export async function materializeTRWithInheritance(
  sessionId: string,
  trailSlug?: string,
) {
  const session = await prisma.planningSession.findUnique({
    where: { id: sessionId },
    include: {
      documents: {
        include: { sections: { orderBy: { ordem: "asc" } } },
      },
    },
  });
  if (!session) throw new Error("Sessão não encontrada");

  const slug =
    trailSlug ??
    (session.natureza
      ? defaultTrailSlug(session.natureza as PlanningNatureza, "TR")
      : undefined);
  if (!slug) throw new Error("Trilha de TR indisponível para esta natureza");

  const resolved = await resolveTrail(slug);
  if (!resolved) throw new Error(`Trilha não encontrada: ${slug}`);
  if (resolved.trail.documentType !== "TR") {
    throw new Error(`Trilha ${slug} não é de TR.`);
  }

  const existing = session.documents.find((d) => d.type === "TR");
  if (existing) {
    return prisma.planningDocument.findUnique({
      where: { id: existing.id },
      include: { sections: { orderBy: { ordem: "asc" } } },
    });
  }

  const etp = session.documents.find((d) => d.type === "ETP");
  const etpByKey = etp
    ? Object.fromEntries(etp.sections.map((s) => [s.sectionKey, s]))
    : ({} as Record<string, (typeof session.documents)[number]["sections"][number]>);

  return prisma.$transaction(async (tx) => {
    const doc = await tx.planningDocument.create({
      data: { sessionId, type: "TR", status: "PENDING" },
    });

    for (const s of resolved.trail.sections) {
      const fromKey = s.promptSpec.derivesFromSectionKey;
      const fromSection = fromKey ? etpByKey[fromKey] : undefined;
      const shouldInherit =
        fromSection &&
        (fromSection.status === "CONFIRMED" || fromSection.status === "DRAFTED") &&
        (fromSection.contentMd ?? "").trim().length > 0;

      await tx.planningDocumentSection.create({
        data: {
          documentId: doc.id,
          sectionKey: s.key,
          ordem: s.ordem,
          required: s.required,
          discretionary: s.discretionary,
          status: shouldInherit ? "IN_PROGRESS" : "PENDING",
          contentMd: shouldInherit ? fromSection!.contentMd : null,
          derivedFromSectionId: shouldInherit ? fromSection!.id : null,
          generationProvenance: shouldInherit ? "USER_WRITTEN" : null,
          sourcesJson: shouldInherit ? fromSection!.sourcesJson : null,
        },
      });
    }

    if (resolved.templateId) {
      // não sobrescreve trailTemplateId do ETP; apenas avança status
      await tx.planningSession.update({
        where: { id: sessionId },
        data: { status: "TRAIL_TR" },
      });
    } else {
      await tx.planningSession.update({
        where: { id: sessionId },
        data: { status: "TRAIL_TR" },
      });
    }

    return tx.planningDocument.findUnique({
      where: { id: doc.id },
      include: { sections: { orderBy: { ordem: "asc" } } },
    });
  });
}
