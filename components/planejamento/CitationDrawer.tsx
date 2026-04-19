"use client";

import { useEffect } from "react";
import { X, ExternalLink, BookMarked, Scale, FileText, Gavel } from "lucide-react";
import type { PlanningSectionSource } from "@/data/planejamento/types";

interface Props {
  open: boolean;
  source: PlanningSectionSource | null;
  onClose: () => void;
}

export default function CitationDrawer({ open, source, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !source) return null;

  const Icon = iconFor(source.sourceType);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-label="Fonte citada"
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-xl"
      >
        <header className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 rounded-lg bg-brand-50 p-2 text-brand-700">
              <Icon className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-500">
                {friendlyType(source.sourceType)}
              </p>
              <h3 className="font-serif text-lg leading-snug text-brand-900">
                {source.title}
              </h3>
              {typeof source.similarity === "number" && (
                <p className="mt-0.5 text-xs text-gray-500">
                  relevância estimada {Math.round(source.similarity * 100)}%
                </p>
              )}
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

        <div className="flex-1 overflow-y-auto px-5 py-4 text-sm leading-relaxed text-gray-800">
          {source.snippet ? (
            <p className="whitespace-pre-wrap">{source.snippet}</p>
          ) : (
            <p className="italic text-gray-500">
              Trecho-fonte não pré-carregado nesta sessão. Abra a fonte original
              para consultar o texto integral.
            </p>
          )}

          {source.articleNumber && (
            <p className="mt-4 rounded-md bg-brand-50 p-3 text-xs text-brand-900">
              Referência: artigo {source.articleNumber} da Lei 14.133/2021.
            </p>
          )}
        </div>

        {source.url && (
          <footer className="border-t border-gray-100 px-5 py-3">
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-900"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir fonte original
            </a>
          </footer>
        )}
      </aside>
    </>
  );
}

function iconFor(t: PlanningSectionSource["sourceType"]) {
  switch (t) {
    case "lei-article":
      return Scale;
    case "legislative-act":
      return BookMarked;
    case "tribunal-decision":
      return Gavel;
    default:
      return FileText;
  }
}

function friendlyType(t: PlanningSectionSource["sourceType"]) {
  switch (t) {
    case "lei-article":
      return "Artigo da Lei 14.133";
    case "legislative-act":
      return "Ato normativo";
    case "tribunal-decision":
      return "Decisão de tribunal";
    default:
      return "Documento do curso";
  }
}
