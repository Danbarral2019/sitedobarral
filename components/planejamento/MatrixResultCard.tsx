"use client";

import type { DecisionRunResult } from "./matrix-types";
import {
  friendlyCriterio,
  friendlyModalidade,
} from "@/lib/planejamento/decision-engine";
import { AlertTriangle, Scale, BookOpen } from "lucide-react";

interface Props {
  result: DecisionRunResult;
  /** Quando usado como "última execução", pode esconder o rationale. */
  compact?: boolean;
}

export default function MatrixResultCard({ result, compact }: Props) {
  return (
    <section className="rounded-xl border border-brand-100 bg-white p-5">
      <header className="mb-3 flex items-start gap-3">
        <span className="rounded-lg bg-brand-50 p-2 text-brand-700">
          <Scale className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-brand-800">
            Recomendação
          </p>
          <h3 className="font-serif text-2xl text-brand-900">
            {friendlyModalidade(result.modalidade)}
          </h3>
          <p className="text-sm text-gray-700">
            Critério: {friendlyCriterio(result.criterio)}
          </p>
        </div>
      </header>

      {result.usedFallback && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Nenhuma regra específica casou com os inputs informados. A
            recomendação acima é o fallback conservador; revise a classificação
            do objeto antes de incorporar ao ETP.
          </p>
        </div>
      )}

      {!compact && (
        <div className="mb-3 rounded-lg bg-gray-50 p-4 text-sm leading-relaxed text-gray-800">
          <p className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
            <BookOpen className="h-3 w-3" /> Fundamentação
          </p>
          <p>{result.rationaleMd}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {result.citations.map((c, i) => (
          <span
            key={i}
            className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-medium text-gray-700"
          >
            {c.label}
          </span>
        ))}
      </div>

      {result.matchedRuleIds.length > 1 && (
        <p className="mt-3 text-[11px] text-gray-500">
          Regras que satisfizeram o predicado:{" "}
          {result.matchedRuleIds.map((id, i) => (
            <span key={id}>
              <code className="rounded bg-gray-100 px-1">{id}</code>
              {i < result.matchedRuleIds.length - 1 && ", "}
            </span>
          ))}
          . A primeira (prioridade mais alta) foi aplicada.
        </p>
      )}
    </section>
  );
}
