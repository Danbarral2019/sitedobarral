import { describe, it, expect } from "vitest";
import {
  runDecisionMatrix,
  evalPredicate,
} from "../decision-engine";
import { modalidadeJulgamentoV1 } from "@/data/planejamento/decision-matrix/modalidade-julgamento-v1";

describe("decision-engine: evalPredicate", () => {
  it("avalia eq/neq com coerção segura entre string e boolean", () => {
    expect(
      evalPredicate(
        { op: "eq", input: "ok", value: true },
        { ok: "true" },
      ),
    ).toBe(true);
    expect(
      evalPredicate(
        { op: "neq", input: "ok", value: true },
        { ok: false },
      ),
    ).toBe(true);
  });

  it("combina and/or recursivamente", () => {
    const pred = {
      op: "and" as const,
      items: [
        { op: "eq" as const, input: "a", value: 1 },
        {
          op: "or" as const,
          items: [
            { op: "eq" as const, input: "b", value: "x" },
            { op: "eq" as const, input: "c", value: true },
          ],
        },
      ],
    };
    expect(evalPredicate(pred, { a: 1, b: "x", c: false })).toBe(true);
    expect(evalPredicate(pred, { a: 1, b: "y", c: true })).toBe(true);
    expect(evalPredicate(pred, { a: 2, b: "x", c: true })).toBe(false);
  });

  it("suporta in e gt corretamente", () => {
    expect(
      evalPredicate(
        { op: "in", input: "o", values: ["obra", "servico"] },
        { o: "obra" },
      ),
    ).toBe(true);
    expect(
      evalPredicate(
        { op: "gt", input: "v", value: 100 },
        { v: 200 },
      ),
    ).toBe(true);
  });
});

describe("decision-engine: runDecisionMatrix", () => {
  it("é determinística para os mesmos inputs", () => {
    const inputs = {
      objeto: "prestacao_servico",
      comum_especial: "comum",
      natureza_intelectual: false,
      objeto_definivel: true,
      solucao_inovadora: false,
      regime_srp: false,
      maior_desconto_aplicavel: false,
    };
    const a = runDecisionMatrix(modalidadeJulgamentoV1, inputs);
    const b = runDecisionMatrix(modalidadeJulgamentoV1, inputs);
    expect(a).toEqual(b);
  });

  it("cai no fallback quando nenhuma regra casa", () => {
    const res = runDecisionMatrix(modalidadeJulgamentoV1, {});
    expect(res.usedFallback).toBe(true);
    expect(res.modalidade).toBe("concorrencia");
    expect(res.criterio).toBe("menor_preco");
    expect(res.matchedRuleId).toBeNull();
  });

  it("alienação sempre vira leilão + maior_lance", () => {
    const res = runDecisionMatrix(modalidadeJulgamentoV1, {
      objeto: "alienacao",
    });
    expect(res.modalidade).toBe("leilao");
    expect(res.criterio).toBe("maior_lance");
    expect(res.matchedRuleId).toBe("leilao-alienacao");
  });

  it("prioridade: diálogo competitivo antes de concorrência especial", () => {
    const res = runDecisionMatrix(modalidadeJulgamentoV1, {
      objeto: "prestacao_servico",
      comum_especial: "especial",
      natureza_intelectual: true,
      objeto_definivel: false,
      solucao_inovadora: true,
    });
    expect(res.matchedRuleId).toBe("dialogo-solucao-inovadora");
    expect(res.modalidade).toBe("dialogo_competitivo");
  });
});
