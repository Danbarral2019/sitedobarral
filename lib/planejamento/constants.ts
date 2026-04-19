/**
 * Constantes do módulo Planejamento.
 */
import type { PlanningNatureza, PlanningDocumentType } from "@/data/planejamento/types";

/** Slug default de trilha por (natureza, tipo). */
export const DEFAULT_TRAIL_BY_NATUREZA: Partial<
  Record<`${PlanningNatureza}:${PlanningDocumentType}`, string>
> = {
  "SERVICO_CONTINUADO:ETP": "servico-comum-continuado-etp",
  "SERVICO_CONTINUADO:TR": "servico-comum-continuado-tr",
};

export function defaultTrailSlug(
  natureza: PlanningNatureza,
  type: PlanningDocumentType,
): string | undefined {
  return DEFAULT_TRAIL_BY_NATUREZA[`${natureza}:${type}`];
}

/** Tempo máximo para soft-delete antes de hard-delete (informativo; cron futuro). */
export const SOFT_DELETE_RETENTION_DAYS = 30;
