import { describe, it, expect } from "vitest";
import {
  runDecisionMatrix,
  evalPredicate,
  friendlyModalidade,
  friendlyCriterio,
} from "../decision-engine";
import type { DecisionPredicate } from "@/data/planejamento/types";
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

  it("nega o predicado interno com not", () => {
    expect(
      evalPredicate({ op: "not", item: { op: "eq", input: "a", value: 1 } }, { a: 2 }),
    ).toBe(true);
    expect(
      evalPredicate({ op: "not", item: { op: "eq", input: "a", value: 1 } }, { a: 1 }),
    ).toBe(false);
  });

  it("avalia comparações numéricas gte/lt/lte", () => {
    expect(evalPredicate({ op: "gte", input: "v", value: 100 }, { v: 100 })).toBe(true);
    expect(evalPredicate({ op: "gte", input: "v", value: 100 }, { v: 99 })).toBe(false);
    expect(evalPredicate({ op: "lt", input: "v", value: 100 }, { v: 99 })).toBe(true);
    expect(evalPredicate({ op: "lt", input: "v", value: 100 }, { v: 100 })).toBe(false);
    expect(evalPredicate({ op: "lte", input: "v", value: 100 }, { v: 100 })).toBe(true);
    expect(evalPredicate({ op: "lte", input: "v", value: 100 }, { v: 101 })).toBe(false);
  });

  it("coage strings numéricas vindas de formulário nas comparações", () => {
    // toNumber converte "150" -> 150
    expect(evalPredicate({ op: "gt", input: "v", value: 100 }, { v: "150" })).toBe(true);
    // string não-numérica vira -Infinity e nunca passa gt
    expect(evalPredicate({ op: "gt", input: "v", value: 100 }, { v: "abc" })).toBe(false);
    // boolean coage para 1/0
    expect(evalPredicate({ op: "gte", input: "v", value: 1 }, { v: true })).toBe(true);
    expect(evalPredicate({ op: "gte", input: "v", value: 1 }, { v: false })).toBe(false);
    // undefined vira -Infinity
    expect(evalPredicate({ op: "lt", input: "v", value: 0 }, {})).toBe(true);
  });

  it("avalia contains só para strings", () => {
    expect(
      evalPredicate({ op: "contains", input: "s", value: "LICITA" }, { s: "Nova licitação" }),
    ).toBe(true);
    expect(
      evalPredicate({ op: "contains", input: "s", value: "x" }, { s: "abc" }),
    ).toBe(false);
    // valor não-string devolve false sem lançar
    expect(
      evalPredicate({ op: "contains", input: "s", value: "1" }, { s: 123 }),
    ).toBe(false);
  });

  it("compara eq entre número e string numérica (looseEq)", () => {
    expect(evalPredicate({ op: "eq", input: "v", value: 100 }, { v: "100" })).toBe(true);
    expect(evalPredicate({ op: "eq", input: "v", value: 100 }, { v: "abc" })).toBe(false);
    // fallback String(a) === String(b) para tipos mistos restantes
    expect(evalPredicate({ op: "eq", input: "v", value: "1" }, { v: 1 })).toBe(true);
  });

  it("eq/in retornam false quando o input é ausente", () => {
    expect(evalPredicate({ op: "eq", input: "x", value: 1 }, {})).toBe(false);
    expect(evalPredicate({ op: "in", input: "x", values: [1, 2] }, { x: null })).toBe(false);
  });

  it("retorna o próprio predicado no ramo default (op desconhecido)", () => {
    // Força um op fora do enum para exercitar o exhaustive-check.
    const bogus = { op: "xyz", input: "a", value: 1 } as unknown as DecisionPredicate;
    // O default devolve `exhaustive` (o próprio objeto), que é truthy.
    expect(evalPredicate(bogus, { a: 1 })).toBe(bogus as never);
  });
});

describe("decision-engine: friendly labels", () => {
  it("traduz modalidades conhecidas e ecoa desconhecidas", () => {
    expect(friendlyModalidade("pregao")).toBe("Pregão");
    expect(friendlyModalidade("inexistente")).toBe("inexistente");
  });

  it("traduz critérios conhecidos e ecoa desconhecidos", () => {
    expect(friendlyCriterio("menor_preco")).toBe("Menor preço");
    expect(friendlyCriterio("inexistente")).toBe("inexistente");
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
