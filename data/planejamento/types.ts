/**
 * Tipos e validadores do módulo Planejamento (ETP + TR + Matriz).
 *
 * Fonte única de verdade para enums do domínio. O schema Prisma usa `String`
 * (convenção do projeto); a validação acontece aqui via Zod.
 */
import { z } from "zod";

// ---------- Enums de domínio ----------

export const PLANNING_NATUREZAS = [
  "BEM_COMUM",
  "BEM_ESPECIAL",
  "SERVICO_COMUM",
  "SERVICO_CONTINUADO",
  "SERVICO_ESPECIAL",
  "OBRA",
  "SERVICO_ENGENHARIA",
] as const;
export type PlanningNatureza = (typeof PLANNING_NATUREZAS)[number];

export const PLANNING_DOCUMENT_TYPES = ["ETP", "TR"] as const;
export type PlanningDocumentType = (typeof PLANNING_DOCUMENT_TYPES)[number];

export const PLANNING_SESSION_STATUSES = [
  "ONBOARDING",
  "TRAIL_ETP",
  "MATRIX_RUN",
  "TRAIL_TR",
  "REVIEW",
  "EXPORT",
  "ARCHIVED",
] as const;
export type PlanningSessionStatus = (typeof PLANNING_SESSION_STATUSES)[number];

export const PLANNING_SECTION_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "DRAFTED",
  "CONFIRMED",
  "SKIPPED_WITH_JUSTIFICATION",
] as const;
export type PlanningSectionStatus = (typeof PLANNING_SECTION_STATUSES)[number];

export const PLANNING_GENERATION_PROVENANCES = [
  "RAG_ANCHORED",
  "PARTIALLY_ANCHORED",
  "NOT_ANCHORED",
  "USER_WRITTEN",
] as const;
export type PlanningGenerationProvenance =
  (typeof PLANNING_GENERATION_PROVENANCES)[number];

export const PLANNING_EXPORT_FORMATS = [
  "html-sei",
  "docx",
  "pdf",
  "pncp-metadata",
] as const;
export type PlanningExportFormat = (typeof PLANNING_EXPORT_FORMATS)[number];

// ---------- Citações e RAG ----------

export interface LegalAnchor {
  kind: "lei" | "in" | "decreto" | "sumula" | "acordao" | "parecer";
  /** Ex: "Lei 14.133/2021, art. 18, §1º, III" */
  label: string;
  /** URL interna opcional para abrir a fonte */
  href?: string;
  articleNumber?: string;
}

export interface PlanningSectionSource {
  sourceType: "document" | "legislative-act" | "tribunal-decision" | "lei-article";
  id: string;
  title: string;
  url?: string;
  articleNumber?: string;
  similarity?: number;
  snippet?: string;
}

/** Filtro aplicado a semanticSearch quando o engine monta o contexto da seção. */
export interface RagFilter {
  sourceTypes?: Array<PlanningSectionSource["sourceType"]>;
  categories?: string[];
  minSimilarity?: number;
  limit?: number;
  includeTribunalDecisions?: boolean;
}

// ---------- Definição de trilha ----------

export interface SectionCheckpoint {
  question: string;
  rubricMd: string;
}

export interface SectionPromptSpec {
  /** Nome do preset em data/planejamento/prompts/system.ts */
  systemRef: string;
  /** Template Mustache-like com placeholders {{campo}} */
  userTemplate: string;
  /** Task do registry lib/ai/index.ts a usar (default: "enhancement") */
  aiTask?: "enhancement" | "chat" | "summarization";
  /** Se requer execução da matriz antes de gerar */
  requiresMatrix?: boolean;
  /** sectionKey do ETP de onde herdar dados ao gerar TR */
  derivesFromSectionKey?: string;
}

export interface SectionDefinition {
  /** Slug estável usado em rotas e no DB */
  key: string;
  title: string;
  /** Texto curto exibido na sidebar */
  shortLabel?: string;
  /** Ordem canônica (inteiro positivo único na trilha) */
  ordem: number;
  required: boolean;
  /** Permite SKIPPED_WITH_JUSTIFICATION */
  discretionary: boolean;
  legalAnchors: LegalAnchor[];
  didactic: {
    conceito: string;
    fundamento: string;
    /** IDs internos de exemplos curados (arquivo de modelos) */
    exemplosRef?: string[];
  };
  ragFilter: RagFilter;
  promptSpec: SectionPromptSpec;
  checkpoint?: SectionCheckpoint;
  /** Heurísticas simples (nome do preset em lib/planejamento/sufficiency.ts) */
  sufficiencyHeuristicRefs?: string[];
}

