"use client";

import { useEffect, useMemo, useState } from "react";
import type { DecisionInput } from "@/data/planejamento/types";
import { Loader2, ScaleIcon } from "lucide-react";
import MatrixResultCard from "./MatrixResultCard";
import type { DecisionRunResult } from "./matrix-types";

interface Props {
  sessionId: string;
}

interface MatrixMeta {
  slug: string;
  version: number;
  title: string;
  inputs: DecisionInput[];
}

type Value = string | number | boolean | undefined;

export default function MatrixWizard({ sessionId }: Props) {
  const [matrix, setMatrix] = useState<MatrixMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, Value>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<DecisionRunResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/planejamento/decision/matrices");
        if (!res.ok) throw new Error("Falha ao carregar matriz");
        const data = await res.json();
        if (!cancelled && data.matrices?.[0]) setMatrix(data.matrices[0]);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const missingRequired = useMemo(() => {
    if (!matrix) return [];
    return matrix.inputs
      .filter((i) => i.required && (values[i.id] === undefined || values[i.id] === ""))
      .map((i) => i.label);
  }, [matrix, values]);

  async function submit() {
    if (!matrix) return;
    setSubmitting(true);
    setError(null);
    try {
      // Normaliza valores — enum para string, bool para boolean real
      const normalized: Record<string, string | number | boolean> = {};
      for (const inp of matrix.inputs) {
        const raw = values[inp.id];
        if (raw === undefined || raw === "") continue;
        if (inp.type === "number") {
          const n = Number(raw);
          if (Number.isFinite(n)) normalized[inp.id] = n;
        } else if (inp.type === "bool") {
          normalized[inp.id] = raw === true || raw === "true";
        } else {
          normalized[inp.id] = String(raw);
        }
      }
      const res = await fetch("/api/planejamento/decision/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          matrixSlug: matrix.slug,
          inputs: normalized,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Falha ao executar matriz");
      }
      const { result: r } = await res.json();
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <p className="inline-flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando matriz…
      </p>
    );
  }
  if (!matrix) {
    return (
      <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
        {error ?? "Matriz indisponível."}
      </p>
    );
  }

  if (result) {
    return (
      <div className="space-y-4">
        <MatrixResultCard result={result} />
        <button
          onClick={() => setResult(null)}
          className="text-xs text-brand-700 underline hover:text-brand-900"
        >
          Reexecutar com outros parâmetros
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-5"
    >
      <header className="flex items-start gap-3 rounded-lg border border-brand-100 bg-brand-50 p-4">
        <span className="rounded-lg bg-white p-2 text-brand-700">
          <ScaleIcon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-brand-800">
            {matrix.slug} · v{matrix.version}
          </p>
          <h2 className="font-serif text-lg text-brand-900">{matrix.title}</h2>
          <p className="mt-1 text-xs text-gray-600">
            A matriz é determinística e auditável; mudanças no conjunto de
            regras geram uma nova versão registrada em{" "}
            <code className="rounded bg-white px-1">PlanningDecisionRun</code>.
          </p>
        </div>
      </header>

      <div className="space-y-4">
        {matrix.inputs.map((inp) => (
          <InputField
            key={inp.id}
            input={inp}
            value={values[inp.id]}
            onChange={(v) => setValues((prev) => ({ ...prev, [inp.id]: v }))}
          />
        ))}
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between">
        {missingRequired.length > 0 ? (
          <p className="text-xs text-amber-700">
            Preencha: {missingRequired.join(", ")}
          </p>
        ) : (
          <span />
        )}
        <button
          type="submit"
          disabled={submitting || missingRequired.length > 0}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-medium text-surface-page hover:bg-brand-800 disabled:opacity-60"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ScaleIcon className="h-4 w-4" />
          )}
          Executar matriz
        </button>
      </div>
    </form>
  );
}

function InputField({
  input,
  value,
  onChange,
}: {
  input: DecisionInput;
  value: Value;
  onChange: (v: Value) => void;
}) {
  const id = `dm-${input.id}`;
  if (input.type === "enum") {
    return (
      <div>
        <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-800">
          {input.label}
          {input.required && <span className="text-red-600"> *</span>}
        </label>
        <select
          id={id}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          className="w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
        >
          <option value="">Selecione…</option>
          {input.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {input.help && <Helper text={input.help} />}
      </div>
    );
  }
  if (input.type === "bool") {
    return (
      <div>
        <p className="mb-1 text-sm font-medium text-gray-800">{input.label}</p>
        <div className="flex gap-2">
          {(
            [
              { v: true, label: "Sim" },
              { v: false, label: "Não" },
            ] as const
          ).map((opt) => (
            <button
              type="button"
              key={String(opt.v)}
              onClick={() => onChange(opt.v)}
              className={`rounded-lg border px-4 py-1.5 text-sm transition ${
                value === opt.v
                  ? "border-brand-700 bg-brand-700 text-surface-page"
                  : "border-gray-200 bg-white text-gray-700 hover:border-brand-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {input.help && <Helper text={input.help} />}
      </div>
    );
  }
  if (input.type === "number") {
    return (
      <div>
        <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-800">
          {input.label}
          {input.required && <span className="text-red-600"> *</span>}
        </label>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step="0.01"
          value={(value as number | string | undefined) ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") return onChange(undefined);
            const n = Number(raw);
            onChange(Number.isFinite(n) ? n : undefined);
          }}
          className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
        />
        {input.help && <Helper text={input.help} />}
      </div>
    );
  }
  // text
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-800">
        {input.label}
        {input.required && <span className="text-red-600"> *</span>}
      </label>
      <input
        id={id}
        type="text"
        value={(value as string | undefined) ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
      />
      {input.help && <Helper text={input.help} />}
    </div>
  );
}

function Helper({ text }: { text: string }) {
  return <p className="mt-1 text-[11px] text-gray-500">{text}</p>;
}
