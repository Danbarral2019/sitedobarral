/**
 * Registro central de trilhas publicáveis.
 *
 * Cada entrada aqui é candidata a ser importada para o DB pelo admin
 * (em `/admin/planejamento/trilhas`) gerando uma `PlanningTrailTemplate`
 * com `definitionJsonCache` = snapshot do objeto TS.
 */
import type { TrailDefinition } from "../types";
import { servicoComumContinuadoEtp } from "./servico-comum-continuado/etp";
import { servicoComumContinuadoTr } from "./servico-comum-continuado/tr";

export const PLANNING_TRAILS: TrailDefinition[] = [
  servicoComumContinuadoEtp,
  servicoComumContinuadoTr,
];

export const PLANNING_TRAILS_BY_SLUG: Record<string, TrailDefinition> =
  Object.fromEntries(PLANNING_TRAILS.map((t) => [t.slug, t]));

export function getTrailBySlug(slug: string): TrailDefinition | undefined {
  return PLANNING_TRAILS_BY_SLUG[slug];
}
