"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/planejamento/cn";

type Severity = "info" | "warn" | "error";

interface Finding {
  id: string;
  sectionKey?: string;
  documentType?: "ETP" | "TR";
  severity: Severity;
  kind: string;
  title: string;
  detail: string;
}

interface Report {
  sessionId: string;
  etpPresent: boolean;
  trPresent: boolean;
  etpConfirmed: number;
  etpRequired: number;
  trConfirmed: number;
  trRequired: number;
  matrixRun: boolean;
  findings: Finding[];
  generatedAt: string;
}

interface Props {
  sessionId: string;
}

export default function ReviewChecklist({ sessionId }: Props) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/planejamento/sessions/${sessionId}/review`,
        { method: "POST" },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Falha ao executar revisão");
      }
      const data = await res.json();
      setReport(data.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const counts = useMemo(() => {
    if (!report) return { error: 0, warn: 0, info: 0 };
    return report.findings.reduce(
      (acc, f) => ({ ...acc, [f.severity]: acc[f.severity] + 1 }),
      { error: 0, warn: 0, info: 0 },
    );
  }, [report]);

  if (loading && !report) {
    return (
      <p className="inline-flex items-center gap-2 text-sm text-ink-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Executando revisão…
      </p>
    );
  }
  if (error) {
    return (
      <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
        {error}
      </p>
    );
  }
  if (!report) return null;

  const readyToExport = counts.error === 0 && report.etpPresent && report.trPresent;

  return (
    <div className="space-y-5">
      <section
        className={cn(
          "rounded-[6px] border p-4",
          readyToExport
            ? "border-emerald-200 bg-emerald-50"
            : "border-amber-accent-soft bg-amber-accent-soft",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <span
              className={cn(
                "rounded-[6px] p-2",
                readyToExport
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-accent-soft text-amber-accent-deep",
              )}
            >
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-ink-muted">
                Estado geral
              </p>
              <h2 className="font-serif text-lg text-brand-900">
                {readyToExport
                  ? "Pronto para exportação"
                  : "Há pendências antes da exportação"}
              </h2>
              <p className="text-xs text-ink-secondary">
                {counts.error} erro{counts.error === 1 ? "" : "s"} ·{" "}
                {counts.warn} aviso{counts.warn === 1 ? "" : "s"} ·{" "}
                {counts.info} observação{counts.info === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <button
            onClick={run}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-[6px] border border-border-subtle bg-white px-3 py-1.5 text-xs font-medium text-ink-secondary hover:border-brand-300 disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Reexecutar
          </button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
          <StatPill
            label="ETP"
            current={report.etpConfirmed}
            total={report.etpRequired}
            ok={report.etpConfirmed >= report.etpRequired && report.etpPresent}
          />
          <StatPill
            label="TR"
            current={report.trConfirmed}
            total={report.trRequired}
            ok={
              report.trPresent &&
              report.trConfirmed >= report.trRequired
            }
          />
          <StatPill
            label="Matriz"
            current={report.matrixRun ? 1 : 0}
            total={1}
            ok={report.matrixRun}
          />
        </div>
      </section>

      {report.findings.length === 0 ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          Nenhum achado. Documento pronto para exportação.
        </p>
      ) : (
        <ul className="space-y-2">
          {report.findings.map((f) => (
            <FindingRow key={f.id} finding={f} />
          ))}
        </ul>
      )}

      <p className="text-[11px] text-ink-muted">
        Relatório gerado em{" "}
        {new Date(report.generatedAt).toLocaleString("pt-BR")}. As verificações
        são informativas e não bloqueiam a exportação.
      </p>
    </div>
  );
}

function StatPill({
  label,
  current,
  total,
  ok,
}: {
  label: string;
  current: number;
  total: number;
  ok: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[6px] border px-3 py-2",
        ok
          ? "border-emerald-200 bg-white text-emerald-800"
          : "border-border-subtle bg-white text-ink-secondary",
      )}
    >
      <p className="text-[10px] uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="text-sm font-medium">
        {current} / {total}
      </p>
    </div>
  );
}

function FindingRow({ finding }: { finding: Finding }) {
  const meta = severityMeta(finding.severity);
  return (
    <li
      className={cn(
        "rounded-[6px] border p-3 text-sm",
        meta.bg,
        meta.border,
      )}
    >
      <div className="flex items-start gap-2">
        <span className={cn("mt-0.5", meta.text)}>{meta.icon}</span>
        <div className="flex-1">
          <p className={cn("font-medium", meta.text)}>{finding.title}</p>
          <p className="mt-0.5 text-xs text-ink-secondary">{finding.detail}</p>
          <p className="mt-1 text-[10px] uppercase tracking-wide text-ink-muted">
            {finding.documentType ?? "—"} · {finding.kind}
            {finding.sectionKey && ` · ${finding.sectionKey}`}
          </p>
        </div>
      </div>
    </li>
  );
}

function severityMeta(s: Severity) {
  switch (s) {
    case "error":
      return {
        icon: <AlertCircle className="h-4 w-4" />,
        bg: "bg-red-50",
        border: "border-red-200",
        text: "text-red-900",
      };
    case "warn":
      return {
        icon: <AlertTriangle className="h-4 w-4" />,
        bg: "bg-amber-accent-soft",
        border: "border-amber-accent-soft",
        text: "text-amber-accent-deep",
      };
    case "info":
    default:
      return {
        icon: <Info className="h-4 w-4" />,
        bg: "bg-brand-50",
        border: "border-brand-200",
        text: "text-brand-900",
      };
  }
}

