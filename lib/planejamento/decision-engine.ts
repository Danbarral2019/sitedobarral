/**
 * Runner determinístico da matriz de decisão.
 *
 * Avalia `DecisionPredicate` (AST tipada, sem eval) contra `inputs` do aluno
 * e seleciona a primeira regra cujo predicado resulta true. Se nenhuma
 * casar, usa o `fallback`.
 *
 * A determinística é propriedade testada: dados os mesmos inputs, a saída
 * é idêntica — o que permite incluir a matriz em golden-set.
 */
import type {
  DecisionMatrixDefinition,
  DecisionPredicate,
  DecisionRule,
  LegalAnchor,
} from "@/data/planejamento/types";

export type DecisionInputValue = string | number | boolean | undefined | null;
export type DecisionInputs = Record<string, DecisionInputValue>;

export interface DecisionRunResult {
  matrixSlug: string;
  matrixVersion: number;
  inputs: DecisionInputs;
  matchedRuleId: string | null;
  matchedRuleIds: string[]; // regras que passaram, ordenadas
  modalidade: string;
  criterio: string;
  rationaleMd: string;
  citations: LegalAnchor[];
  usedFallback: boolean;
}

export function runDecisionMatrix(
  matrix: DecisionMatrixDefinition,
  inputs: DecisionInputs,
): DecisionRunResult {
  const matched: DecisionRule[] = [];
  for (const rule of matrix.rules) {
    if (evalPredicate(rule.when, inputs)) {
      matched.push(rule);
    }
  }

  const winner = matched[0];
  if (winner) {
    return {
      matrixSlug: matrix.slug,
      matrixVersion: matrix.version,
      inputs,
      matchedRuleId: winner.id,
      matchedRuleIds: matched.map((r) => r.id),
      modalidade: winner.then.modalidade,
      criterio: winner.then.criterio,
      rationaleMd: winner.rationaleMd,
      citations: winner.citations,
      usedFallback: false,
    };
  }

  return {
    matrixSlug: matrix.slug,
    matrixVersion: matrix.version,
    inputs,
    matchedRuleId: null,
    matchedRuleIds: [],
    modalidade: matrix.fallback.modalidade,
    criterio: matrix.fallback.criterio,
    rationaleMd: matrix.fallback.rationaleMd,
    citations: matrix.fallback.citations,
    usedFallback: true,
  };
}

// ---------- Predicate evaluator ----------

export function evalPredicate(
  pred: DecisionPredicate,
  inputs: DecisionInputs,
): boolean {
  switch (pred.op) {
    case "and":
      return pred.items.every((p) => evalPredicate(p, inputs));
    case "or":
      return pred.items.some((p) => evalPredicate(p, inputs));
    case "not":
      return !evalPredicate(pred.item, inputs);
    case "eq":
      return looseEq(inputs[pred.input], pred.value);
    case "neq":
      return !looseEq(inputs[pred.input], pred.value);
    case "gt":
      return toNumber(inputs[pred.input]) > pred.value;
    case "gte":
      return toNumber(inputs[pred.input]) >= pred.value;
    case "lt":
      return toNumber(inputs[pred.input]) < pred.value;
    case "lte":
      return toNumber(inputs[pred.input]) <= pred.value;
    case "in": {
      const v = inputs[pred.input];
      if (v === undefined || v === null) return false;
      return pred.values.some((x) => looseEq(v, x));
    }
    case "contains": {
      const v = inputs[pred.input];
      if (typeof v !== "string") return false;
      return v.toLowerCase().includes(pred.value.toLowerCase());
    }
    default: {
      const exhaustive: never = pred;
      return exhaustive;
    }
  }
}

function looseEq(a: DecisionInputValue, b: string | number | boolean): boolean {
  if (a === undefined || a === null) return false;
  if (typeof a === typeof b) return a === b;
  // permite "true" / "false" vindos de form submission
  if (typeof b === "boolean" && typeof a === "string") {
    return a === String(b);
  }
  if (typeof b === "number" && typeof a === "string") {
    const n = Number(a);
    return Number.isFinite(n) && n === b;
  }
  return String(a) === String(b);
}

function toNumber(v: DecisionInputValue): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY;
  }
  if (typeof v === "boolean") return v ? 1 : 0;
  return Number.NEGATIVE_INFINITY;
}

// ---------- Friendly labels ----------

export const MODALIDADE_LABELS: Record<string, string> = {
  pregao: "Pregão",
  concorrencia: "Concorrência",
  concurso: "Concurso",
  leilao: "Leilão",
  dialogo_competitivo: "Diálogo competitivo",
};

export const CRITERIO_LABELS: Record<string, string> = {
  menor_preco: "Menor preço",
  maior_desconto: "Maior desconto",
  melhor_tecnica: "Melhor técnica ou conteúdo artístico",
  tecnica_e_preco: "Técnica e preço",
  maior_lance: "Maior lance",
  maior_retorno_economico: "Maior retorno econômico",
};

export function friendlyModalidade(m: string) {
  return MODALIDADE_LABELS[m] ?? m;
}
export function friendlyCriterio(c: string) {
  return CRITERIO_LABELS[c] ?? c;
}