export interface TrailDefinition {
  slug: string;
  natureza: PlanningNatureza;
  documentType: PlanningDocumentType;
  version: number;
  title: string;
  description: string;
  sections: SectionDefinition[];
}

// ---------- Matriz de decisão ----------

export type DecisionInputType = "enum" | "number" | "bool" | "text";

export interface DecisionInput {
  id: string;
  label: string;
  type: DecisionInputType;
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  help?: string;
}

export type DecisionPredicate =
  | { op: "and"; items: DecisionPredicate[] }
  | { op: "or"; items: DecisionPredicate[] }
  | { op: "not"; item: DecisionPredicate }
  | { op: "eq"; input: string; value: string | number | boolean }
  | { op: "neq"; input: string; value: string | number | boolean }
  | { op: "gt"; input: string; value: number }
  | { op: "gte"; input: string; value: number }
  | { op: "lt"; input: string; value: number }
  | { op: "lte"; input: string; value: number }
  | { op: "in"; input: string; values: Array<string | number> }
  | { op: "contains"; input: string; value: string };

export interface DecisionRule {
  id: string;
  when: DecisionPredicate;
  then: {
    modalidade: string;
    criterio: string;
  };
  rationaleMd: string;
  citations: LegalAnchor[];
}

export interface DecisionMatrixDefinition {
  slug: string;
  version: number;
  title: string;
  inputs: DecisionInput[];
  rules: DecisionRule[];
  fallback: {
    modalidade: string;
    criterio: string;
    rationaleMd: string;
    citations: LegalAnchor[];
  };
}

// ---------- Zod runtime validators ----------

export const zNatureza = z.enum(PLANNING_NATUREZAS);
export const zDocumentType = z.enum(PLANNING_DOCUMENT_TYPES);
export const zSessionStatus = z.enum(PLANNING_SESSION_STATUSES);
export const zSectionStatus = z.enum(PLANNING_SECTION_STATUSES);
export const zGenerationProvenance = z.enum(PLANNING_GENERATION_PROVENANCES);
export const zExportFormat = z.enum(PLANNING_EXPORT_FORMATS);

export const zLegalAnchor = z.object({
  kind: z.enum(["lei", "in", "decreto", "sumula", "acordao", "parecer"]),
  label: z.string().min(1),
  href: z.string().url().optional(),
  articleNumber: z.string().optional(),
});

export const zRagFilter = z.object({
  sourceTypes: z
    .array(z.enum(["document", "legislative-act", "tribunal-decision", "lei-article"]))
    .optional(),
  categories: z.array(z.string()).optional(),
  minSimilarity: z.number().min(0).max(1).optional(),
  limit: z.number().int().positive().max(50).optional(),
  includeTribunalDecisions: z.boolean().optional(),
});

export const zSectionDefinition: z.ZodType<SectionDefinition> = z.object({
  key: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  shortLabel: z.string().optional(),
  ordem: z.number().int().positive(),
  required: z.boolean(),
  discretionary: z.boolean(),
  legalAnchors: z.array(zLegalAnchor),
  didactic: z.object({
    conceito: z.string().min(1),
    fundamento: z.string().min(1),
    exemplosRef: z.array(z.string()).optional(),
  }),
  ragFilter: zRagFilter,
  promptSpec: z.object({
    systemRef: z.string().min(1),
    userTemplate: z.string().min(1),
    aiTask: z.enum(["enhancement", "chat", "summarization"]).optional(),
    requiresMatrix: z.boolean().optional(),
    derivesFromSectionKey: z.string().optional(),
  }),
  checkpoint: z
    .object({ question: z.string().min(1), rubricMd: z.string().min(1) })
    .optional(),
  sufficiencyHeuristicRefs: z.array(z.string()).optional(),
});

export const zTrailDefinition: z.ZodType<TrailDefinition> = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    natureza: zNatureza,
    documentType: zDocumentType,
    version: z.number().int().positive(),
    title: z.string().min(1),
    description: z.string().min(1),
    sections: z.array(zSectionDefinition).min(1),
  })
  .superRefine((trail, ctx) => {
    const seenKeys = new Set<string>();
    const seenOrdens = new Set<number>();
    for (const s of trail.sections) {
      if (seenKeys.has(s.key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Section key duplicated: ${s.key}`,
        });
      }
      if (seenOrdens.has(s.ordem)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Section ordem duplicated: ${s.ordem}`,
        });
      }
      seenKeys.add(s.key);
      seenOrdens.add(s.ordem);
    }
  });

