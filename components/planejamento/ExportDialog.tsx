"use client";

import { useEffect, useState } from "react";
import {
  Download,
  FileText,
  FileType2,
  FileJson2,
  Loader2,
  X,
  ArrowUpRightFromSquare,
} from "lucide-react";
import { cn } from "@/lib/planejamento/cn";

type Format = "html-sei" | "docx" | "pdf" | "pncp-metadata";

interface Props {
  documentId: string;
  documentType: "ETP" | "TR";
  open: boolean;
  onClose: () => void;
}

interface ExportRecord {
  id: string;
  format: Format;
  sizeBytes: number | null;
  createdAt: string;
  signedUrl: string | null;
}

const FORMAT_META: Record<
  Format,
  { label: string; desc: string; Icon: typeof FileText }
> = {
  "html-sei": {
    label: "HTML (SEI)",
    desc: "Cópia pronta para colar no editor do SEI",
    Icon: FileType2,
  },
  docx: {
    label: "Word (.docx)",
    desc: "Edição posterior com identidade do Prof. Barral",
    Icon: FileText,
  },
  pdf: {
    label: "PDF",
    desc: "Arquivo para leitura e arquivamento",
    Icon: FileText,
  },
  "pncp-metadata": {
    label: "Metadados PNCP (JSON)",
    desc: "Estrutura para preenchimento do PNCP/Comprasnet",
    Icon: FileJson2,
  },
};

export default function ExportDialog({
  documentId,
  documentType,
  open,
  onClose,
}: Props) {
  const [selected, setSelected] = useState<Record<Format, boolean>>({
    "html-sei": true,
    docx: true,
    pdf: true,
    "pncp-metadata": true,
  });
  const [history, setHistory] = useState<ExportRecord[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/planejamento/documents/${documentId}/exports`,
        );
        if (!res.ok) throw new Error("Falha ao carregar histórico");
        const data = await res.json();
        if (!cancelled) setHistory(data.exports);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, documentId]);

  async function handleExport() {
    const formats = (Object.keys(selected) as Format[]).filter((k) => selected[k]);
    if (formats.length === 0) return;
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/planejamento/documents/${documentId}/exports`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ formats }),
        },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Falha ao exportar");
      }
      const { exports: newRecs } = (await res.json()) as {
        exports: ExportRecord[];
      };
      setHistory((prev) => [...newRecs, ...(prev ?? [])]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setRunning(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-label="Exportar documento"
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col border-l border-gray-200 bg-white shadow-xl"
      >
        <header className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 rounded-lg bg-brand-50 p-2 text-brand-700">
              <Download className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-500">
                Exportação
              </p>
              <h3 className="font-serif text-lg text-brand-900">
                Gerar artefatos do {documentType}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-4 space-y-2">
            {(Object.keys(FORMAT_META) as Format[]).map((f) => {
              const meta = FORMAT_META[f];
              return (
                <label
                  key={f}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition",
                    selected[f]
                      ? "border-brand-300 bg-brand-50/50"
                      : "border-gray-200 bg-white hover:border-brand-200",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selected[f]}
                    onChange={(e) =>
                      setSelected((prev) => ({ ...prev, [f]: e.target.checked }))
                    }
                    className="mt-1"
                  />
                  <span className="rounded-md bg-white p-2 text-brand-700">
                    <meta.Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-brand-900">
                      {meta.label}
                    </p>
                    <p className="text-xs text-gray-600">{meta.desc}</p>
                  </div>
                </label>
              );
            })}
          </div>

          {error && (
            <p className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </p>
          )}

          <button
            onClick={handleExport}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-surface-page hover:bg-brand-800 disabled:opacity-60"
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Gerar artefatos
          </button>

          <div className="mt-6">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
              Histórico (mais recentes)
            </p>
            {loading && (
              <p className="inline-flex items-center gap-2 text-xs text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
              </p>
            )}
            {history && history.length === 0 && !loading && (
              <p className="text-xs text-gray-500">Sem exportações anteriores.</p>
            )}
            {history && history.length > 0 && (
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                {history.map((h) => {
                  const meta = FORMAT_META[h.format];
                  return (
                    <li
                      key={h.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <meta.Icon className="h-3.5 w-3.5 text-brand-700" />
                        <span className="text-gray-800">{meta.label}</span>
                        <span className="text-[11px] text-gray-500">
                          {new Date(h.createdAt).toLocaleString("pt-BR")}
                          {typeof h.sizeBytes === "number" && (
                            <> · {Math.round(h.sizeBytes / 102.4) / 10} KB</>
                          )}
                        </span>
                      </div>
                      {h.signedUrl ? (
                        <a
                          href={h.signedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-900"
                        >
                          Abrir
                          <ArrowUpRightFromSquare className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-[11px] text-gray-400">
                          URL indisponível
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
