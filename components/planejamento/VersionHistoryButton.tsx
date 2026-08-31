"use client";

import { useEffect, useState } from "react";
import {
  History,
  Loader2,
  X,
  Save,
  Bot,
  User as UserIcon,
  Cpu,
} from "lucide-react";
import { cn } from "@/lib/planejamento/cn";

interface VersionRow {
  id: string;
  versionNumber: number;
  authorKind: "user" | "ai" | "system";
  authorId: string | null;
  label: string | null;
  createdAt: string;
}

interface SectionDiff {
  sectionKey: string;
  changeKind: "added" | "removed" | "modified" | "unchanged";
  summary: string;
  lines?: Array<{ op: "equal" | "add" | "del"; content: string }>;
}

interface DocumentDiff {
  fromVersion: number | null;
  toVersion: number;
  totalChanges: number;
  sections: SectionDiff[];
}

interface Props {
  documentId: string;
}

export default function VersionHistoryButton({ documentId }: Props) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<VersionRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [diff, setDiff] = useState<DocumentDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (!open) return;
    if (versions) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/planejamento/documents/${documentId}/versions`,
        );
        if (!res.ok) throw new Error("Falha ao carregar histórico");
        const data = await res.json();
        if (!cancelled) setVersions(data.versions);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, versions, documentId]);

  async function fetchDiff(versionNumber: number) {
    setSelected(versionNumber);
    setDiff(null);
    setDiffLoading(true);
    try {
      const res = await fetch(
        `/api/planejamento/documents/${documentId}/versions/${versionNumber}/diff`,
      );
      if (!res.ok) throw new Error("Falha ao carregar diff");
      const data = await res.json();
      setDiff(data.diff);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setDiffLoading(false);
    }
  }

  async function createSnapshot() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/planejamento/documents/${documentId}/versions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: label.trim() || undefined }),
        },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Falha ao criar versão");
      }
      setLabel("");
      setVersions(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-[6px] border border-border-subtle bg-white px-3 py-1.5 text-xs font-medium text-ink-secondary hover:border-brand-300 hover:text-brand-800"
      >
        <History className="h-3.5 w-3.5" /> Histórico
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside
            role="dialog"
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-3xl flex-col border-l border-border-subtle bg-white"
          >
            <header className="flex items-start justify-between border-b border-border-subtle px-5 py-4">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-ink-muted">
                  Versionamento
                </p>
                <h3 className="font-serif text-lg text-brand-900">
                  Histórico do documento
                </h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-ink-muted hover:bg-surface-raised hover:text-ink-muted"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex items-center gap-2 border-b border-border-subtle bg-surface-raised px-5 py-3">
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Rótulo (opcional, ex: antes da matriz)"
                className="flex-1 rounded-md border border-border-subtle px-3 py-1.5 text-sm focus:border-brand-600 focus:outline-none"
                maxLength={200}
              />
              <button
                onClick={createSnapshot}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Salvar versão
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              <aside className="w-56 shrink-0 border-r border-border-subtle bg-surface-raised">
                {loading && (
                  <p className="p-4 text-xs text-ink-muted">
                    <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                    Carregando…
                  </p>
                )}
                {error && (
                  <p className="p-4 text-xs text-red-800">{error}</p>
                )}
                {versions && versions.length === 0 && (
                  <p className="p-4 text-xs text-ink-muted">
                    Nenhuma versão ainda.
                  </p>
                )}
                {versions && versions.length > 0 && (
                  <ol className="divide-y divide-border-subtle">
                    {versions.map((v) => (
                      <li key={v.id}>
                        <button
                          onClick={() => fetchDiff(v.versionNumber)}
                          className={cn(
                            "flex w-full items-start gap-2 px-3 py-2 text-left text-xs transition hover:bg-white",
                            selected === v.versionNumber && "bg-white",
                          )}
                        >
                          <span className="mt-0.5">{authorIcon(v.authorKind)}</span>
                          <span className="flex-1">
                            <span className="font-medium text-brand-900">
                              v{v.versionNumber}
                            </span>
                            {v.label && (
                              <span className="block text-[10px] text-ink-muted">
                                {v.label}
                              </span>
                            )}
                            <span className="block text-[10px] text-ink-muted">
                              {new Date(v.createdAt).toLocaleString("pt-BR")}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </aside>

              <section className="flex-1 overflow-y-auto p-5 text-sm">
                {selected == null && (
                  <p className="text-xs text-ink-muted">
                    Selecione uma versão à esquerda para ver o diff contra a
                    imediatamente anterior.
                  </p>
                )}
                {diffLoading && (
                  <p className="inline-flex items-center gap-2 text-xs text-ink-muted">
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando diff…
                  </p>
                )}
                {diff && <DiffView diff={diff} />}
              </section>
            </div>
          </aside>
        </>
      )}
    </>
  );
}

function authorIcon(k: string) {
  switch (k) {
    case "user":
      return <UserIcon className="h-3 w-3 text-brand-700" />;
    case "ai":
      return <Bot className="h-3 w-3 text-brand-700" />;
    case "system":
    default:
      return <Cpu className="h-3 w-3 text-ink-muted" />;
  }
}

function DiffView({ diff }: { diff: DocumentDiff }) {
  if (diff.totalChanges === 0) {
    return (
      <p className="text-xs text-ink-muted">
        Sem alterações em relação à versão anterior.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      <p className="text-[11px] uppercase tracking-wide text-ink-muted">
        v{diff.fromVersion ?? "—"} → v{diff.toVersion} · {diff.totalChanges} seções
        alteradas
      </p>
      {diff.sections
        .filter((s) => s.changeKind !== "unchanged")
        .map((s) => (
          <section key={s.sectionKey} className="rounded-[6px] border border-border-subtle">
            <header className="flex items-center justify-between border-b border-border-subtle bg-surface-raised px-3 py-2">
              <p className="text-xs font-semibold text-brand-900">
                {s.sectionKey}
              </p>
              <p className="text-[11px] text-ink-muted">
                {s.changeKind} · {s.summary}
              </p>
            </header>
            {s.lines && s.lines.length > 0 ? (
              <pre className="max-h-80 overflow-auto px-3 py-2 font-mono text-[11px] leading-relaxed">
                {s.lines.map((l, i) => (
                  <div
                    key={i}
                    className={cn(
                      "whitespace-pre-wrap",
                      l.op === "add" && "bg-emerald-50 text-emerald-900",
                      l.op === "del" && "bg-red-50 text-red-900 line-through",
                      l.op === "equal" && "text-ink-muted",
                    )}
                  >
                    {l.op === "add" ? "+ " : l.op === "del" ? "- " : "  "}
                    {l.content}
                  </div>
                ))}
              </pre>
            ) : (
              <p className="px-3 py-2 text-xs italic text-ink-muted">
                Sem diff de linhas (mudança somente de status).
              </p>
            )}
          </section>
        ))}
    </div>
  );
}
