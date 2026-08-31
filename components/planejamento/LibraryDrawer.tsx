"use client";

import { useEffect, useState } from "react";
import {
  BookMarked,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
  ArrowUpToLine,
} from "lucide-react";

interface Snippet {
  id: string;
  titulo: string;
  corpoMd: string;
  tagsJson: string | null;
  sourceSectionId: string | null;
  updatedAt: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /**
   * Quando o aluno clica "Inserir", recebemos o corpo do snippet para
   * quem abriu o drawer (section editor) aplicar no textarea ativo.
   */
  onInsert: (corpoMd: string) => void;
  /**
   * Seed opcional para criar snippet rápido com texto pré-preenchido
   * (ex: "Salvar seleção atual como snippet").
   */
  seedCorpoMd?: string;
  seedTitulo?: string;
  seedSourceSectionId?: string;
}

export default function LibraryDrawer({
  open,
  onClose,
  onInsert,
  seedCorpoMd,
  seedTitulo,
  seedSourceSectionId,
}: Props) {
  const [snippets, setSnippets] = useState<Snippet[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [formTitulo, setFormTitulo] = useState("");
  const [formCorpo, setFormCorpo] = useState("");

  const debouncedQ = useDebounced(q, 200);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const url = debouncedQ
          ? `/api/planejamento/library/snippets?q=${encodeURIComponent(debouncedQ)}`
          : `/api/planejamento/library/snippets`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Falha ao carregar biblioteca");
        const data = await res.json();
        if (!cancelled) setSnippets(data.snippets);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, debouncedQ]);

  useEffect(() => {
    if (!open) return;
    if (seedCorpoMd && !formCorpo) {
      setFormCorpo(seedCorpoMd);
      setFormTitulo(seedTitulo ?? "");
      setCreating(true);
    }
  }, [open, seedCorpoMd, seedTitulo, formCorpo]);

  async function submitCreate() {
    try {
      const res = await fetch("/api/planejamento/library/snippets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: formTitulo.trim(),
          corpoMd: formCorpo.trim(),
          sourceSectionId: seedSourceSectionId,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Falha ao salvar");
      }
      setCreating(false);
      setFormCorpo("");
      setFormTitulo("");
      setSnippets(null); // força re-fetch
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    }
  }

  async function removeSnippet(id: string) {
    try {
      const res = await fetch(`/api/planejamento/library/snippets/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Falha ao excluir");
      setSnippets((prev) => (prev ? prev.filter((s) => s.id !== id) : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
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
        aria-label="Biblioteca pessoal"
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col border-l border-border-subtle bg-white"
      >
        <header className="flex items-start justify-between border-b border-border-subtle px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 rounded-[6px] bg-brand-50 p-2 text-brand-700">
              <BookMarked className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-ink-muted">
                Biblioteca pessoal
              </p>
              <h3 className="font-serif text-lg text-brand-900">
                Seus trechos reutilizáveis
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-ink-muted hover:bg-surface-raised hover:text-ink-muted"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="border-b border-border-subtle bg-surface-raised px-5 py-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-ink-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por título ou corpo…"
              className="flex-1 rounded-md border border-border-subtle px-3 py-1.5 text-sm focus:border-brand-600 focus:outline-none"
            />
            <button
              onClick={() => setCreating((v) => !v)}
              className="inline-flex items-center gap-1 rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800"
            >
              <Plus className="h-3.5 w-3.5" /> Novo
            </button>
          </div>
          {creating && (
            <div className="mt-3 rounded-md border border-brand-100 bg-white p-3">
              <input
                value={formTitulo}
                onChange={(e) => setFormTitulo(e.target.value)}
                placeholder="Título"
                className="mb-2 w-full rounded-md border border-border-subtle px-3 py-1.5 text-sm"
                maxLength={200}
              />
              <textarea
                value={formCorpo}
                onChange={(e) => setFormCorpo(e.target.value)}
                placeholder="Texto a reutilizar (prosa técnica)…"
                rows={6}
                className="w-full resize-none rounded-md border border-border-subtle px-3 py-2 font-mono text-xs"
                maxLength={20000}
              />
              <div className="mt-2 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setCreating(false);
                    setFormCorpo("");
                    setFormTitulo("");
                  }}
                  className="rounded-md border border-border-subtle px-3 py-1.5 text-xs text-ink-secondary hover:bg-surface-raised"
                >
                  Cancelar
                </button>
                <button
                  onClick={submitCreate}
                  disabled={
                    formTitulo.trim().length < 3 || formCorpo.trim().length < 5
                  }
                  className="rounded-md bg-brand-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-800 disabled:opacity-60"
                >
                  Salvar snippet
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <p className="inline-flex items-center gap-2 text-xs text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </p>
          )}
          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">
              {error}
            </p>
          )}
          {snippets && snippets.length === 0 && !loading && (
            <p className="text-xs text-ink-muted">
              Ainda não há snippets. Salve trechos bem redigidos para reusar em
              contratações futuras.
            </p>
          )}
          {snippets && snippets.length > 0 && (
            <ul className="space-y-2">
              {snippets.map((s) => (
                <li
                  key={s.id}
                  className="rounded-[6px] border border-border-subtle bg-white p-3"
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-brand-900">
                      {s.titulo}
                    </p>
                    <button
                      onClick={() => removeSnippet(s.id)}
                      className="rounded p-1 text-ink-muted hover:bg-red-50 hover:text-red-600"
                      title="Excluir snippet"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="mb-2 whitespace-pre-wrap text-xs leading-relaxed text-ink-secondary">
                    {truncate(s.corpoMd, 360)}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] text-ink-muted">
                      atualizado em{" "}
                      {new Date(s.updatedAt).toLocaleDateString("pt-BR")}
                    </p>
                    <button
                      onClick={() => {
                        onInsert(s.corpoMd);
                        onClose();
                      }}
                      className="inline-flex items-center gap-1 rounded-md bg-brand-700 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-brand-800"
                    >
                      <ArrowUpToLine className="h-3 w-3" />
                      Inserir na seção
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}

function useDebounced<T>(value: T, delay: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function truncate(s: string, max: number) {
  if (!s) return "";
  if (s.length <= max) return s;
  return s.slice(0, max).trimEnd() + "…";
}
