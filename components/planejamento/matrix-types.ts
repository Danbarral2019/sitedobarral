import type { LegalAnchor } from "@/data/planejamento/types";

export interface DecisionRunResult {
  matrixSlug: string;
  matrixVersion: number;
  inputs: Record<string, string | number | boolean | undefined | null>;
  matchedRuleId: string | null;
  matchedRuleIds: string[];
  modalidade: string;
  criterio: string;
  rationaleMd: string;
  citations: LegalAnchor[];
  usedFallback: boolean;
}
