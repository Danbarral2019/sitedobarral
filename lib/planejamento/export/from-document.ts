/**
 * Conversão PlanningDocument (Prisma) → AST de exportação.
 *
 * Recebe os dados já carregados (sem fazer nova query) para ser testável
 * isoladamente e reaproveitável por qualquer caller.
 */
import { getTrailBySlug } from "@/data/planejamento/trails";
import type { TrailDefinition } from "@/data/planejamento/types";
import {
  friendlyCriterio,
  friendlyModalidade,
} from "@/lib/planejamento/decision-engine";
import type {
  ASTBlock,
  ASTDecision,
  ASTDocument,
  ASTSection,
} from "./ast";

export interface BuildASTInput {
  session: {
    id: string;
    titulo: string;
    natureza: string | null;
  };
  document: {
    type: string;
    sections: Array<{
      sectionKey: string;
      ordem: number;
      status: string;
      contentMd: string | null;
      justificationSkipped: string | null;
      sourcesJson: string | null;
    }>;
  };
  trail: TrailDefinition | null;
  decisionRun?: {
    matrixSlug: string;
    matrixVersion: number;
    resultJson: string;
    executedAt: Date;
  } | null;
}

export function buildAST(input: BuildASTInput): ASTDocument {
  const kind = (input.document.type === "TR" ? "TR" : "ETP") as "TR" | "ETP";
  const trail = input.trail ?? resolveFallbackTrail(input.session.natureza, kind);

  const sectionDefByKey: Record<
    string,
    TrailDefinition["sections"][number] | undefined
  > = trail
    ? Object.fromEntries(trail.sections.map((s) => [s.key, s]))
    : {};

  const sections: ASTSection[] = input.document.sections
    .slice()
    .sort((a, b) => a.ordem - b.ordem)
    .map((s) => {
      const def = sectionDefByKey[s.sectionKey];
      const blocks: ASTBlock[] = [];

      if (s.status === "SKIPPED_WITH_JUSTIFICATION") {
        blocks.push({
          type: "paragraph",
          text:
            (s.justificationSkipped ?? "").trim() ||
            "Esta seção foi dispensada com justificativa.",
        });
      } else {
        const paragraphs = splitParagraphs(s.contentMd ?? "");
        for (const p of paragraphs) {
          if (p.trim().length === 0) continue;
          blocks.push({ type: "paragraph", text: p });
        }
      }

      const sources = parseSources(s.sourcesJson);
      if (sources.length > 0) {
        blocks.push({
          type: "citations-footer",
          label: "Fontes ancoradas",
          items: sources.slice(0, 12).map((src) => ({
            label: src.title,
            url: src.url,
          })),
        });
      }

      return {
        ordem: s.ordem,
        title: def?.title ?? s.sectionKey,
        anchors: (def?.legalAnchors ?? []).map((a) => a.label),
        blocks,
        statusNote:
          s.status === "SKIPPED_WITH_JUSTIFICATION"
            ? "Seção dispensada com justificativa"
            : s.status === "CONFIRMED"
              ? undefined
              : s.status === "DRAFTED"
                ? "Rascunho — revisar antes de publicar"
                : "Seção não concluída",
        skipped:
          s.status === "SKIPPED_WITH_JUSTIFICATION"
            ? { justification: s.justificationSkipped ?? "" }
            : undefined,
      };
    });

  const decision = input.decisionRun
    ? buildDecision(input.decisionRun)
    : undefined;

  return {
    title: input.session.titulo,
    kind,
    subtitle: trail?.title,
    metadata: {
      sessionId: input.session.id,
      natureza: input.session.natureza ?? undefined,
    },
    sections,
    decision,
  };
}

function resolveFallbackTrail(
  natureza: string | null,
  kind: "ETP" | "TR",
): TrailDefinition | null {
  if (natureza === "SERVICO_CONTINUADO") {
    return (
      getTrailBySlug(
        kind === "ETP"
          ? "servico-comum-continuado-etp"
          : "servico-comum-continuado-tr",
      ) ?? null
    );
  }
  return null;
}

function splitParagraphs(md: string): string[] {
  if (!md) return [];
  return md
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+$/g, "").trim())
    .filter((p) => p.length > 0);
}

function parseSources(
  raw: string | null,
): Array<{ title: string; url?: string }> {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((s: { title?: unknown; url?: unknown }) => ({
        title: typeof s.title === "string" ? s.title : "",
        url: typeof s.url === "string" ? s.url : undefined,
      }))
      .filter((s: { title: string }) => s.title.length > 0);
  } catch {
    return [];
  }
}

function buildDecision(run: {
  matrixSlug: string;
  matrixVersion: number;
  resultJson: string;
  executedAt: Date;
}): ASTDecision | undefined {
  try {
    const parsed = JSON.parse(run.resultJson) as {
      modalidade: string;
      criterio: string;
      rationaleMd: string;
      citations: Array<{ label: string }>;
    };
    return {
      matrixSlug: run.matrixSlug,
      matrixVersion: run.matrixVersion,
      modalidade: friendlyModalidade(parsed.modalidade),
      criterio: friendlyCriterio(parsed.criterio),
      rationale: parsed.rationaleMd,
      citations: (parsed.citations ?? []).map((c) => c.label),
      executedAt: run.executedAt.toISOString(),
    };
  } catch {
    return undefined;
  }
}