const zDecisionPredicate: z.ZodType<DecisionPredicate> = z.lazy(() =>
  z.union([
    z.object({ op: z.literal("and"), items: z.array(zDecisionPredicate) }),
    z.object({ op: z.literal("or"), items: z.array(zDecisionPredicate) }),
    z.object({ op: z.literal("not"), item: zDecisionPredicate }),
    z.object({
      op: z.literal("eq"),
      input: z.string(),
      value: z.union([z.string(), z.number(), z.boolean()]),
    }),
    z.object({
      op: z.literal("neq"),
      input: z.string(),
      value: z.union([z.string(), z.number(), z.boolean()]),
    }),
    z.object({ op: z.literal("gt"), input: z.string(), value: z.number() }),
    z.object({ op: z.literal("gte"), input: z.string(), value: z.number() }),
    z.object({ op: z.literal("lt"), input: z.string(), value: z.number() }),
    z.object({ op: z.literal("lte"), input: z.string(), value: z.number() }),
    z.object({
      op: z.literal("in"),
      input: z.string(),
      values: z.array(z.union([z.string(), z.number()])),
    }),
    z.object({ op: z.literal("contains"), input: z.string(), value: z.string() }),
  ]),
);

export const zDecisionMatrix: z.ZodType<DecisionMatrixDefinition> = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  version: z.number().int().positive(),
  title: z.string().min(1),
  inputs: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      type: z.enum(["enum", "number", "bool", "text"]),
      options: z
        .array(z.object({ value: z.string(), label: z.string() }))
        .optional(),
      required: z.boolean().optional(),
      help: z.string().optional(),
    }),
  ),
  rules: z.array(
    z.object({
      id: z.string().min(1),
      when: zDecisionPredicate,
      then: z.object({ modalidade: z.string().min(1), criterio: z.string().min(1) }),
      rationaleMd: z.string().min(1),
      citations: z.array(zLegalAnchor),
    }),
  ),
  fallback: z.object({
    modalidade: z.string().min(1),
    criterio: z.string().min(1),
    rationaleMd: z.string().min(1),
    citations: z.array(zLegalAnchor),
  }),
});

// ---------- API contracts (request/response) ----------

export const zCreateSessionBody = z.object({
  titulo: z.string().min(3).max(200),
});

export const zOnboardingBody = z.object({
  descricaoLivre: z.string().min(20).max(4000),
});

export const zClassifyResult = z.object({
  naturezaSugerida: zNatureza,
  confianca: z.number().min(0).max(1),
  perguntasFollowUp: z.array(z.string()).default([]),
  trailTemplateId: z.string().optional(),
});
export type ClassifyResult = z.infer<typeof zClassifyResult>;

export const zUpdateSectionBody = z.object({
  contentMd: z.string().max(60000).optional(),
  status: zSectionStatus.optional(),
  justificationSkipped: z.string().max(4000).optional(),
  conceptualCheckPassed: z.boolean().optional(),
  conceptualCheckAnswerMd: z.string().max(4000).optional(),
});

export const zCheckpointAnswerBody = z.object({
  answerMd: z.string().min(5).max(4000),
  selfEvaluation: z.enum(["passed", "uncertain"]).default("passed"),
});

export const zCreateSnippetBody = z.object({
  titulo: z.string().min(3).max(200),
  corpoMd: z.string().min(5).max(20000),
  tags: z.array(z.string().max(50)).max(10).optional(),
  sourceSectionId: z.string().optional(),
});

export const zUpdateSessionBody = z.object({
  titulo: z.string().min(3).max(200).optional(),
  learningMode: z.boolean().optional(),
  archivedAt: z.union([z.string().datetime(), z.null()]).optional(),
});

export const zDecisionInputs = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean()]),
);

export const zDecisionRunBody = z.object({
  sessionId: z.string().min(1),
  matrixSlug: z.string().min(1),
  inputs: zDecisionInputs,
});

export const zExportBody = z.object({
  formats: z.array(zExportFormat).min(1).max(4),
});
